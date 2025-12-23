import type { FastifyInstance } from 'fastify';
import type {
  Ticket,
  CreateTicketBody,
  CreateTicketsWithPaymentBody,
  UpdateTicketBody,
  GetTicketsQuery,
  PaginatedTicketsResponse,
  TicketsStats,
  TicketsStatsByDay,
  TicketPricingInfo,
  WeeklySlotsStats,
  WeeklySlotStat,
  DailyTotal,
} from './tickets.types.ts';
import { createCheckout } from '../pay/pay.utils.ts';
import { getPriceById } from '../prices/prices.service.ts';
import { createStructuredError } from './tickets.errors.ts';
import { getSlotsForDate } from '../slots/slots.service.ts';

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
 * Construit le contenu du champ notes en combinant les notes libres, les informations de tarif et la visite guidée
 * Si pricing_info est fourni, il sera stocké dans notes au format JSON
 */
function buildNotesContent(
  notes: string | null | undefined,
  pricingInfo: TicketPricingInfo | undefined,
  guidedTour?: boolean,
  guidedTourPrice?: number
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

  // Si une visite guidée est demandée, l'ajouter avec son prix
  if (guidedTour === true) {
    parts.guided_tour = true;
    if (guidedTourPrice !== undefined && guidedTourPrice > 0) {
      parts.guided_tour_price = guidedTourPrice;
    }
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

  // Vérifier que le montant du ticket correspond au montant du tarif (prix de base) ou au demi-tarif (pour créneaux incomplets)
  const halfPrice = Math.floor(expectedAmount / 2);
  const isFullPrice = Math.abs(expectedAmount - ticketPrice) <= tolerance;
  const isHalfPrice = Math.abs(halfPrice - ticketPrice) <= tolerance;

  if (!isFullPrice && !isHalfPrice) {
    throw createStructuredError(
      400,
      `Le montant du ticket ne correspond pas au montant du tarif. Montant attendu: ${expectedAmount}€ (plein tarif) ou ${halfPrice}€ (demi-tarif), montant du ticket: ${ticketPrice}€`,
      `The ticket amount does not match the price amount. Expected: ${expectedAmount}€ (full price) or ${halfPrice}€ (half price), ticket amount: ${ticketPrice}€`
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

  // Calculer le montant total (pas de visite guidée dans createTicket)
  const guidedTourPrice = 0;
  const totalAmount = data.ticket_price + donationAmount + guidedTourPrice;

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
  const notesContent = buildNotesContent(data.notes, data.pricing_info, false, undefined);

  // Créer le ticket
  const result = await app.pg.query<Ticket>(
    `INSERT INTO tickets (
      qr_code, first_name, last_name, email, reservation_date,
      slot_start_time, slot_end_time, checkout_id, checkout_reference,
      transaction_status, ticket_price, donation_amount, guided_tour_price, total_amount,
      status, notes, language
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
      guidedTourPrice,
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
): Promise<PaginatedTicketsResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Paramètres de pagination (par défaut : page 1, limit 500)
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 500;
  const offset = (page - 1) * limit;

  // Construction de la clause WHERE
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  // Recherche textuelle dans plusieurs champs (email, first_name, last_name, checkout_id, qr_code)
  if (query.search) {
    const searchPattern = `%${query.search}%`;
    whereClause += ` AND (
      email ILIKE $${paramIndex} OR
      first_name ILIKE $${paramIndex} OR
      last_name ILIKE $${paramIndex} OR
      checkout_id ILIKE $${paramIndex} OR
      checkout_reference ILIKE $${paramIndex} OR
      qr_code ILIKE $${paramIndex}
    )`;
    params.push(searchPattern);
    paramIndex++;
  }

  if (query.reservation_date) {
    whereClause += ` AND reservation_date = $${paramIndex}`;
    params.push(query.reservation_date);
    paramIndex++;
  }

  if (query.status) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(query.status);
    paramIndex++;
  }

  // Requête pour compter le total
  const countSql = `SELECT COUNT(*) as total FROM tickets ${whereClause}`;
  const countResult = await app.pg.query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Requête pour récupérer les tickets avec pagination
  const limitParamIndex = paramIndex;
  const offsetParamIndex = paramIndex + 1;
  const dataSql = `SELECT * FROM tickets ${whereClause} ORDER BY created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  const dataParams = [...params, limit, offset];
  const result = await app.pg.query<Ticket>(dataSql, dataParams);

  // Calculer le nombre total de pages
  const totalPages = Math.ceil(total / limit);

  return {
    tickets: result.rows,
    total,
    page,
    limit,
    totalPages,
  };
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
 * Vérifie que le ticket est valide pour aujourd'hui et le créneau horaire (avec tolérance)
 */
export async function validateTicket(
  app: FastifyInstance,
  qrCode: string,
  toleranceMinutes: number = 30 // Tolérance en minutes (par défaut 30 minutes avant/après le créneau)
): Promise<Ticket> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const ticket = await getTicketByQRCode(app, qrCode);

  if (!ticket) {
    app.log.warn({ qrCode: qrCode.toUpperCase() }, 'Ticket non trouvé lors de la validation');
    throw createStructuredError(
      404,
      'Le ticket n\'a pas été trouvé',
      'The ticket has not been found'
    );
  }

  app.log.info({ ticketId: ticket.id, qrCode: ticket.qr_code, status: ticket.status }, 'Ticket trouvé, début de la validation');

  // Vérifier que le ticket n'a pas déjà été utilisé
  if (ticket.used_at) {
    throw createStructuredError(
      400,
      'Ce ticket a déjà été utilisé',
      'The ticket has already been used'
    );
  }

  // Vérifier que le ticket est payé
  if (ticket.status !== 'paid') {
    throw createStructuredError(
      400,
      `Le ticket n'est pas valide. Statut actuel: ${ticket.status}`,
      `The ticket is not valid. Current status: ${ticket.status}`
    );
  }

  // Vérifier que c'est bien le bon jour (aujourd'hui = date de réservation)
  // Utiliser PostgreSQL pour obtenir la date/heure locale (timezone Europe/Paris)
  let dbDate: string;
  let dbTime: string;
  try {
    // Utiliser NOW() avec timezone Europe/Paris pour obtenir la date/heure locale
    const dateResult = await app.pg.query<{ current_date: string; current_time: string }>(
      `SELECT 
        (NOW() AT TIME ZONE 'Europe/Paris')::date::text as current_date,
        TO_CHAR(NOW() AT TIME ZONE 'Europe/Paris', 'HH24:MI:SS') as current_time`
    );
    if (!dateResult.rows || dateResult.rows.length === 0) {
      throw new Error('Impossible de récupérer la date/heure depuis la base de données');
    }
    dbDate = dateResult.rows[0].current_date;
    dbTime = dateResult.rows[0].current_time;
  } catch (dateError: any) {
    app.log.error({ dateError, errorMessage: dateError?.message, errorStack: dateError?.stack }, 'Erreur lors de la récupération de la date/heure, utilisation de la date système');
    // Fallback sur la date système si la requête échoue
    const now = new Date();
    // Convertir en timezone Europe/Paris
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;
    dbDate = `${year}-${month}-${day}`;
    dbTime = `${hour}:${minute}:${second}`;
  }

  const reservationDate = new Date(ticket.reservation_date);
  const today = new Date(dbDate);
  today.setHours(0, 0, 0, 0);
  reservationDate.setHours(0, 0, 0, 0);

  if (reservationDate < today) {
    throw new Error('La date de réservation est passée');
  }

  if (reservationDate > today) {
    throw new Error(`Ce ticket est valable pour le ${ticket.reservation_date}, pas pour aujourd'hui`);
  }

  // Vérifier que c'est bien le bon créneau (avec tolérance)
  // Utiliser l'heure locale depuis PostgreSQL (timezone Europe/Paris)
  const currentTime = dbTime; // Format HH:MM:SS en timezone Europe/Paris
  const slotStartTime = ticket.slot_start_time;
  const slotEndTime = ticket.slot_end_time;

  // Convertir les heures en minutes depuis minuit pour faciliter les comparaisons
  function timeToMinutes(timeStr: string): number {
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return hours * 60 + minutes + (seconds || 0) / 60;
  }

  const currentMinutes = timeToMinutes(currentTime);
  const slotStartMinutes = timeToMinutes(slotStartTime);
  const slotEndMinutes = timeToMinutes(slotEndTime);

  // Vérifier que l'heure actuelle est dans le créneau avec tolérance
  // Tolérance avant le début et après la fin
  const minAllowedTime = slotStartMinutes - toleranceMinutes;
  const maxAllowedTime = slotEndMinutes + toleranceMinutes;

  if (currentMinutes < minAllowedTime) {
    const minutesEarly = Math.round(slotStartMinutes - currentMinutes);
    throw createStructuredError(
      400,
      `Le ticket est valable pour le créneau ${slotStartTime} - ${slotEndTime}. ` +
      `Il est trop tôt (${minutesEarly} minute${minutesEarly > 1 ? 's' : ''} avant le début du créneau).`,
      `The ticket is valid for the slot ${slotStartTime} - ${slotEndTime}. ` +
      `It is too early (${minutesEarly} minute${minutesEarly > 1 ? 's' : ''} before the start of the slot).`
    );
  }

  if (currentMinutes > maxAllowedTime) {
    const minutesLate = Math.round(currentMinutes - slotEndMinutes);
    throw createStructuredError(
      400,
      `Ce ticket est valable pour le créneau ${slotStartTime} - ${slotEndTime}. ` +
      `Il est trop tard (${minutesLate} minute${minutesLate > 1 ? 's' : ''} après la fin du créneau).`,
      `The ticket is valid for the slot ${slotStartTime} - ${slotEndTime}. ` +
      `It is too late (${minutesLate} minute${minutesLate > 1 ? 's' : ''} after the end of the slot).`
    );
  }

  // Marquer le ticket comme utilisé
  const result = await app.pg.query<Ticket>(
    `UPDATE tickets 
     SET status = 'used', used_at = current_timestamp, updated_at = current_timestamp
     WHERE id = $1
     RETURNING *`,
    [ticket.id]
  );
  (app.ws as any).send('capacity', 'refetch')

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
 * Crée plusieurs tickets avec paiement
 * Crée d'abord le checkout, puis enregistre tous les tickets avec le checkout_id
 */
export async function createTicketsWithPayment(
  app: FastifyInstance,
  data: CreateTicketsWithPaymentBody
): Promise<{ checkout_id: string | null; checkout_reference: string | null; checkout_url: string | null; tickets: Ticket[] }> {
  if (!app.pg) {
    throw createStructuredError(
      500,
      'Base de données non disponible',
      'Database not available'
    );
  }

  if (!data.tickets || data.tickets.length === 0) {
    throw createStructuredError(
      400,
      'Au moins un ticket est requis',
      'At least one ticket is required'
    );
  }

  if (data.tickets.length > 10) {
    throw createStructuredError(
      400,
      'Vous ne pouvez pas réserver plus de 10 tickets',
      'You cannot reserve more than 10 tickets'
    );
  }

  // Calculer le montant total AVANT de vérifier l'email
  // (pour savoir si email est requis ou non)
  const { getSettingValue } = await import('../settings/settings.service.ts');
  const slotCapacityHours = (await getSettingValue<number>(app, 'slot_capacity', 1)) || 1;
  const { isSlotComplete, calculateSlotPrice } = await import('../slots/slots.service.ts');

  // Gérer la visite guidée
  const wantsGuidedTour = data.guided_tour === true;
  let guidedTourPrice = 0;
  if (wantsGuidedTour) {
    const guidedTourPriceSetting = await getSettingValue<number>(app, 'guided_tour_price', 0);
    if (guidedTourPriceSetting === null || guidedTourPriceSetting <= 0) {
      throw createStructuredError(
        400,
        'Le tarif de la visite guidée n\'est pas configuré ou est invalide',
        'The guided tour price is not configured or is invalid'
      );
    }
    if (data.guided_tour_price !== undefined) {
      const tolerance = 0.01;
      if (Math.abs(data.guided_tour_price - guidedTourPriceSetting) > tolerance) {
        throw createStructuredError(
          400,
          `Le prix de la visite guidée ne correspond pas. Montant attendu: ${guidedTourPriceSetting}€, montant fourni: ${data.guided_tour_price}€`,
          `The guided tour price does not match. Expected: ${guidedTourPriceSetting}€, provided: ${data.guided_tour_price}€`
        );
      }
      guidedTourPrice = data.guided_tour_price;
    } else {
      guidedTourPrice = guidedTourPriceSetting;
    }
  }

  // Calculer le totalAmount (avant application des codes cadeaux)
  let totalAmount = 0;
  for (const ticket of data.tickets) {
    let ticketPrice = ticket.ticket_price;

    // Si le créneau est incomplet, appliquer le demi-tarif
    if (ticket.slot_start_time && ticket.slot_end_time && ticket.pricing_info?.price_amount) {
      const basePrice = ticket.pricing_info.price_amount;
      const isComplete = isSlotComplete(ticket.slot_start_time, ticket.slot_end_time, slotCapacityHours);
      if (!isComplete) {
        const adjustedPrice = calculateSlotPrice(basePrice, ticket.slot_start_time, ticket.slot_end_time, slotCapacityHours);
        if (ticketPrice !== adjustedPrice) {
          ticketPrice = adjustedPrice;
          ticket.ticket_price = adjustedPrice;
        }
      }
    }
    const donationAmount = ticket.donation_amount ?? 0;
    totalAmount += ticketPrice + donationAmount;
  }
  if (wantsGuidedTour) {
    totalAmount += guidedTourPrice * data.tickets.length;
  }

  // Email obligatoire uniquement si tous les tickets sont gratuites (totalAmount = 0)
  // Sinon, Stripe récupère l'email via le checkout
  if (totalAmount === 0) {
    if (!data.email || !data.email.trim()) {
      throw createStructuredError(
        400,
        'L\'email est obligatoire pour les réservations gratuites',
        'Email is required for free reservations'
      );
    }
  }

  const memberTickets = data.tickets.filter(ticket => ticket.pricing_info?.price_name?.match(/membre/i));

  if (memberTickets.length > 0) {
    // Pour les membres, email est toujours requis pour vérifier l'adhésion
    if (!data.email || !data.email.trim()) {
      throw createStructuredError(
        400,
        'L\'email est obligatoire pour vérifier l\'adhésion',
        'Email is required to verify membership'
      );
    }

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
        401,
        'Erreur lors de la vérification de l\'adhésion',
        'Error checking membership status'
      );
    }

    const memberData = await res.json();

    if (!memberData.id_adh) {
      throw createStructuredError(
        400,
        'Erreur lors de la vérification de l\'adhésion',
        'Error checking membership status'
      );
    }

    // Compter le nombre d'enfants (children)
    const numOfChildren = memberData.children?.length || 0;
    let memberFreeTickets = memberTickets.filter(ticket => ticket.ticket_price === 0);

    const maxAllowedMemberTickets = numOfChildren + 1;

    if (memberFreeTickets.length > maxAllowedMemberTickets) {
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

      // Retirer les tickets en trop avec splice (en partant de la fin)
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        data.tickets.splice(indicesToRemove[i], 1);
      }

      if (data.tickets.length === 0) {
        throw createStructuredError(
          400,
          'Aucun ticket ne peut être créé. Vérifiez le nombre d\'enfants et les places disponibles.',
          'No ticket can be created. Please check the number of children and available places.'
        );
      }

      // Recalculer les tickets membres après suppression
      memberFreeTickets = data.tickets.filter(
        ticket => ticket.pricing_info?.price_name?.match(/membre/i) && ticket.ticket_price === 0
      );
    }

    // Vérifier le délai de 1 semaines pour les membres
    // On compte les dates différentes et les créneaux différents sur les 2 dernières semaines
    if (memberFreeTickets.length > 0) {
      // Utiliser la date la plus ancienne parmi les nouvelles réservations
      const reservationDates = memberFreeTickets.map(t => new Date(t.reservation_date));
      const earliestDate = new Date(Math.min(...reservationDates.map(d => d.getTime())));

      // Trouver le lundi de la semaine de la date la plus ancienne
      const earliestDay = earliestDate.getDay();
      const daysToMonday = earliestDay === 0 ? 6 : earliestDay - 1;

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

  // Traitement des codes cadeaux si fournis (AVANT le calcul du totalAmount final)
  const giftCodesToUse: string[] = data.gift_codes || [];
  const usedGiftCodes: Array<{ code: string; ticketIndex: number }> = [];

  if (giftCodesToUse.length > 0) {
    const { validateGiftCode } = await import('../gift-codes/gift-codes.service.ts');
    for (const code of giftCodesToUse) {
      try {
        await validateGiftCode(app, code);
      } catch (err: any) {
        throw createStructuredError(
          400,
          `Code cadeau invalide: ${code}. ${err.message || ''}`,
          `Invalid gift code: ${code}. ${err.message || ''}`
        );
      }
    }

    // Créer une copie des tickets avec leur index pour pouvoir les trier
    const ticketsWithIndex = data.tickets.map((ticket, index) => ({
      ...ticket,
      originalIndex: index,
    }));

    ticketsWithIndex.sort((a, b) => b.ticket_price - a.ticket_price);

    for (let i = 0; i < Math.min(giftCodesToUse.length, ticketsWithIndex.length); i++) {
      const ticketWithIndex = ticketsWithIndex[i];
      const code = giftCodesToUse[i];
      ticketWithIndex.ticket_price = 0;
      ticketWithIndex.notes = JSON.stringify({
        ...ticketWithIndex.notes ? JSON.parse(ticketWithIndex.notes) : {},
        gift_code: code,
      });

      data.tickets[ticketWithIndex.originalIndex] = {
        ...ticketWithIndex,
        originalIndex: undefined,
      } as any;

      usedGiftCodes.push({
        code,
        ticketIndex: ticketWithIndex.originalIndex,
      });
    }
  }

  // Recalculer le totalAmount après application des codes cadeaux
  totalAmount = 0;
  for (const ticket of data.tickets) {
    let ticketPrice = ticket.ticket_price;

    // Si le créneau est incomplet, appliquer le demi-tarif (arrondi à l'inférieur)
    if (ticket.slot_start_time && ticket.slot_end_time && ticket.pricing_info?.price_amount) {
      const basePrice = ticket.pricing_info.price_amount;
      const isComplete = isSlotComplete(ticket.slot_start_time, ticket.slot_end_time, slotCapacityHours);

      if (!isComplete) {
        // Créneau incomplet : recalculer le prix avec demi-tarif
        const adjustedPrice = calculateSlotPrice(basePrice, ticket.slot_start_time, ticket.slot_end_time, slotCapacityHours);

        // Si le prix envoyé ne correspond pas au prix ajusté, utiliser le prix ajusté
        // (le frontend peut avoir fait une erreur de calcul)
        if (ticketPrice !== adjustedPrice) {
          ticketPrice = adjustedPrice;
          ticket.ticket_price = adjustedPrice;
        }
      }
    }

    if (ticketPrice < 0) {
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
    totalAmount += ticketPrice + donationAmount;
  }

  if (wantsGuidedTour) {
    totalAmount += guidedTourPrice * data.tickets.length;
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
    // On valide avec le prix de base (price_amount) avant ajustement
    const basePriceForValidation = ticket.pricing_info?.price_amount ?? ticket.ticket_price;
    await validatePricingInfo(app, ticket.pricing_info, basePriceForValidation, ticket.reservation_date);
  }

  // Si le montant total est 0, ne pas créer de checkout
  // Les tickets seront créés directement avec le statut "paid"
  let checkout: { id: string; checkout_reference: string; status: string, url: string } | null = null;
  const isFreeOrder = totalAmount === 0;

  if (!isFreeOrder) {
    const currency = data.currency || 'EUR';
    const description = data.description || `Réservation de ${data.tickets.length} ticket(s)`;

    // Créer une session de checkout
    const session = await createCheckout(
      app,
      totalAmount,
      description,
      currency,
      data.success_url,
      data.cancel_url,
      { checkout_type: 'tickets' }
    );

    checkout = {
      id: session.id,
      checkout_reference: session.id,
      status: session.status || 'open',
      url: session.url, // URL de redirection
    };
  }

  // Créer tous les tickets dans une transaction
  const createdTickets: Ticket[] = [];

  try {
    // Utiliser une transaction pour garantir que tous les tickets sont créés ou aucun
    await app.pg.query('BEGIN');

    for (const [index, ticketData] of data.tickets.entries()) {
      // Utiliser le prix ajusté (déjà calculé plus haut pour les créneaux incomplets)
      const ticketPrice = ticketData.ticket_price;
      const donationAmount = ticketData.donation_amount ?? 0;
      // Le prix de la visite guidée est appliqué à chaque ticket (pas réparti)
      // Chaque ticket contient le prix complet de la visite guidée
      const ticketGuidedTourPrice = wantsGuidedTour ? guidedTourPrice : 0;
      const ticketTotalAmount = ticketPrice + donationAmount + ticketGuidedTourPrice;

      // Générer un code QR unique pour chaque ticket
      const qrCode = await generateUniqueQRCode(app);

      // Construire le contenu de notes avec les informations de tarif et la visite guidée pour ce ticket
      const notesContent = buildNotesContent(ticketData.notes, ticketData.pricing_info, wantsGuidedTour, guidedTourPrice);

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
          transaction_status, ticket_price, donation_amount, guided_tour_price, total_amount,
          status, notes, language
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          qrCode,
          data.first_name ?? null,
          data.last_name ?? null,
          // Email : obligatoire si commande gratuite, sinon optionnel (Stripe le récupérera)
          (data.email && data.email.trim()) ? data.email.trim() : null,
          ticketData.reservation_date,
          ticketData.slot_start_time,
          ticketData.slot_end_time,
          checkoutId,
          checkoutReference,
          transactionStatus,
          ticketPrice,
          donationAmount,
          ticketGuidedTourPrice,
          ticketTotalAmount,
          ticketStatus,
          notesContent,
          data.language ?? null,
        ]
      );

      createdTickets.push(result.rows[0]);
    }

    // Utiliser les codes cadeaux après la création des tickets
    if (usedGiftCodes.length > 0) {
      const { useGiftCode } = await import('../gift-codes/gift-codes.service.ts');
      for (const { code, ticketIndex } of usedGiftCodes) {
        const ticket = createdTickets[ticketIndex];
        if (ticket) {
          await useGiftCode(app, code, ticket.id);
        }
      }
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
    checkout_url: checkout?.url ?? null,
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

  // Convertir le statut de paiement en statut de ticket
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
 * Met à jour les informations client (nom, prénom, email) des tickets associés à un checkout_id
 */
export async function updateTicketsCustomerInfo(
  app: FastifyInstance,
  checkoutId: string,
  customerInfo: {
    email?: string;
    first_name?: string;
    last_name?: string;
  }
): Promise<number> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Construire la requête de mise à jour dynamiquement
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (customerInfo.email) {
    updates.push(`email = $${paramIndex}`);
    params.push(customerInfo.email.trim());
    paramIndex++;
  }

  if (customerInfo.first_name !== undefined) {
    updates.push(`first_name = COALESCE($${paramIndex}, first_name)`);
    params.push(customerInfo.first_name || null);
    paramIndex++;
  }

  if (customerInfo.last_name !== undefined) {
    updates.push(`last_name = COALESCE($${paramIndex}, last_name)`);
    params.push(customerInfo.last_name || null);
    paramIndex++;
  }

  if (updates.length === 0) {
    return 0;
  }

  updates.push(`updated_at = current_timestamp`);
  params.push(checkoutId);

  // Mettre à jour tous les tickets associés à ce checkout
  const result = await app.pg.query<{ count: string }>(
    `UPDATE tickets 
     SET ${updates.join(', ')}
     WHERE checkout_id = $${paramIndex}
     RETURNING id`,
    params
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

  // Statistiques totales (tous les tickets avec status = 'paid' ou 'used')
  const totalResult = await app.pg.query<{ count: string }>(
    `SELECT 
      COUNT(*) as count
     FROM tickets 
     WHERE status IN ('paid', 'used')`
  );
  const totalTicketsSold = parseInt(totalResult.rows[0].count, 10);

  // Statistiques de la semaine (tickets payés ou utilisés depuis le début de la semaine)
  const weekResult = await app.pg.query<{ count: string }>(
    `SELECT 
      COUNT(*) as count
     FROM tickets 
     WHERE status IN ('paid', 'used') 
     AND created_at >= $1`,
    [weekStartStr]
  );
  const weekTicketsSold = parseInt(weekResult.rows[0].count, 10);

  // Statistiques par jour de la semaine
  const weekByDayResult = await app.pg.query<{
    date: string;
    count: string;
  }>(
    `SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
     FROM tickets 
     WHERE status IN ('paid', 'used') 
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
    };
  });

  // Total des dons reçus sur les tickets payés ou utilisés
  const donationsResult = await app.pg.query<{ total: string }>(
    `SELECT 
      COALESCE(SUM(donation_amount), 0) as total
     FROM tickets 
     WHERE status IN ('paid', 'used')`
  );
  const totalDonations = parseFloat(donationsResult.rows[0].total || '0');

  // Coût moyen d'un ticket (ticket_price) pour les tickets payés ou utilisés
  const avgPriceResult = await app.pg.query<{ avg: string }>(
    `SELECT 
      COALESCE(AVG(ticket_price), 0) as avg
     FROM tickets 
     WHERE status IN ('paid', 'used')`
  );
  const averageTicketPrice = parseFloat(avgPriceResult.rows[0].avg || '0');

  // Statistiques par horaire - compter les tickets actifs à chaque heure
  // Un ticket est actif à une heure s'il commence avant ou à cette heure
  // et se termine après cette heure (jauge horaire indépendante, sans chevauchement)
  const hourlyResult = await app.pg.query<{
    start_time: string;
    count: string;
  }>(
    `WITH hours AS (
      -- Générer toutes les heures de 0h à 23h
      SELECT generate_series(0, 23) as hour
    )
    SELECT 
      LPAD(h.hour::text, 2, '0') || ':00:00' as start_time,
      COUNT(DISTINCT t.id) as count
    FROM hours h
    LEFT JOIN tickets t ON 
      t.status IN ('paid', 'used')
      AND t.slot_start_time::time <= (LPAD(h.hour::text, 2, '0') || ':00:00')::time
      AND t.slot_end_time::time > (LPAD(h.hour::text, 2, '0') || ':00:00')::time
    GROUP BY h.hour
    HAVING COUNT(DISTINCT t.id) > 0
    ORDER BY count DESC, start_time ASC`
  );

  const hourlyStats = hourlyResult.rows.map((row) => ({
    start_time: row.start_time,
    tickets_count: parseInt(row.count, 10),
    percentage: totalTicketsSold > 0
      ? Math.round((parseInt(row.count, 10) / totalTicketsSold) * 100 * 100) / 100
      : 0,
  }));

  // Statistiques sur les réservations groupées (même checkout_reference)
  // Seulement les tickets avec checkout_reference non null, payés ou utilisés
  const groupedCheckoutsResult = await app.pg.query<{
    checkout_reference: string;
    count: string;
  }>(
    `SELECT 
      checkout_reference,
      COUNT(*) as count
     FROM tickets 
     WHERE checkout_reference IS NOT NULL
       AND status IN ('paid', 'used')
     GROUP BY checkout_reference`
  );

  const checkoutCounts = groupedCheckoutsResult.rows.map((row) => parseInt(row.count, 10));
  const totalCheckouts = checkoutCounts.length;
  const averageTicketsPerCheckout = totalCheckouts > 0
    ? checkoutCounts.reduce((sum, count) => sum + count, 0) / totalCheckouts
    : 0;
  const maxTicketsInCheckout = checkoutCounts.length > 0
    ? Math.max(...checkoutCounts)
    : 0;

  // Distribution du nombre de tickets par checkout
  const distributionMap = new Map<number, number>();
  checkoutCounts.forEach((count) => {
    distributionMap.set(count, (distributionMap.get(count) || 0) + 1);
  });

  const checkoutDistribution = Array.from(distributionMap.entries())
    .map(([tickets_count, checkouts_count]) => ({
      tickets_count,
      checkouts_count,
    }))
    .sort((a, b) => a.tickets_count - b.tickets_count);

  // Total des revenus (ticket_price + donation_amount) pour les tickets payés ou utilisés
  const revenueResult = await app.pg.query<{ total: string }>(
    `SELECT 
      COALESCE(SUM(ticket_price + donation_amount), 0) as total
     FROM tickets 
     WHERE status IN ('paid', 'used')`
  );
  const totalRevenue = parseFloat(revenueResult.rows[0].total || '0');

  // Taux de conversion (paid / (paid + pending)) en pourcentage
  const conversionResult = await app.pg.query<{
    paid: string;
    pending: string;
  }>(
    `SELECT 
      COUNT(*) FILTER (WHERE status = 'paid') as paid,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
     FROM tickets`
  );
  const paidCount = parseInt(conversionResult.rows[0].paid || '0', 10);
  const pendingCount = parseInt(conversionResult.rows[0].pending || '0', 10);
  const totalWithStatus = paidCount + pendingCount;
  const conversionRate = totalWithStatus > 0
    ? Math.round((paidCount / totalWithStatus) * 100 * 100) / 100
    : 0;

  // Répartition par statut
  const statusResult = await app.pg.query<{
    status: string;
    count: string;
  }>(
    `SELECT 
      status,
      COUNT(*) as count
     FROM tickets 
     GROUP BY status`
  );

  const statusDistribution: TicketsStats['status_distribution'] = {
    paid: 0,
    pending: 0,
    cancelled: 0,
    used: 0,
    expired: 0,
  };

  statusResult.rows.forEach((row) => {
    const status = row.status as keyof typeof statusDistribution;
    if (status in statusDistribution) {
      statusDistribution[status] = parseInt(row.count, 10);
    }
  });

  return {
    total_tickets_sold: totalTicketsSold,
    week_tickets_sold: weekTicketsSold,
    week_tickets_by_day: weekTicketsByDay,
    total_donations: totalDonations,
    average_ticket_price: Math.round(averageTicketPrice * 100) / 100,
    hourly_stats: hourlyStats,
    grouped_reservations: {
      total_checkouts: totalCheckouts,
      average_tickets_per_checkout: Math.round(averageTicketsPerCheckout * 100) / 100,
      max_tickets_in_checkout: maxTicketsInCheckout,
      checkout_distribution: checkoutDistribution,
    },
    total_revenue: Math.round(totalRevenue * 100) / 100,
    conversion_rate: conversionRate,
    status_distribution: statusDistribution,
  };
}

/**
 * Compte le nombre de tickets payés ou utilisés qui commencent exactement à une heure donnée
 * Pas de chevauchement : on compte uniquement les tickets qui commencent à cette heure
 * Pour les statistiques, on ne compte que les tickets avec le statut 'paid' ou 'used'
 */
async function countTicketsActiveAtTime(
  app: FastifyInstance,
  date: string,
  startTime: string
): Promise<number> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Compter uniquement les tickets payés ou utilisés qui commencent exactement à startTime
  // Pas de chevauchement : chaque ticket n'est compté que dans le créneau où il commence
  // Pour les statistiques, on ne compte que les tickets payés et utilisés
  const result = await app.pg.query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM tickets 
     WHERE reservation_date = $1 
     AND status IN ('paid', 'used')
     AND slot_start_time = $2`,
    [date, startTime]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Récupère les statistiques des créneaux horaires pour la semaine courante
 * Pour chaque jour de la semaine (lundi-dimanche) et chaque start_time,
 * retourne le nombre de personnes attendues et le pourcentage d'occupation
 * par rapport à la capacité configurée (setting "capacity").
 * 
 * Pas de chevauchement : on compte uniquement les tickets qui commencent exactement
 * à l'heure de début du créneau. Chaque ticket n'est compté qu'une seule fois.
 */
export async function getWeeklySlotsStats(
  app: FastifyInstance
): Promise<WeeklySlotsStats> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = dimanche, 1 = lundi, etc.
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convertir dimanche en 6

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(0, 0, 0, 0);

  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // Récupérer la capacité depuis les settings
  const { getSettingValue } = await import('../settings/settings.service.ts');
  const dailyCapacity = (await getSettingValue<number>(app, 'capacity', 100)) || 100;

  const slotsStats: WeeklySlotStat[] = [];
  const dailyTotals: DailyTotal[] = [];

  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + i);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayName = dayNames[currentDate.getDay()];

    // Compter le nombre unique de tickets payés ou utilisés pour cette journée (sans double comptage)
    // Un ticket compte une seule fois par jour, indépendamment de sa durée
    const uniqueTicketsResult = await app.pg.query<{ count: string }>(
      `SELECT COUNT(DISTINCT id) as count
       FROM tickets 
       WHERE reservation_date = $1 
       AND status IN ('paid', 'used')`,
      [dateStr]
    );
    const totalUniqueTickets = parseInt(uniqueTicketsResult.rows[0].count, 10);

    dailyTotals.push({
      date: dateStr,
      day_name: dayName,
      total_unique_tickets: totalUniqueTickets,
    });

    // Récupérer les slots pour cette date pour connaître les heures de début possibles
    const slotsResponse = await getSlotsForDate(app, dateStr);

    // Pour chaque slot, compter uniquement les tickets qui commencent à cette heure
    // Pas de chevauchement : chaque ticket n'est compté que dans le créneau où il commence
    for (const slot of slotsResponse.slots) {
      const expectedPeople = await countTicketsActiveAtTime(
        app,
        dateStr,
        slot.start_time
      );

      const occupancyPercentage = dailyCapacity > 0
        ? Math.round((expectedPeople / dailyCapacity) * 100)
        : 0;

      slotsStats.push({
        date: dateStr,
        day_name: dayName,
        start_time: slot.start_time,
        end_time: slot.end_time,
        expected_people: expectedPeople,
        capacity: dailyCapacity,
        occupancy_percentage: occupancyPercentage,
        is_half_price: slot.is_half_price,
      });
    }
  }

  return {
    week_start: weekStartStr,
    week_end: weekEndStr,
    slots_stats: slotsStats,
    daily_totals: dailyTotals,
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
    // Filtrer exactement sur le créneau (début ET fin correspondent)
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

