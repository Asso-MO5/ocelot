import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { getAdultAccessOption, validateTicket } from './tickets.service.ts';
import { generateTicketViewHTML, getTicketQRCodeColor } from './tickets.email.ts';
import type { Ticket } from './tickets.types.ts';

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
  test('expose uniquement la configuration publique de l’option majeure', async () => {
    const app = {
      pg: {
        query: async () => ({
          rows: [{
            key: 'adult_access_option',
            value: '{"enabled":true,"amount":4.5,"label":"Accès 18+"}',
            value_type: 'json',
          }],
        }),
      },
      log: { info: () => undefined, warn: () => undefined, error: () => undefined },
    } as unknown as FastifyInstance;

    assert.deepEqual(await getAdultAccessOption(app), {
      enabled: true,
      amount: 4.5,
      label: 'Accès 18+',
    });
  });

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

  test('annonce l’option souscrite et réserve le rouge au QR concerné', async () => {
    const ticket = {
      id: 'ticket',
      qr_code: 'ABCD1234',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.test',
      reservation_date: '2026-10-01',
      slot_start_time: '10:00:00',
      slot_end_time: '11:00:00',
      checkout_id: null,
      checkout_reference: null,
      transaction_status: null,
      ticket_price: 10,
      donation_amount: 0,
      guided_tour_price: 0,
      adult_access: true,
      adult_access_amount: 4.5,
      adult_access_label: 'Accès 18+',
      total_amount: 14.5,
      status: 'paid',
      used_at: null,
      notes: null,
      language: 'fr',
      created_at: '2026-09-29T00:00:00.000Z',
      updated_at: '2026-09-29T00:00:00.000Z',
    } satisfies Ticket;

    assert.equal(getTicketQRCodeColor(ticket), '#B91C1C');
    assert.equal(getTicketQRCodeColor({ adult_access: false }), undefined);

    const html = await generateTicketViewHTML(ticket, true);
    assert.match(html, /Option souscrite : accès à la zone réservée aux majeurs inclus\./);
    assert.match(html, /#B91C1C/);
    assert.match(html, /Accès 18\+/);
  });
});
