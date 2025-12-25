import type { FastifyInstance } from 'fastify';
import type { ErrorContext } from './error.types.ts';
import { createHash } from 'node:crypto';

async function sendErrorToDiscord(
  app: FastifyInstance,
  error: Error,
  context?: ErrorContext
) {
  const webhookUrl = process.env.DISCORD_LOG_WEBHOOK_URL;

  if (!webhookUrl) {
    app.log.warn('DISCORD_LOG_WEBHOOK_URL non configuré, erreur non envoyée à Discord');
    return;
  }

  try {
    const statusCode = (error as any).statusCode || 500;
    const errorName = error.name || 'Error';
    const errorMessage = error.message || 'Une erreur est survenue';
    const stack = error.stack || 'Pas de stack trace disponible';

    const embed = {
      title: `🚨 Erreur ${statusCode}: ${errorName}`,
      description: `\`\`\`${errorMessage}\`\`\``,
      color: statusCode >= 500 ? 0xff0000 : 0xffaa00,
      fields: [
        {
          name: 'URL',
          value: context?.url || 'N/A',
          inline: true,
        },
        {
          name: 'Méthode',
          value: context?.method || 'N/A',
          inline: true,
        },
        {
          name: 'IP',
          value: context?.ip || 'N/A',
          inline: true,
        },
        {
          name: 'Type',
          value: context?.type || 'Route Error',
          inline: false,
        },
        {
          name: 'Stack Trace',
          value: `\`\`\`${stack.substring(0, 1000)}\`\`\``,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const payload = {
      username: 'Ocelot Log',
      embeds: [embed],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      app.log.error({ status: response.status, errorText }, 'Webhook Discord a retourné une erreur');
      throw new Error(`Webhook Discord a retourné ${response.status}: ${errorText}`);
    }
  } catch (err) {
    app.log.error({ err }, 'Erreur lors de l\'envoi au webhook Discord');
  }
}

function generateErrorHash(error: Error, context?: ErrorContext): string {
  const hashInput = `${error.name}:${error.message}:${error.stack?.substring(0, 500)}:${context?.type || 'Route Error'}`;
  return createHash('sha256').update(hashInput).digest('hex');
}

async function isDuplicateError(
  app: FastifyInstance,
  errorHash: string,
  duplicateWindowHours: number = 1
): Promise<boolean> {
  if (!app.pg) {
    return false;
  }

  try {
    const result = await app.pg.query(
      `SELECT COUNT(*) as count 
       FROM errors 
       WHERE error_hash = $1 
       AND created_at > NOW() - ($2 || ' hours')::INTERVAL`,
      [errorHash, duplicateWindowHours.toString()]
    );

    return parseInt(result.rows[0].count, 10) > 0;
  } catch (err) {
    app.log.error({ err }, 'Erreur lors de la vérification de doublon');
    return false;
  }
}

async function saveErrorToDatabase(
  app: FastifyInstance,
  error: Error,
  context?: ErrorContext
): Promise<{ isDuplicate: boolean; errorId?: string }> {
  if (!app.pg) {
    app.log.debug('Base de données non disponible, erreur non sauvegardée');
    return { isDuplicate: false };
  }

  try {
    const statusCode = (error as any).statusCode || 500;
    const errorName = error.name || 'Error';
    const errorMessage = error.message || 'Une erreur est survenue';
    const stack = error.stack || null;
    const errorHash = generateErrorHash(error, context);

    const duplicateWindowHours = parseInt(process.env.ERROR_DUPLICATE_WINDOW_HOURS || '1', 10);
    const isDuplicate = await isDuplicateError(app, errorHash, duplicateWindowHours);

    const result = await app.pg.query(
      `INSERT INTO errors (
        error_name, error_message, stack_trace, status_code,
        url, method, ip, error_type, error_hash, sent_to_discord
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        errorName,
        errorMessage,
        stack,
        statusCode,
        context?.url || null,
        context?.method || null,
        context?.ip || null,
        context?.type || 'Route Error',
        errorHash,
        false,
      ]
    );

    const errorId = result.rows[0].id;

    return { isDuplicate, errorId };
  } catch (err) {
    app.log.error({ err }, 'Erreur lors de la sauvegarde en base de données');
    return { isDuplicate: false };
  }
}


async function markErrorAsSentToDiscord(
  app: FastifyInstance,
  errorId: string
): Promise<void> {
  if (!app.pg || !errorId) {
    return;
  }

  try {
    await app.pg.query(
      'UPDATE errors SET sent_to_discord = true, updated_at = current_timestamp WHERE id = $1',
      [errorId]
    );
  } catch (err) {
    app.log.error({ err, errorId }, 'Erreur lors de la mise à jour du statut Discord');
  }
}


export async function handleError(
  app: FastifyInstance,
  error: Error,
  context?: ErrorContext
): Promise<void> {
  const { isDuplicate, errorId } = await saveErrorToDatabase(app, error, context);

  if (isDuplicate) {
    app.log.debug({ error: error.message, errorId }, 'Erreur dupliquée détectée, non envoyée à Discord');
    return;
  }

  try {
    await sendErrorToDiscord(app, error, context);

    if (errorId) {
      await markErrorAsSentToDiscord(app, errorId);
    }
  } catch (err) {
    app.log.error({ err }, 'Erreur lors de l\'envoi au webhook Discord');
  }
}

