import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function registerDocsRoutes(app: FastifyInstance) {
  app.get('/docs/openapi.json', async (_req, reply) => {
    try {
      const docsPath = join(process.cwd(), 'docs/openapi.json');
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
      const docsPath = join(process.cwd(), 'docs/openapi.yaml');
      const content = readFileSync(docsPath, 'utf-8');

      reply.type('text/yaml');
      return content;
    } catch (error) {
      reply.code(500);
      return { error: 'Impossible de charger la documentation OpenAPI' };
    }
  });

  app.get('/docs', async (_req, reply) => {
    try {
      const docsPath = join(process.cwd(), 'docs/index.html');
      const content = readFileSync(docsPath, 'utf-8');

      reply.type('text/html');
      return content;
    } catch (error) {
      reply.code(500);
      return { error: 'Impossible de charger la documentation' };
    }
  });

  app.get('/docs/', async (_req, reply) => {
    return reply.redirect('/docs');
  });
}

