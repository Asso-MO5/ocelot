import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  upsertScheduleHandler,
  getScheduleByIdHandler,
  updateScheduleHandler,
  deleteScheduleHandler,
  reorderSchedulesHandler,
} from './schedules.ctrl.ts';

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

describe('Schedules Controller', () => {
  describe('upsertScheduleHandler', () => {
    test('devrait retourner une erreur 400 si day_of_week est manquant pour un horaire récurrent', async () => {
      const req = createMockRequest({
        start_time: '09:00:00',
        end_time: '18:00:00',
        audience_type: 'public',
        is_exception: false
      });
      const reply = createMockReply();
      const app = createMockApp();

      await upsertScheduleHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error.includes('day_of_week') || response.error.includes('requis'));
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '18:00:00',
        audience_type: 'public'
      });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await upsertScheduleHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la création/mise à jour de l\'horaire');
    });
  });

  describe('getScheduleByIdHandler', () => {
    test('devrait retourner une erreur 404 si l\'horaire n\'existe pas', async () => {
      const req = createMockRequest({}, { id: 'invalid-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [] });

      await getScheduleByIdHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Horaire non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await getScheduleByIdHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la récupération de l\'horaire');
    });
  });

  describe('updateScheduleHandler', () => {
    test('devrait retourner une erreur 404 si l\'horaire n\'existe pas', async () => {
      const req = createMockRequest({ start_time: '10:00:00' }, { id: 'invalid-id' });
      const reply = createMockReply();
      const app = createMockApp();

      let queryCallCount = 0;
      (app.pg as any).query = (sql: string) => {
        queryCallCount++;
        if (sql.includes('SELECT * FROM schedules WHERE id') && queryCallCount === 1) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      };

      await updateScheduleHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Horaire non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({ start_time: '10:00:00' }, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await updateScheduleHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la mise à jour de l\'horaire');
    });
  });

  describe('deleteScheduleHandler', () => {
    test('devrait retourner une erreur 404 si l\'horaire n\'existe pas', async () => {
      const req = createMockRequest({}, { id: 'invalid-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.resolve({ rows: [], rowCount: 0 });

      await deleteScheduleHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 404);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Horaire non trouvé');
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({}, { id: 'test-id' });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await deleteScheduleHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors de la suppression de l\'horaire');
    });
  });

  describe('reorderSchedulesHandler', () => {
    test('devrait retourner une erreur 400 si le tableau est vide', async () => {
      const req = createMockRequest({ schedule_ids: [] });
      const reply = createMockReply();
      const app = createMockApp();

      await reorderSchedulesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 400);
      const response = reply.send.mock.calls[0][0];
      assert.ok(response.error.includes('vide') || response.error.includes('schedule_ids'));
    });

    test('devrait retourner une erreur 500 en cas d\'erreur serveur', async () => {
      const req = createMockRequest({ schedule_ids: ['id1', 'id2'] });
      const reply = createMockReply();
      const app = createMockApp();

      (app.pg as any).query = () => Promise.reject(new Error('Database error'));

      await reorderSchedulesHandler(req as any, reply, app);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Erreur lors du réordonnancement des horaires');
    });
  });
});

