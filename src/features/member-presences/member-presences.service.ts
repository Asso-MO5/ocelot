import type { FastifyInstance } from 'fastify';
import type {
  MemberPresence,
  UpsertPresenceBody,
  GetPresencesQuery,
  PresencesResponse,
  PresenceDay,
} from './member-presences.types.ts';

/**
 * Récupère l'ID utilisateur depuis discord_id
 */
async function getUserIdFromDiscordId(
  app: FastifyInstance,
  discordId: string
): Promise<string | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<{ id: string }>(
    `SELECT id FROM users WHERE discord_id = $1`,
    [discordId]
  );

  return result.rows[0]?.id ?? null;
}

/**
 * Crée ou met à jour une présence pour un membre
 */
export async function upsertPresence(
  app: FastifyInstance,
  discordId: string,
  data: UpsertPresenceBody
): Promise<MemberPresence> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Récupérer l'ID utilisateur depuis discord_id
  const userId = await getUserIdFromDiscordId(app, discordId);
  if (!userId) {
    throw new Error('Utilisateur non trouvé');
  }

  // Vérifier que la date est valide
  const date = new Date(data.date);
  if (isNaN(date.getTime())) {
    throw new Error('Date invalide');
  }

  // Créer ou mettre à jour la présence
  const result = await app.pg.query<MemberPresence & { user_name: string }>(
    `INSERT INTO member_presences (user_id, date, period, refused_by_admin)
     VALUES ($1, $2, $3, false)
     ON CONFLICT (user_id, date)
     DO UPDATE SET
       period = EXCLUDED.period,
       updated_at = current_timestamp
     RETURNING 
       member_presences.*,
       (SELECT name FROM users WHERE id = member_presences.user_id) as user_name`,
    [userId, data.date, data.period]
  );

  const presence = result.rows[0];
  return {
    id: presence.id,
    user_id: presence.user_id,
    user_name: presence.user_name,
    date: presence.date,
    period: presence.period,
    refused_by_admin: presence.refused_by_admin,
    created_at: presence.created_at,
    updated_at: presence.updated_at,
  };
}

/**
 * Récupère les présences pour un membre (ses propres présences)
 */
export async function getPresencesForMember(
  app: FastifyInstance,
  discordId: string,
  query: GetPresencesQuery
): Promise<PresencesResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Récupérer l'ID utilisateur depuis discord_id
  const userId = await getUserIdFromDiscordId(app, discordId);
  if (!userId) {
    throw new Error('Utilisateur non trouvé');
  }

  const startDate = new Date(query.start_date);
  const endDate = query.end_date ? new Date(query.end_date) : new Date(query.start_date);

  // Générer tous les jours de la plage
  const days: PresenceDay[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayName = dayNames[currentDate.getDay()];

    days.push({
      date: dateStr,
      day_name: dayName,
      presences: [],
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Récupérer les présences pour cette plage
  const result = await app.pg.query<MemberPresence & { user_name: string }>(
    `SELECT 
       mp.id,
       mp.user_id,
       mp.period,
       mp.refused_by_admin,
       mp.created_at,
       mp.updated_at,
       TO_CHAR(mp.date, 'YYYY-MM-DD') as date,
       u.name as user_name
     FROM member_presences mp
     JOIN users u ON u.id = mp.user_id
     WHERE mp.user_id = $1
       AND mp.date BETWEEN $2 AND $3
     ORDER BY mp.date ASC`,
    [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
  );

  // Organiser les présences par jour
  const presencesByDate = new Map<string, MemberPresence[]>();
  for (const row of result.rows) {
    // La date est déjà formatée en string par TO_CHAR
    const dateStr = String(row.date);

    if (!presencesByDate.has(dateStr)) {
      presencesByDate.set(dateStr, []);
    }
    presencesByDate.get(dateStr)!.push({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      date: dateStr,
      period: row.period,
      refused_by_admin: row.refused_by_admin,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  // Remplir les jours avec les présences
  for (const day of days) {
    day.presences = presencesByDate.get(day.date) ?? [];
  }

  return {
    days,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  };
}

/**
 * Récupère toutes les présences (pour bureau et dev)
 */
export async function getAllPresences(
  app: FastifyInstance,
  query: GetPresencesQuery
): Promise<PresencesResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const startDate = new Date(query.start_date);
  const endDate = query.end_date ? new Date(query.end_date) : new Date(query.start_date);

  // Générer tous les jours de la plage
  const days: PresenceDay[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayName = dayNames[currentDate.getDay()];

    days.push({
      date: dateStr,
      day_name: dayName,
      presences: [],
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Récupérer toutes les présences pour cette plage
  const result = await app.pg.query<MemberPresence & { user_name: string }>(
    `SELECT 
       mp.id,
       mp.user_id,
       mp.period,
       mp.refused_by_admin,
       mp.created_at,
       mp.updated_at,
       TO_CHAR(mp.date, 'YYYY-MM-DD') as date,
       u.name as user_name
     FROM member_presences mp
     JOIN users u ON u.id = mp.user_id
     WHERE mp.date BETWEEN $1 AND $2
     ORDER BY mp.date ASC, u.name ASC`,
    [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
  );

  // Organiser les présences par jour
  const presencesByDate = new Map<string, MemberPresence[]>();
  for (const row of result.rows) {
    // La date est déjà formatée en string par TO_CHAR
    const dateStr = String(row.date);

    if (!presencesByDate.has(dateStr)) {
      presencesByDate.set(dateStr, []);
    }
    presencesByDate.get(dateStr)!.push({
      id: row.id,
      user_id: row.user_id,
      user_name: row.user_name,
      date: dateStr,
      period: row.period,
      refused_by_admin: row.refused_by_admin,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }

  // Remplir les jours avec les présences
  for (const day of days) {
    day.presences = presencesByDate.get(day.date) ?? [];
  }

  return {
    days,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  };
}

/**
 * Refuse ou accepte une présence (admin uniquement)
 */
export async function refusePresence(
  app: FastifyInstance,
  presenceId: string,
  refused: boolean
): Promise<MemberPresence> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<MemberPresence & { user_name: string }>(
    `UPDATE member_presences
     SET refused_by_admin = $1, updated_at = current_timestamp
     WHERE id = $2
     RETURNING 
       member_presences.*,
       (SELECT name FROM users WHERE id = member_presences.user_id) as user_name`,
    [refused, presenceId]
  );

  if (result.rows.length === 0) {
    throw new Error('Présence non trouvée');
  }

  const presence = result.rows[0];
  return {
    id: presence.id,
    user_id: presence.user_id,
    user_name: presence.user_name,
    date: presence.date,
    period: presence.period,
    refused_by_admin: presence.refused_by_admin,
    created_at: presence.created_at,
    updated_at: presence.updated_at,
  };
}

/**
 * Supprime une présence
 */
export async function deletePresence(
  app: FastifyInstance,
  presenceId: string,
  discordId: string,
  isAdmin: boolean
): Promise<boolean> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Vérifier que la présence existe et que l'utilisateur peut la supprimer
  const userId = await getUserIdFromDiscordId(app, discordId);
  if (!userId) {
    throw new Error('Utilisateur non trouvé');
  }

  // Si ce n'est pas un admin, vérifier que la présence appartient à l'utilisateur
  if (!isAdmin) {
    const checkResult = await app.pg.query<{ user_id: string }>(
      `SELECT user_id FROM member_presences WHERE id = $1`,
      [presenceId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Présence non trouvée');
    }

    if (checkResult.rows[0].user_id !== userId) {
      throw new Error('Vous ne pouvez supprimer que vos propres présences');
    }
  }

  const result = await app.pg.query(
    `DELETE FROM member_presences WHERE id = $1`,
    [presenceId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

