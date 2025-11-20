import type { FastifyInstance } from 'fastify';
import type {
  Ticket,
  CreateTicketBody,
  CreateTicketsWithPaymentBody,
  UpdateTicketBody,
  GetTicketsQuery,
  TicketsStats,
  TicketsStatsByDay,
} from './tickets.types.ts';
import { createSumUpCheckout } from '../pay/pay.utils.ts';

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

  // Générer un code QR unique
  const qrCode = await generateUniqueQRCode(app);

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
      data.notes ?? null,
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
): Promise<{ checkout_id: string; checkout_reference: string; tickets: Ticket[] }> {
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

  // Calculer le montant total (somme de tous les ticket_price + donation_amount)
  let totalAmount = 0;
  for (const ticket of data.tickets) {
    if (ticket.ticket_price < 0) {
      throw new Error('Le prix du ticket doit être positif ou nul');
    }
    const donationAmount = ticket.donation_amount ?? 0;
    if (donationAmount < 0) {
      throw new Error('Le montant du don doit être positif ou nul');
    }
    totalAmount += ticket.ticket_price + donationAmount;
  }

  if (totalAmount <= 0) {
    throw new Error('Le montant total doit être supérieur à 0');
  }

  // Validation des dates et heures pour tous les tickets
  for (const ticket of data.tickets) {
    if (!ticket.reservation_date) {
      throw new Error('La date de réservation est obligatoire pour tous les tickets');
    }
    if (!ticket.slot_start_time || !ticket.slot_end_time) {
      throw new Error('Les heures de début et de fin du créneau sont obligatoires pour tous les tickets');
    }
    // Validation : heure de fin doit être après l'heure de début
    const startTime = new Date(`2000-01-01T${ticket.slot_start_time}`);
    const endTime = new Date(`2000-01-01T${ticket.slot_end_time}`);
    if (startTime >= endTime) {
      throw new Error('L\'heure de fin doit être postérieure à l\'heure de début pour tous les tickets');
    }
  }

  // Créer le checkout SumUp
  const currency = data.currency || 'EUR';
  const description = data.description || `Réservation de ${data.tickets.length} ticket(s)`;

  const checkout = await createSumUpCheckout(
    app,
    totalAmount,
    description,
    currency
  );

  // Créer tous les tickets dans une transaction
  const createdTickets: Ticket[] = [];

  try {
    // Utiliser une transaction pour garantir que tous les tickets sont créés ou aucun
    await app.pg.query('BEGIN');

    for (const ticketData of data.tickets) {
      const donationAmount = ticketData.donation_amount ?? 0;
      const ticketTotalAmount = ticketData.ticket_price + donationAmount;

      // Générer un code QR unique pour chaque ticket
      const qrCode = await generateUniqueQRCode(app);

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
          checkout.id,
          checkout.checkout_reference,
          checkout.status,
          ticketData.ticket_price,
          donationAmount,
          ticketTotalAmount,
          'pending', // Statut initial
          ticketData.notes ?? null,
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

  return {
    checkout_id: checkout.id,
    checkout_reference: checkout.checkout_reference,
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

