import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createTicketHandler,
  getTicketByIdHandler,
  validateTicketHandler,
  updateTicketHandler,
  deleteTicketHandler,
  resendTicketsByCheckoutIdHandler,
} from './tickets.ctrl.ts';

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

function createMockApp(): FastifyInstance {
  const app: any = {
    log: {
      error: createMockFn(),
      info: createMockFn(),
      warn: createMockFn(),
      debug: createMockFn(),
    },
    pg: {
      query: createMockFn(() => Promise.resolve({ rows: [], rowCount: 0 })),
    },
  };

  return app as unknown as FastifyInstance;
}

function createMockRequest(body: any = {}, params: any = {}, query: any = {}, user: any = null): FastifyRequest {
  return {
    body,
    params,
    query,
    user,
  } as unknown as FastifyRequest;
}

function createMockReply(): FastifyReply & {
  code: MockWithTracking;
  send: MockWithTracking;
} {
  const reply = {} as any;

  reply.code = createMockFn(reply, reply);
  reply.send = createMockFn(reply, reply);

  return reply as FastifyReply & {
    code: MockWithTracking;
    send: MockWithTracking;
  };
}

describe('Tickets Controller', () => {
  describe('createTicketHandler', () => {
    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({
        email: 'test@example.com',
        reservation_date: '2024-12-25',
        slot_start_time: '14:00:00',
        slot_end_time: '16:00:00',
        ticket_price: 10,
      });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await createTicketHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la création du ticket');
    });
  });

  describe('getTicketByIdHandler', () => {
    test('devrait retourner une erreur 404 si le ticket n\'existe pas', async () => {
      const req = createMockRequest({}, { id: 'invalid-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [] });

      await getTicketByIdHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Ticket non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await getTicketByIdHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la récupération du ticket');
    });
  });

  describe('validateTicketHandler', () => {
    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({ qr_code: 'ABCD1234' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await validateTicketHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error);
    });
  });

  describe('updateTicketHandler', () => {
    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({ email: 'new@example.com' }, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await updateTicketHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error);
    });
  });

  describe('deleteTicketHandler', () => {
    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await deleteTicketHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la suppression du ticket');
    });
  });

  describe('resendTicketsByCheckoutIdHandler', () => {
    test('devrait renvoyer les emails pour les tickets d\'une commande', async () => {
      const req = createMockRequest({}, { checkoutId: 'checkout-123' });
      const reply = createMockReply();
      const app = createMockApp();

      const mockTickets = [
        {
          id: 'ticket-1',
          qr_code: 'ABC12345',
          status: 'paid',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          reservation_date: '2025-12-31',
          slot_start_time: '10:00:00',
          slot_end_time: '12:00:00',
          ticket_price: 10,
          donation_amount: 0,
          guided_tour_price: 0,
          total_amount: 10,
          language: 'fr',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'ticket-2',
          qr_code: 'DEF67890',
          status: 'paid',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          reservation_date: '2025-12-31',
          slot_start_time: '14:00:00',
          slot_end_time: '16:00:00',
          ticket_price: 10,
          donation_amount: 0,
          guided_tour_price: 0,
          total_amount: 10,
          language: 'fr',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      (app.pg as any).query = (sql: string, params?: any[]) => {
        if (sql.includes('SELECT * FROM tickets WHERE checkout_id')) {
          return Promise.resolve({ rows: mockTickets });
        }
        return Promise.resolve({ rows: [] });
      };

      const emailUtilsModule = await import('../email/email.utils.ts');
      const originalSendEmail = emailUtilsModule.emailUtils.sendEmail;

      emailUtilsModule.emailUtils.sendEmail = async () => {
        return { success: true };
      };

      try {
        await resendTicketsByCheckoutIdHandler(req as any, reply, app);

        assert.equal(reply.send.mock.callCount(), 1);
        const response = reply.send.mock.calls[0][0];
        assert.equal(response.success, true);
        assert.equal(response.ticketsCount, 2);
        assert.ok(response.message.includes('2 ticket(s) renvoyé(s)'));
      } catch (error: any) {
        if (error.message && error.message.includes('QR code')) {
          app.log.warn({ error }, 'Erreur attendue lors de la génération du QR code dans les tests');
          assert.equal(reply.send.mock.callCount(), 1);
          const response = reply.send.mock.calls[0][0];
          assert.equal(response.success, true);
          assert.equal(response.ticketsCount, 2);
        } else {
          throw error;
        }
      } finally {
        emailUtilsModule.emailUtils.sendEmail = originalSendEmail;
      }
    });

    test('devrait retourner une erreur 404 si aucun ticket trouvé', async () => {
      const req = createMockRequest({}, { checkoutId: 'checkout-123' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = (sql: string, params?: any[]) => {
        if (sql.includes('SELECT * FROM tickets WHERE checkout_id')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      };

      await resendTicketsByCheckoutIdHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Aucun ticket trouvé pour ce checkout');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { checkoutId: 'checkout-123' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = (sql: string, params?: any[]) => {
        if (sql.includes('SELECT * FROM tickets WHERE checkout_id')) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({ rows: [] });
      };

      const emailUtilsModule = await import('../email/email.utils.ts');
      const originalSendEmail = emailUtilsModule.emailUtils.sendEmail;

      emailUtilsModule.emailUtils.sendEmail = async () => {
        return { success: true };
      };

      try {
        await resendTicketsByCheckoutIdHandler(req as any, reply, app);

        assert.equal(reply.code.mock.callCount(), 1);
        assert.equal(reply.code.mock.calls[0][0], 500);
        const response = reply.send.mock.calls[0][0];
        assert.ok(response.error);
      } finally {
        emailUtilsModule.emailUtils.sendEmail = originalSendEmail;
      }
    });
  });
});

