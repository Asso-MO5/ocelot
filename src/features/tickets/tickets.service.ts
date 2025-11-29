import type { FastifyInstance } from 'fastify';
import type {
  Ticket,
  CreateTicketBody,
  CreateTicketsWithPaymentBody,
  UpdateTicketBody,
  GetTicketsQuery,
  TicketsStats,
  TicketsStatsByDay,
  TicketPricingInfo,
} from './tickets.types.ts';
import { createSumUpCheckout } from '../pay/pay.utils.ts';
import { getPriceById } from '../prices/prices.service.ts';
import { createStructuredError } from './tickets.errors.ts';

/**
 * Génère un code QR unique (8 caractères alphanumériques majuscules)
 * 36^8 = 2 821 109 907 456 combinaisons possibles
 */
async function generateUniqueQRCode(app: FastifyInstance): Promise<string> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 8;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Générer un code aléatoire
    let code = '';
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Vérifier l'unicité
    const existing = await app.pg.query<{ qr_code: string }>(
      'SELECT qr_code FROM tickets WHERE qr_code = $1',
      [code]
    );

    if (existing.rows.length === 0) {
      return code;
    }

    attempts++;
  }

  throw new Error('Impossible de générer un code QR unique après plusieurs tentatives');
}

/**
 * Construit le contenu du champ notes en combinant les notes libres et les informations de tarif
 * Si pricing_info est fourni, il sera stocké dans notes au format JSON
 */
function buildNotesContent(
  notes: string | null | undefined,
  pricingInfo: TicketPricingInfo | undefined
): string | null {
  const parts: any = {};

  // Si des notes libres existent, les ajouter
  if (notes && notes.trim()) {
    // Essayer de parser si c'est déjà du JSON
    try {
      const parsed = JSON.parse(notes);
      Object.assign(parts, parsed);
    } catch {
      // Si ce n'est pas du JSON, l'ajouter comme note libre
      parts.free_notes = notes;
    }
  }

  // Si des informations de tarif sont fournies, les ajouter
  if (pricingInfo) {
    // Ajouter la date d'application si elle n'est pas déjà présente
    if (!pricingInfo.applied_at) {
      pricingInfo.applied_at = new Date().toISOString();
    }
    parts.pricing_info = pricingInfo;
  }

  // Si aucune information n'est présente, retourner null
  if (Object.keys(parts).length === 0) {
    return null;
  }

  // Retourner le JSON stringifié
  return JSON.stringify(parts);
}

/**
 * Extrait les informations de tarif depuis le champ notes
 */
export function extractPricingInfo(notes: string | null): TicketPricingInfo | null {
  if (!notes) {
    return null;
  }

  try {
    const parsed = JSON.parse(notes);
    return parsed.pricing_info || null;
  } catch {
    // Si ce n'est pas du JSON valide, retourner null
    return null;
  }
}

/**
 * Valide les informations de tarif au moment de la création du ticket
 * Vérifie que le tarif existe, est actif, et que le montant correspond
 */
async function validatePricingInfo(
  app: FastifyInstance,
  pricingInfo: TicketPricingInfo | undefined,
  ticketPrice: number,
  reservationDate: string
): Promise<void> {
  // Si aucune information de tarif n'est fournie, on accepte (tarif personnalisé)
  if (!pricingInfo || !pricingInfo.price_id) {
    return;
  }

  // Récupérer le tarif depuis la base de données
  const price = await getPriceById(app, pricingInfo.price_id);

  if (!price) {
    throw createStructuredError(
      400,
      `Le tarif spécifié (ID: ${pricingInfo.price_id}) n'existe pas`,
      `The specified price (ID: ${pricingInfo.price_id}) does not exist`
    );
  }

  // Vérifier que le tarif est actif
  if (!price.is_active) {
    throw createStructuredError(
      400,
      `Le tarif spécifié (ID: ${pricingInfo.price_id}) n'est pas actif`,
      `The specified price (ID: ${pricingInfo.price_id}) is not active`
    );
  }

  // Vérifier que les dates de validité du tarif couvrent la date de réservation
  if (price.start_date || price.end_date) {
    const reservationDateObj = new Date(reservationDate);
    reservationDateObj.setHours(0, 0, 0, 0);

    if (price.start_date) {
      const startDate = new Date(price.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (reservationDateObj < startDate) {
        throw createStructuredError(
          400,
          `Le tarif spécifié n'est pas valide pour la date de réservation ${reservationDate}. Le tarif commence le ${price.start_date}`,
          `The specified price is not valid for the reservation date ${reservationDate}. The price starts on ${price.start_date}`
        );
      }
    }

    if (price.end_date) {
      const endDate = new Date(price.end_date);
      endDate.setHours(0, 0, 0, 0);
      if (reservationDateObj > endDate) {
        throw createStructuredError(
          400,
          `Le tarif spécifié n'est pas valide pour la date de réservation ${reservationDate}. Le tarif se termine le ${price.end_date}`,
          `The specified price is not valid for the reservation date ${reservationDate}. The price ends on ${price.end_date}`
        );
      }
    }
  }

  // Vérifier que le montant correspond (avec une tolérance de 0.01€ pour les arrondis)
  const expectedAmount = parseFloat(price.amount.toString());
  const providedAmount = pricingInfo.price_amount;
  const tolerance = 0.01;

  if (Math.abs(expectedAmount - providedAmount) > tolerance) {
    throw createStructuredError(
      400,
      `Le montant du tarif ne correspond pas. Montant attendu: ${expectedAmount}€, montant fourni: ${providedAmount}€`,
      `The price amount does not match. Expected: ${expectedAmount}€, provided: ${providedAmount}€`
    );
  }

  // Vérifier que le montant du ticket correspond au montant du tarif
  if (Math.abs(expectedAmount - ticketPrice) > tolerance) {
    throw createStructuredError(
      400,
      `Le montant du ticket (${ticketPrice}€) ne correspond pas au montant du tarif (${expectedAmount}€)`,
      `The ticket amount (${ticketPrice}€) does not match the price amount (${expectedAmount}€)`
    );
  }

  // Vérifier que le type d'audience correspond si fourni
  if (pricingInfo.audience_type && pricingInfo.audience_type !== price.audience_type) {
    throw createStructuredError(
      400,
      `Le type d'audience ne correspond pas. Attendu: ${price.audience_type}, fourni: ${pricingInfo.audience_type}`,
      `The audience type does not match. Expected: ${price.audience_type}, provided: ${pricingInfo.audience_type}`
    );
  }

  // Vérifier que requires_proof correspond si fourni
  if (
    pricingInfo.requires_proof !== undefined &&
    pricingInfo.requires_proof !== price.requires_proof
  ) {
    throw createStructuredError(
      400,
      `La nécessité d'un justificatif ne correspond pas. Le tarif ${price.requires_proof ? 'requiert' : 'ne requiert pas'} un justificatif`,
      `The proof requirement does not match. The price ${price.requires_proof ? 'requires' : 'does not require'} proof`
    );
  }
}

/**
 * Crée un nouveau ticket
 */
export async function createTicket(
  app: FastifyInstance,
  data: CreateTicketBody
): Promise<Ticket> {

  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Validation : email obligatoire
  if (!data.email || !data.email.trim()) {
    throw new Error('L\'email est obligatoire');
  }

  if (!data.pricing_info) {
    throw new Error('Les informations de tarif sont obligatoires');
  }

  // Validation : montant du ticket doit être positif
  if (data.ticket_price < 0) {
    throw new Error('Le prix du ticket doit être positif ou nul');
  }

  // Validation : donation doit être positive ou nulle
  const donationAmount = data.donation_amount ?? 0;
  if (donationAmount < 0) {
    throw new Error('Le montant du don doit être positif ou nul');
  }

  // Calculer le montant total
  const totalAmount = data.ticket_price + donationAmount;

  // Validation : dates et heures
  if (!data.reservation_date) {
    throw new Error('La date de réservation est obligatoire');
  }

  if (!data.slot_start_time || !data.slot_end_time) {
    throw new Error('Les heures de début et de fin du créneau sont obligatoires');
  }

  // Validation : heure de fin doit être après l'heure de début
  const startTime = new Date(`2000-01-01T${data.slot_start_time}`);
  const endTime = new Date(`2000-01-01T${data.slot_end_time}`);
  if (startTime >= endTime) {
    throw new Error('L\'heure de fin doit être postérieure à l\'heure de début');
  }

  // Validation : vérifier que le tarif existe et est valide si pricing_info est fourni
  await validatePricingInfo(app, data.pricing_info, data.ticket_price, data.reservation_date);

  // Générer un code QR unique
  const qrCode = await generateUniqueQRCode(app);

  // Construire le contenu de notes avec les informations de tarif
  const notesContent = buildNotesContent(data.notes, data.pricing_info);

  // Créer le ticket
  const result = await app.pg.query<Ticket>(
    `INSERT INTO tickets (
      qr_code, first_name, last_name, email, reservation_date,
      slot_start_time, slot_end_time, checkout_id, checkout_reference,
      transaction_status, ticket_price, donation_amount, total_amount,
      status, notes, language
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      qrCode,
      data.first_name ?? null,
      data.last_name ?? null,
      data.email.trim(),
      data.reservation_date,
      data.slot_start_time,
      data.slot_end_time,
      data.checkout_id ?? null,
      data.checkout_reference ?? null,
      data.transaction_status ?? null,
      data.ticket_price,
      donationAmount,
      totalAmount,
      'pending', // Statut initial
      notesContent,
      data.language ?? null,
    ]
  );

  return result.rows[0];
}

/**
 * Récupère tous les tickets avec filtres optionnels
 */
export async function getTickets(
  app: FastifyInstance,
  query: GetTicketsQuery = {}
): Promise<Ticket[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (query.email) {
    sql += ` AND email = $${paramIndex}`;
    params.push(query.email);
    paramIndex++;
  }

  if (query.reservation_date) {
    sql += ` AND reservation_date = $${paramIndex}`;
    params.push(query.reservation_date);
    paramIndex++;
  }

  if (query.status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(query.status);
    paramIndex++;
  }

  if (query.checkout_id) {
    sql += ` AND checkout_id = $${paramIndex}`;
    params.push(query.checkout_id);
    paramIndex++;
  }

  if (query.qr_code) {
    sql += ` AND qr_code = $${paramIndex}`;
    params.push(query.qr_code);
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC';

  const result = await app.pg.query<Ticket>(sql, params);
  return result.rows;
}

/**
 * Récupère un ticket par son ID
 */
export async function getTicketById(
  app: FastifyInstance,
  id: string
): Promise<Ticket | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<Ticket>(
    'SELECT * FROM tickets WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Récupère un ticket par son code QR
 */
export async function getTicketByQRCode(
  app: FastifyInstance,
  qrCode: string
): Promise<Ticket | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<Ticket>(
    'SELECT * FROM tickets WHERE qr_code = $1',
    [qrCode.toUpperCase()]
  );

  return result.rows[0] || null;
}

/**
 * Met à jour un ticket
 */
export async function updateTicket(
  app: FastifyInstance,
  id: string,
  data: UpdateTicketBody
): Promise<Ticket> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Vérifier que le ticket existe
  const existing = await getTicketById(app, id);
  if (!existing) {
    throw new Error('Ticket non trouvé');
  }

  // Validation : montants
  const ticketPrice = data.ticket_price !== undefined ? data.ticket_price : existing.ticket_price;
  const donationAmount = data.donation_amount !== undefined ? data.donation_amount : existing.donation_amount;

  if (ticketPrice < 0) {
    throw new Error('Le prix du ticket doit être positif ou nul');
  }

  if (donationAmount < 0) {
    throw new Error('Le montant du don doit être positif ou nul');
  }

  // Calculer le nouveau montant total si les montants ont changé
  const totalAmount = ticketPrice + donationAmount;

  // Construire la requête de mise à jour dynamiquement
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.first_name !== undefined) {
    updates.push(`first_name = $${paramIndex}`);
    params.push(data.first_name);
    paramIndex++;
  }

  if (data.last_name !== undefined) {
    updates.push(`last_name = $${paramIndex}`);
    params.push(data.last_name);
    paramIndex++;
  }

  if (data.email !== undefined) {
    if (!data.email.trim()) {
      throw new Error('L\'email ne peut pas être vide');
    }
    updates.push(`email = $${paramIndex}`);
    params.push(data.email.trim());
    paramIndex++;
  }

  if (data.reservation_date !== undefined) {
    updates.push(`reservation_date = $${paramIndex}`);
    params.push(data.reservation_date);
    paramIndex++;
  }

  if (data.slot_start_time !== undefined) {
    updates.push(`slot_start_time = $${paramIndex}`);
    params.push(data.slot_start_time);
    paramIndex++;
  }

  if (data.slot_end_time !== undefined) {
    updates.push(`slot_end_time = $${paramIndex}`);
    params.push(data.slot_end_time);
    paramIndex++;
  }

  if (data.ticket_price !== undefined) {
    updates.push(`ticket_price = $${paramIndex}`);
    params.push(data.ticket_price);
    paramIndex++;
  }

  if (data.donation_amount !== undefined) {
    updates.push(`donation_amount = $${paramIndex}`);
    params.push(data.donation_amount);
    paramIndex++;
  }

  // Mettre à jour le montant total si les montants ont changé
  if (data.ticket_price !== undefined || data.donation_amount !== undefined) {
    updates.push(`total_amount = $${paramIndex}`);
    params.push(totalAmount);
    paramIndex++;
  }

  if (data.checkout_id !== undefined) {
    updates.push(`checkout_id = $${paramIndex}`);
    params.push(data.checkout_id);
    paramIndex++;
  }

  if (data.checkout_reference !== undefined) {
    updates.push(`checkout_reference = $${paramIndex}`);
    params.push(data.checkout_reference);
    paramIndex++;
  }

  if (data.transaction_status !== undefined) {
    updates.push(`transaction_status = $${paramIndex}`);
    params.push(data.transaction_status);
    paramIndex++;
  }

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex}`);
    params.push(data.status);
    paramIndex++;
  }

  if (data.used_at !== undefined) {
    updates.push(`used_at = $${paramIndex}`);
    params.push(data.used_at);
    paramIndex++;
  }

  if (data.notes !== undefined) {
    updates.push(`notes = $${paramIndex}`);
    params.push(data.notes);
    paramIndex++;
  }

  if (data.language !== undefined) {
    updates.push(`language = $${paramIndex}`);
    params.push(data.language);
    paramIndex++;
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push(`updated_at = current_timestamp`);
  params.push(id);

  const result = await app.pg.query<Ticket>(
    `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  return result.rows[0];
}

/**
 * Valide/utilise un ticket (scan QR)
 */
export async function validateTicket(
  app: FastifyInstance,
  qrCode: string
): Promise<Ticket> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const ticket = await getTicketByQRCode(app, qrCode);

  if (!ticket) {
    throw new Error('Ticket non trouvé');
  }

  // Vérifier que le ticket est payé
  if (ticket.status !== 'paid') {
    throw new Error(`Le ticket n'est pas valide. Statut actuel: ${ticket.status}`);
  }

  // Vérifier que le ticket n'a pas déjà été utilisé
  if (ticket.used_at) {
    throw new Error('Ce ticket a déjà été utilisé');
  }

  // Vérifier que la date de réservation n'est pas passée
  const reservationDate = new Date(ticket.reservation_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reservationDate.setHours(0, 0, 0, 0);

  if (reservationDate < today) {
    throw new Error('La date de réservation est passée');
  }

  // Marquer le ticket comme utilisé
  const result = await app.pg.query<Ticket>(
    `UPDATE tickets 
     SET status = 'used', used_at = current_timestamp, updated_at = current_timestamp
     WHERE id = $1
     RETURNING *`,
    [ticket.id]
  );

  return result.rows[0];
}

/**
 * Supprime un ticket
 */
export async function deleteTicket(
  app: FastifyInstance,
  id: string
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query(
    'DELETE FROM tickets WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Crée plusieurs tickets avec paiement SumUp
 * Crée d'abord le checkout SumUp, puis enregistre tous les tickets avec le checkout_id
 */
export async function createTicketsWithPayment(
  app: FastifyInstance,
  data: CreateTicketsWithPaymentBody
): Promise<{ checkout_id: string | null; checkout_reference: string | null; tickets: Ticket[] }> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Validation : email obligatoire
  if (!data.email || !data.email.trim()) {
    throw new Error('L\'email est obligatoire');
  }

  // Validation : au moins un ticket
  if (!data.tickets || data.tickets.length === 0) {
    throw new Error('Au moins un ticket est requis');
  }

  // Séparer les tickets membres et non-membres
  const memberTickets = data.tickets.filter(ticket => ticket.pricing_info?.price_name?.match(/membre/i));

  /*
  const nonMemberFreeTickets = data.tickets.filter(ticket => ticket.ticket_price === 0 && !ticket.pricing_info?.price_name?.match(/membre/i));

  // Vérification pour les places gratuites non-membres : 0 ou exactement 2 places (pour l'accompagnant)
  if (nonMemberFreeTickets.length > 0 && nonMemberFreeTickets.length !== 2) {
    throw createStructuredError(
      400,
      'Pour les non-membres, vous pouvez réserver exactement 2 places gratuites (pour vous et votre accompagnant) ou aucune',
      'For non-members, you can reserve exactly 2 free tickets (for you and your companion) or none'
    );
  }
  */

  // Traitement des tickets membres
  if (memberTickets.length > 0) {
    // Récupérer les informations du membre depuis Galette
    const params = new URLSearchParams();
    params.set('email', data.email.trim());
    const res = await fetch(process.env.GALETTE_URL + '/members?' + params.toString(), {
      headers: {
        'x-api-token': process.env.GALETTE_API_TOKEN || '',
      },
    });

    if (!res.ok) {
      throw createStructuredError(
        500,
        'Erreur lors de la vérification du membre',
        'Error checking member status'
      );
    }

    const memberData = await res.json();

    if (!memberData.id_adh) {
      throw createStructuredError(
        400,
        'L\'utilisateur n\'est pas un membre',
        'The user is not a member'
      );
    }

    // Compter le nombre d'enfants (children)
    const numOfChildren = memberData.children?.length || 0;
    let memberFreeTickets = memberTickets.filter(ticket => ticket.ticket_price === 0);

    app.log.info({
      email: data.email,
      memberTicketsCount: memberFreeTickets.length,
      numOfChildren,
      totalTicketsBefore: data.tickets.length,
    }, 'Vérification des places membres');

    // Vérifier qu'il y a suffisamment d'enfants pour toutes les places membres
    // Note: 1 place pour le parent + N places pour les enfants (minimum 1 si pas d'enfants)
    const maxAllowedMemberTickets = numOfChildren + 1;

    if (memberFreeTickets.length > maxAllowedMemberTickets) {
      // Trouver les indices des tickets membres gratuits dans data.tickets
      const memberFreeIndices: number[] = [];
      for (let i = 0; i < data.tickets.length; i++) {
        const ticket = data.tickets[i];
        if (ticket.pricing_info?.price_name?.match(/membre/i) && ticket.ticket_price === 0) {
          memberFreeIndices.push(i);
        }
      }

      // Supprimer les tickets en trop en partant de la fin (pour ne pas décaler les indices)
      const ticketsToRemove = memberFreeTickets.length - maxAllowedMemberTickets;
      const indicesToRemove = memberFreeIndices.slice(-ticketsToRemove);

      app.log.warn({
        email: data.email,
        memberTicketsCount: memberFreeTickets.length,
        numOfChildren,
        maxAllowedMemberTickets,
        ticketsToRemove,
      }, 'Suppression de places membres en trop (pas assez d\'enfants)');

      // Retirer les tickets en trop avec splice (en partant de la fin)
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        data.tickets.splice(indicesToRemove[i], 1);
      }

      // Vérifier qu'il reste au moins un ticket après suppression
      if (data.tickets.length === 0) {
        throw createStructuredError(
          400,
          'Aucun ticket ne peut être créé. Vérifiez le nombre d\'enfants et les places disponibles.',
          'No ticket can be created. Please check the number of children and available places.'
        );
      }

      app.log.info({
        email: data.email,
        totalTicketsAfter: data.tickets.length,
        removedCount: ticketsToRemove,
      }, 'Places membres supprimées');

      // Recalculer les tickets membres après suppression
      memberFreeTickets = data.tickets.filter(
        ticket => ticket.pricing_info?.price_name?.match(/membre/i) && ticket.ticket_price === 0
      );
    }

    // Vérifier le délai de 2 semaines pour les membres
    // On compte les dates différentes et les créneaux différents sur les 2 dernières semaines
    if (memberFreeTickets.length > 0) {
      // Utiliser la date la plus ancienne parmi les nouvelles réservations
      const reservationDates = memberFreeTickets.map(t => new Date(t.reservation_date));
      const earliestDate = new Date(Math.min(...reservationDates.map(d => d.getTime())));


      // Trouver le lundi de la semaine de la date la plus ancienne
      const earliestDay = earliestDate.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
      const daysToMonday = earliestDay === 0 ? 6 : earliestDay - 1; // Nombre de jours à soustraire pour arriver au lundi

      const weekMonday = new Date(earliestDate);
      weekMonday.setHours(0, 0, 0, 0);
      weekMonday.setDate(weekMonday.getDate() - daysToMonday);
      const weekMondayStr = weekMonday.toISOString().split('T')[0];

      // Récupérer tous les tickets membres payés de la même semaine (checkout_id = '0' = premier ticket de chaque commande)
      const existingMemberTickets = await app.pg.query<{
        reservation_date: string;
      }>(
        `SELECT reservation_date
         FROM tickets
         WHERE email = $1
         AND checkout_id = '0'
         AND ticket_price = 0
         AND status = 'paid'
         AND reservation_date >= $2
         AND (
           notes LIKE '%"price_name":"%Membre%"%'
           OR notes LIKE '%"price_name":"%membre%"%'
           OR notes::jsonb->'pricing_info'->>'price_name' ILIKE '%membre%'
         )
         ORDER BY reservation_date ASC`,
        [data.email.trim(), weekMondayStr]
      );

      // Si un ticket existe déjà cette semaine, rejeter la commande
      if (existingMemberTickets.rows.length > 0) {
        throw createStructuredError(
          400,
          'Vous avez déjà réservé une date cette semaine. Limite : 1 réservation par semaine.',
          'You have already reserved a date this week. Limit: 1 reservation per week.'
        );
      }
    }
  }

  // Calculer le montant total (somme de tous les ticket_price + donation_amount)
  let totalAmount = 0;
  for (const ticket of data.tickets) {
    if (ticket.ticket_price < 0) {
      throw createStructuredError(
        400,
        'Le prix du ticket doit être positif ou nul',
        'The ticket price must be positive or null'
      );
    }
    const donationAmount = ticket.donation_amount ?? 0;
    if (donationAmount < 0) {
      throw createStructuredError(
        400,
        'Le montant du don doit être positif ou nul',
        'The donation amount must be positive or null'
      );
    }
    totalAmount += ticket.ticket_price + donationAmount;
  }

  if (totalAmount < 0) {
    throw createStructuredError(
      400,
      'Le montant total doit être supérieur ou égal à 0',
      'The total amount must be greater than or equal to 0'
    );
  }

  // Validation des dates et heures pour tous les tickets
  for (const ticket of data.tickets) {
    if (!ticket.reservation_date) {
      throw createStructuredError(
        400,
        'La date de réservation est obligatoire pour tous les tickets',
        'The reservation date is required for all tickets'
      );
    }
    if (!ticket.slot_start_time || !ticket.slot_end_time) {
      throw createStructuredError(
        400,
        'Les heures de début et de fin du créneau sont obligatoires pour tous les tickets',
        'The start and end time of the slot are required for all tickets'
      );
    }

    if (!ticket.pricing_info) {
      throw createStructuredError(
        400,
        'Les informations de tarif sont obligatoires pour tous les tickets',
        'The pricing info is required for all tickets'
      );
    }
    // Validation : heure de fin doit être après l'heure de début
    const startTime = new Date(`2000-01-01T${ticket.slot_start_time}`);
    const endTime = new Date(`2000-01-01T${ticket.slot_end_time}`);
    if (startTime >= endTime) {
      throw createStructuredError(
        400,
        'L\'heure de fin doit être postérieure à l\'heure de début pour tous les tickets',
        'The end time must be after the start time for all tickets'
      );
    }
    // Validation : vérifier que le tarif existe et est valide si pricing_info est fourni
    await validatePricingInfo(app, ticket.pricing_info, ticket.ticket_price, ticket.reservation_date);
  }

  // Si le montant total est 0, ne pas créer de checkout SumUp
  // Les tickets seront créés directement avec le statut "paid"
  let checkout: { id: string; checkout_reference: string; status: string } | null = null;
  const isFreeOrder = totalAmount === 0;

  if (!isFreeOrder) {
    // Créer le checkout SumUp uniquement si le montant est supérieur à 0
    const currency = data.currency || 'EUR';
    const description = data.description || `Réservation de ${data.tickets.length} ticket(s)`;

    checkout = await createSumUpCheckout(
      app,
      totalAmount,
      description,
      currency
    );
  }

  // Créer tous les tickets dans une transaction
  const createdTickets: Ticket[] = [];

  try {
    // Utiliser une transaction pour garantir que tous les tickets sont créés ou aucun
    await app.pg.query('BEGIN');

    for (const [index, ticketData] of data.tickets.entries()) {
      const donationAmount = ticketData.donation_amount ?? 0;
      const ticketTotalAmount = ticketData.ticket_price + donationAmount;

      // Générer un code QR unique pour chaque ticket
      const qrCode = await generateUniqueQRCode(app);

      // Construire le contenu de notes avec les informations de tarif pour ce ticket
      const notesContent = buildNotesContent(ticketData.notes, ticketData.pricing_info);

      // Si la commande est gratuite, les tickets sont directement payés
      // Sinon, ils sont en attente de paiement
      const ticketStatus = isFreeOrder ? 'paid' : 'pending';
      // Pour les commandes gratuites, on utilise l'index comme checkout_id (converti en string)
      // Le premier ticket a checkout_id = '0' pour identifier le premier ticket de chaque commande
      const checkoutId = checkout?.id ?? String(index);
      const checkoutReference = checkout?.checkout_reference ?? null;
      const transactionStatus = checkout?.status ?? null;

      const result = await app.pg.query<Ticket>(
        `INSERT INTO tickets (
          qr_code, first_name, last_name, email, reservation_date,
          slot_start_time, slot_end_time, checkout_id, checkout_reference,
          transaction_status, ticket_price, donation_amount, total_amount,
          status, notes, language
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          qrCode,
          data.first_name ?? null,
          data.last_name ?? null,
          data.email.trim(),
          ticketData.reservation_date,
          ticketData.slot_start_time,
          ticketData.slot_end_time,
          checkoutId,
          checkoutReference,
          transactionStatus,
          ticketData.ticket_price,
          donationAmount,
          ticketTotalAmount,
          ticketStatus,
          notesContent,
          data.language ?? null,
        ]
      );

      createdTickets.push(result.rows[0]);
    }

    await app.pg.query('COMMIT');
  } catch (err) {
    await app.pg.query('ROLLBACK');
    throw err;
  }

  // Si la commande est gratuite, envoyer les emails de confirmation immédiatement
  if (isFreeOrder) {
    try {
      const { sendTicketsConfirmationEmails } = await import('./tickets.email.ts');
      await sendTicketsConfirmationEmails(app, createdTickets);
    } catch (emailError) {
      app.log.error({ emailError }, 'Erreur lors de l\'envoi des emails de confirmation pour la commande gratuite');
      // Ne pas faire échouer la création des tickets si l'email échoue
    }
  }

  return {
    checkout_id: checkout?.id ?? null,
    checkout_reference: checkout?.checkout_reference ?? null,
    tickets: createdTickets,
  };
}

/**
 * Récupère tous les tickets associés à un checkout_id
 */
export async function getTicketsByCheckoutId(
  app: FastifyInstance,
  checkoutId: string
): Promise<Ticket[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<Ticket>(
    'SELECT * FROM tickets WHERE checkout_id = $1 ORDER BY created_at ASC',
    [checkoutId]
  );

  return result.rows;
}

/**
 * Met à jour les tickets associés à un checkout_id selon le statut du paiement
 */
export async function updateTicketsByCheckoutStatus(
  app: FastifyInstance,
  checkoutId: string,
  checkoutStatus: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'SENT' | 'SUCCESS',
  transactionStatus?: string
): Promise<number> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Convertir le statut SumUp en statut de ticket
  let ticketStatus: 'pending' | 'paid' | 'cancelled' = 'pending';
  if (checkoutStatus === 'PAID' || checkoutStatus === 'SUCCESS') {
    ticketStatus = 'paid';
  } else if (checkoutStatus === 'CANCELLED' || checkoutStatus === 'FAILED') {
    ticketStatus = 'cancelled';
  }

  // Mettre à jour tous les tickets associés à ce checkout
  const result = await app.pg.query<{ count: string }>(
    `UPDATE tickets 
     SET status = $1, 
         transaction_status = COALESCE($2, transaction_status),
         updated_at = current_timestamp
     WHERE checkout_id = $3
     RETURNING id`,
    [ticketStatus, transactionStatus || checkoutStatus, checkoutId]
  );

  return result.rows.length;
}

/**
 * Récupère les statistiques des tickets
 */
export async function getTicketsStats(
  app: FastifyInstance
): Promise<TicketsStats> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Date du début de la semaine (lundi)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = dimanche, 1 = lundi, etc.
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convertir dimanche en 6
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Date du début du mois
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  // Statistiques totales (tous les tickets avec status = 'paid')
  const totalResult = await app.pg.query<{ count: string; sum: string }>(
    `SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as sum
     FROM tickets 
     WHERE status = 'paid'`
  );
  const totalTicketsSold = parseInt(totalResult.rows[0].count, 10);
  const totalAmount = parseFloat(totalResult.rows[0].sum || '0');

  // Statistiques de la semaine (tickets payés depuis le début de la semaine)
  const weekResult = await app.pg.query<{ count: string; sum: string }>(
    `SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as sum
     FROM tickets 
     WHERE status = 'paid' 
     AND created_at >= $1`,
    [weekStartStr]
  );
  const weekTicketsSold = parseInt(weekResult.rows[0].count, 10);
  const weekAmount = parseFloat(weekResult.rows[0].sum || '0');

  // Statistiques du mois (tickets payés depuis le début du mois)
  const monthResult = await app.pg.query<{ count: string; sum: string }>(
    `SELECT 
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as sum
     FROM tickets 
     WHERE status = 'paid' 
     AND created_at >= $1`,
    [monthStartStr]
  );
  const monthAmount = parseFloat(monthResult.rows[0].sum || '0');

  // Statistiques par jour de la semaine
  const weekByDayResult = await app.pg.query<{
    date: string;
    count: string;
    sum: string;
  }>(
    `SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as sum
     FROM tickets 
     WHERE status = 'paid' 
     AND created_at >= $1
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [weekStartStr]
  );

  // Noms des jours en français
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  const weekTicketsByDay: TicketsStatsByDay[] = weekByDayResult.rows.map((row) => {
    const date = new Date(row.date);
    const dayName = dayNames[date.getDay()];
    return {
      date: row.date,
      day_name: dayName,
      tickets_count: parseInt(row.count, 10),
      amount: parseFloat(row.sum || '0'),
    };
  });

  return {
    total_tickets_sold: totalTicketsSold,
    week_tickets_sold: weekTicketsSold,
    week_tickets_by_day: weekTicketsByDay,
    total_amount: totalAmount,
    week_amount: weekAmount,
    month_amount: monthAmount,
  };
}

/**
 * Annule les tickets en statut "pending" créés il y a plus de 15 minutes
 * Libère les créneaux pour qu'ils soient à nouveau disponibles
 */
export async function cancelExpiredPendingTickets(
  app: FastifyInstance
): Promise<number> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }


  // Calculer la date limite (15 minutes avant maintenant)
  const fifteenMinutesAgo = new Date();
  fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
  const limitDate = fifteenMinutesAgo.toISOString();

  // Mettre à jour les tickets pending de plus de 15 minutes
  const result = await app.pg.query<{ count: string }>(
    `UPDATE tickets 
     SET status = 'cancelled', 
         updated_at = current_timestamp
     WHERE status = 'pending' 
     AND created_at < $1
     RETURNING id`,
    [limitDate]
  );

  const cancelledCount = result.rows.length;

  if (cancelledCount > 0) {
    app.log.info(
      { cancelledCount, limitDate },
      `Tickets pending expirés annulés (${cancelledCount} ticket(s))`
    );
  }

  return cancelledCount;
}

/**
 * Récupère les tickets validés pour un créneau donné
 * Retourne le nombre de tickets validés et la liste complète des tickets
 * 
 * @param reservation_date Date de réservation (format YYYY-MM-DD)
 * @param slot_start_time Heure de début du créneau (format HH:MM:SS)
 * @param slot_end_time Heure de fin du créneau (format HH:MM:SS)
 * @param includeAdjacentSlots Si true, inclut les créneaux adjacents (un peu avant et après)
 */
export async function getValidatedTicketsBySlot(
  app: FastifyInstance,
  reservation_date: string,
  slot_start_time: string,
  slot_end_time: string,
  includeAdjacentSlots: boolean = true
): Promise<{ count: number; tickets: Ticket[] }> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  let sql = `
    SELECT * FROM tickets 
    WHERE reservation_date = $1
    AND status = 'used'
    AND used_at IS NOT NULL
  `;
  const params: any[] = [reservation_date];
  let paramIndex = 2;

  if (includeAdjacentSlots) {
    // Inclure les créneaux qui se chevauchent avec le créneau demandé
    // Un créneau se chevauche s'il commence avant la fin du créneau demandé
    // et se termine après le début du créneau demandé
    sql += ` AND (
      (slot_start_time < $${paramIndex + 1} AND slot_end_time > $${paramIndex})
    )`;
    params.push(slot_start_time, slot_end_time);
    paramIndex += 2;
  } else {
    // Filtrer exactement sur le créneau
    sql += ` AND slot_start_time = $${paramIndex} AND slot_end_time = $${paramIndex + 1}`;
    params.push(slot_start_time, slot_end_time);
    paramIndex += 2;
  }

  sql += ' ORDER BY used_at DESC';

  const result = await app.pg.query<Ticket>(sql, params);

  return {
    count: result.rows.length,
    tickets: result.rows,
  };
}

