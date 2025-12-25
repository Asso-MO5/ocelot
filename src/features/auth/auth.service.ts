import type { FastifyInstance } from 'fastify';

export async function saveUserIfNotExists(
  app: FastifyInstance,
  discordId: string,
  name: string
): Promise<void> {
  if (!app.pg) {
    app.log.debug('Base de données non disponible, utilisateur non sauvegardé');
    return;
  }

  try {
    await app.pg.query(
      `INSERT INTO users (discord_id, name)
       VALUES ($1, $2)
       ON CONFLICT (discord_id) 
       DO UPDATE SET name = $2, updated_at = current_timestamp`,
      [discordId, name]
    );
  } catch (err) {
    app.log.error({ err, discordId, name }, 'Erreur lors de la sauvegarde de l\'utilisateur');
  }
}

