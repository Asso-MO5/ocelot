import type { FastifyInstance } from 'fastify';

type IdentityProvider = 'discord' | 'zitadel';

async function saveUserByIdentity(
  app: FastifyInstance,
  provider: IdentityProvider,
  subject: string,
  name: string
): Promise<{ id: string } | null> {
  const column = provider === 'zitadel' ? 'zitadel_subject' : 'discord_id';

  if (!app.pg) {
    app.log.debug('Base de données non disponible, utilisateur non sauvegardé');
    return null;
  }

  try {
    await app.pg.query(
      `INSERT INTO users (${column}, name)
       VALUES ($1, $2)
       ON CONFLICT (${column})
       DO UPDATE SET name = $2, updated_at = current_timestamp`,
      [subject, name]
    );
  } catch (err) {
    app.log.error({ err, provider, subject, name }, 'Erreur lors de la sauvegarde de l\'utilisateur');
  }

  try {
    const user = await app.pg.query(
      `SELECT * FROM users WHERE ${column} = $1`,
      [subject]
    );
    return user.rows[0];
  } catch (err) {
    app.log.error({ err, provider, subject }, 'Erreur lors de la récupération de l\'utilisateur');
    return null;
  }
}

export function saveUserIfNotExists(
  app: FastifyInstance,
  discordId: string,
  name: string
): Promise<{ id: string } | null> {
  return saveUserByIdentity(app, 'discord', discordId, name);
}

export function saveZitadelUserIfNotExists(
  app: FastifyInstance,
  subject: string,
  name: string
): Promise<{ id: string } | null> {
  return saveUserByIdentity(app, 'zitadel', subject, name);
}
