import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { validateTicket } from './tickets.service.ts';

function appFor(ticket: Record<string, unknown>) {
  const queries: string[] = [];
  return {
    app: {
      pg: {
        query: async (sql: string) => {
          queries.push(sql);
          return { rows: [ticket] };
        },
      },
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    } as unknown as FastifyInstance,
    queries,
  };
}

describe('Contrôle de zone réservée aux majeurs', () => {
  test('accepte un billet payé avec option, même après le scan d’entrée, sans le consommer', async () => {
    const ticket = { id: 'ticket', qr_code: 'ABCD1234', status: 'used', adult_access: true };
    const { app, queries } = appFor(ticket);

    const result = await validateTicket(app, 'ABCD1234', 30, 'adult_zone');

    assert.equal(result, ticket);
    assert.equal(queries.length, 1);
    assert.match(queries[0], /SELECT \* FROM tickets/);
  });

  test('refuse un billet sans option majeure', async () => {
    const { app } = appFor({ id: 'ticket', qr_code: 'ABCD1234', status: 'paid', adult_access: false });

    await assert.rejects(
      validateTicket(app, 'ABCD1234', 30, 'adult_zone'),
      /"code":403/,
    );
  });
});
