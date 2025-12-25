import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { registerDocsRoutes } from './docs.ctrl.ts';

interface MockWithTracking {
  (...args: any[]): any;
  mock: {
    calls: any[][];
    callCount(): number;
  };
}

function createMockFn(returnValue?: any, chainTarget?: any): MockWithTracking {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return returnValue ?? chainTarget ?? fn;
  }) as MockWithTracking;
  fn.mock = {
    calls,
    callCount: () => calls.length,
  };
  return fn;
}

function createMockApp(): FastifyInstance & { handlers: Record<string, any> } {
  const handlers: Record<string, any> = {};

  const app: any = {
    get: (path: string, handler: any) => {
      handlers[path] = handler;
    },
    handlers,
  };

  return app as unknown as FastifyInstance & { handlers: Record<string, any> };
}

function createMockReply(): FastifyReply & {
  type: MockWithTracking;
  code: MockWithTracking;
  redirect: MockWithTracking;
} {
  const reply = {} as any;

  reply.type = createMockFn(reply, reply);
  reply.code = createMockFn(reply, reply);
  reply.redirect = createMockFn(reply, reply);

  return reply as FastifyReply & {
    type: MockWithTracking;
    code: MockWithTracking;
    redirect: MockWithTracking;
  };
}

describe('Docs Controller', () => {
  const testDocsDir = join(process.cwd(), 'test-docs');
  const originalCwd = process.cwd();

  beforeEach(() => {
    if (!existsSync(testDocsDir)) {
      mkdirSync(testDocsDir, { recursive: true });
    }
    process.chdir(testDocsDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDocsDir)) {
      try {
        rmSync(testDocsDir, { recursive: true, force: true });
      } catch (error: any) {
        if (error.code !== 'ENOENT' && error.code !== 'EPERM') {
          throw error;
        }
      }
    }
  });

  describe('GET /docs/openapi.json', () => {
    test('devrait retourner le contenu JSON de la documentation', async () => {
      const docsDir = join(testDocsDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      const openapiContent = { openapi: '3.0.0', info: { title: 'Test API' } };
      writeFileSync(join(docsDir, 'openapi.json'), JSON.stringify(openapiContent));

      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs/openapi.json'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      const result = await handler({}, reply);

      assert.equal(reply.type.mock.callCount(), 1);
      assert.equal(reply.type.mock.calls[0][0], 'application/json');
      assert.deepEqual(result, openapiContent);
    });

    test('devrait retourner une erreur 500 si le fichier n\'existe pas', async () => {
      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs/openapi.json'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      const result = await handler({}, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      assert.equal(result.error, 'Impossible de charger la documentation OpenAPI');
    });

    test('devrait retourner une erreur 500 si le JSON est invalide', async () => {
      const docsDir = join(testDocsDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      writeFileSync(join(docsDir, 'openapi.json'), 'invalid json content');

      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs/openapi.json'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      const result = await handler({}, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      assert.equal(result.error, 'Impossible de charger la documentation OpenAPI');
    });
  });

  describe('GET /docs/openapi.yaml', () => {
    test('devrait retourner le contenu YAML de la documentation', async () => {
      const docsDir = join(testDocsDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      const yamlContent = 'openapi: 3.0.0\ninfo:\n  title: Test API';
      writeFileSync(join(docsDir, 'openapi.yaml'), yamlContent);

      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs/openapi.yaml'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      const result = await handler({}, reply);

      assert.equal(reply.type.mock.callCount(), 1);
      assert.equal(reply.type.mock.calls[0][0], 'text/yaml');
      assert.equal(result, yamlContent);
    });

    test('devrait retourner une erreur 500 si le fichier n\'existe pas', async () => {
      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs/openapi.yaml'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      const result = await handler({}, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      assert.equal(result.error, 'Impossible de charger la documentation OpenAPI');
    });
  });

  describe('GET /docs', () => {
    test('devrait retourner le contenu HTML de la documentation', async () => {
      const docsDir = join(testDocsDir, 'docs');
      mkdirSync(docsDir, { recursive: true });

      const htmlContent = '<html><body>Documentation</body></html>';
      writeFileSync(join(docsDir, 'index.html'), htmlContent);

      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      const result = await handler({}, reply);

      assert.equal(reply.type.mock.callCount(), 1);
      assert.equal(reply.type.mock.calls[0][0], 'text/html');
      assert.equal(result, htmlContent);
    });

    test('devrait retourner une erreur 500 si le fichier n\'existe pas', async () => {
      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      const result = await handler({}, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      assert.equal(result.error, 'Impossible de charger la documentation');
    });
  });

  describe('GET /docs/', () => {
    test('devrait rediriger vers /docs', async () => {
      const app = createMockApp();
      registerDocsRoutes(app);

      const handler = app.handlers['/docs/'];
      if (!handler) {
        throw new Error('Handler not found');
      }

      const reply = createMockReply();
      await handler({}, reply);

      assert.equal(reply.redirect.mock.callCount(), 1);
      assert.equal(reply.redirect.mock.calls[0][0], '/docs');
    });
  });
});

