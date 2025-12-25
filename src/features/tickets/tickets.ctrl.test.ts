import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createTicketHandler,
  getTicketByIdHandler,
  validateTicketHandler,
  updateTicketHandler,
  deleteTicketHandler,
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
});

