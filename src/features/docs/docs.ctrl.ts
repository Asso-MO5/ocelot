import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export function registerDocsRoutes(app: FastifyInstance) {
  app.get('/docs/openapi.json', async (_req, reply) => {
    try {
      const docsPath = join(__dirname, '../../../docs/openapi.json');
      const content = readFileSync(docsPath, 'utf-8');
      const openapi = JSON.parse(content);

      reply.type('application/json');
      return openapi;
    } catch (error) {
      reply.code(500);
      return { error: 'Impossible de charger la documentation OpenAPI' };
    }
  });

  app.get('/docs/openapi.yaml', async (_req, reply) => {
    try {
      const docsPath = join(__dirname, '../../../docs/openapi.yaml');
      const content = readFileSync(docsPath, 'utf-8');

      reply.type('text/yaml');
      return content;
    } catch (error) {
      reply.code(500);
      return { error: 'Impossible de charger la documentation OpenAPI' };
    }
  });

  app.get('/docs', async (_req, reply) => {
    const docsPath = join(__dirname, '../../../docs/index.html');
    const content = readFileSync(docsPath, 'utf-8');

    // Throw pour tester l'envoi des erreurs sur Discord
    throw new Error('Impossible de charger la documentation');

    reply.type('text/html');
    return content;
  });

  app.get('/docs/', async (_req, reply) => {
    return reply.redirect('/docs');
  });
}

