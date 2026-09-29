import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { registerDocsRoutes } from './docs.ctrl.ts';

interface MockWithTracking {
  (...args: unknown[]): unknown;
  calls: unknown[][];
}

function createMockFn(): MockWithTracking {
  const fn = ((...args: unknown[]) => {
    fn.calls.push(args);
    return fn;
  }) as MockWithTracking;
  fn.calls = [];
  return fn;
}

function createMockApp(): FastifyInstance & { handlers: Record<string, Function> } {
  const handlers: Record<string, Function> = {};
  return {
    get: (path: string, handler: Function) => {
      handlers[path] = handler;
    },
    handlers,
    log: { error: () => undefined },
  } as unknown as FastifyInstance & { handlers: Record<string, Function> };
}

function createMockReply() {
  return {
    type: createMockFn(),
    code: createMockFn(),
    redirect: createMockFn(),
  } as unknown as FastifyReply & {
    type: MockWithTracking;
    code: MockWithTracking;
    redirect: MockWithTracking;
  };
}

function createTestDocsDirectory(t: { after: (callback: () => void) => void }): string {
  const directory = mkdtempSync(join(tmpdir(), 'ocelot-docs-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function handlerFor(app: ReturnType<typeof createMockApp>, path: string): Function {
  const handler = app.handlers[path];
  assert.ok(handler, `Handler ${path} not found`);
  return handler;
}

describe('Docs Controller', () => {
  test('retourne le JSON OpenAPI depuis le répertoire de documentation injecté', async (t) => {
    const docsDirectory = createTestDocsDirectory(t);
    const content = { openapi: '3.0.0', info: { title: 'Test API' } };
    writeFileSync(join(docsDirectory, 'openapi.json'), JSON.stringify(content));

    const app = createMockApp();
    registerDocsRoutes(app, docsDirectory);
    const reply = createMockReply();
    const result = await handlerFor(app, '/docs/openapi.json')({}, reply);

    assert.deepEqual(result, content);
    assert.deepEqual(reply.type.calls, [['application/json']]);
  });

  test('retourne une erreur contrôlée si le JSON OpenAPI est absent ou invalide', async (t) => {
    const docsDirectory = createTestDocsDirectory(t);
    const app = createMockApp();
    registerDocsRoutes(app, docsDirectory);

    const absentReply = createMockReply();
    assert.deepEqual(await handlerFor(app, '/docs/openapi.json')({}, absentReply), {
      error: 'Impossible de charger la documentation OpenAPI',
    });
    assert.deepEqual(absentReply.code.calls, [[500]]);

    writeFileSync(join(docsDirectory, 'openapi.json'), 'invalid json');
    const invalidReply = createMockReply();
    assert.deepEqual(await handlerFor(app, '/docs/openapi.json')({}, invalidReply), {
      error: 'Impossible de charger la documentation OpenAPI',
    });
    assert.deepEqual(invalidReply.code.calls, [[500]]);
  });

  test('retourne le YAML et le HTML avec leur type MIME', async (t) => {
    const docsDirectory = createTestDocsDirectory(t);
    const yaml = 'openapi: 3.0.0';
    const html = '<html><body>Documentation</body></html>';
    writeFileSync(join(docsDirectory, 'openapi.yaml'), yaml);
    writeFileSync(join(docsDirectory, 'index.html'), html);

    const app = createMockApp();
    registerDocsRoutes(app, docsDirectory);

    const yamlReply = createMockReply();
    assert.equal(await handlerFor(app, '/docs/openapi.yaml')({}, yamlReply), yaml);
    assert.deepEqual(yamlReply.type.calls, [['text/yaml']]);

    const htmlReply = createMockReply();
    assert.equal(await handlerFor(app, '/docs')({}, htmlReply), html);
    assert.deepEqual(htmlReply.type.calls, [['text/html']]);
  });

  test('retourne une erreur contrôlée si le YAML ou le HTML est absent', async (t) => {
    const docsDirectory = createTestDocsDirectory(t);
    const app = createMockApp();
    registerDocsRoutes(app, docsDirectory);

    const yamlReply = createMockReply();
    assert.deepEqual(await handlerFor(app, '/docs/openapi.yaml')({}, yamlReply), {
      error: 'Impossible de charger la documentation OpenAPI',
    });
    assert.deepEqual(yamlReply.code.calls, [[500]]);

    const htmlReply = createMockReply();
    assert.deepEqual(await handlerFor(app, '/docs')({}, htmlReply), {
      error: 'Impossible de charger la documentation',
    });
    assert.deepEqual(htmlReply.code.calls, [[500]]);
  });

  test('redirige /docs/ vers /docs', async (t) => {
    const docsDirectory = createTestDocsDirectory(t);
    const app = createMockApp();
    registerDocsRoutes(app, docsDirectory);
    const reply = createMockReply();

    await handlerFor(app, '/docs/')({}, reply);

    assert.deepEqual(reply.redirect.calls, [['/docs']]);
  });
});
