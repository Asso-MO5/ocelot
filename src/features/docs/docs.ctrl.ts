import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Obtenir le répertoire du fichier source (fonctionne en ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chemin vers le dossier docs (relatif au fichier source)
// src/features/docs/docs.ctrl.ts -> docs/ (à la racine du projet)
const docsDir = join(__dirname, '../../..', 'docs');

export function registerDocsRoutes(app: FastifyInstance, documentationDirectory: string = docsDir) {
  app.get('/docs/openapi.json', async (_req, reply) => {
    try {
      const docsPath = join(documentationDirectory, 'openapi.json');
      const content = readFileSync(docsPath, 'utf-8');
      const openapi = JSON.parse(content);

      reply.type('application/json');
      return openapi;
    } catch (error) {
      app.log.error({ err: error, path: join(documentationDirectory, 'openapi.json') }, 'Erreur lors du chargement de la documentation OpenAPI JSON');
      reply.code(500);
      return { error: 'Impossible de charger la documentation OpenAPI' };
    }
  });

  app.get('/docs/openapi.yaml', async (_req, reply) => {
    try {
      const docsPath = join(documentationDirectory, 'openapi.yaml');
      const content = readFileSync(docsPath, 'utf-8');

      reply.type('text/yaml');
      return content;
    } catch (error) {
      app.log.error({ err: error, path: join(documentationDirectory, 'openapi.yaml') }, 'Erreur lors du chargement de la documentation OpenAPI YAML');
      reply.code(500);
      return { error: 'Impossible de charger la documentation OpenAPI' };
    }
  });

  app.get('/docs', async (_req, reply) => {
    try {
      const docsPath = join(documentationDirectory, 'index.html');
      const content = readFileSync(docsPath, 'utf-8');

      reply.type('text/html');
      return content;
    } catch (error) {
      app.log.error({ err: error, path: join(documentationDirectory, 'index.html') }, 'Erreur lors du chargement de la documentation HTML');
      reply.code(500);
      return { error: 'Impossible de charger la documentation' };
    }
  });

  app.get('/docs/', async (_req, reply) => {
    return reply.redirect('/docs');
  });
}
