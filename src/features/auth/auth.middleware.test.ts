import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import {
  authenticateHook,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  requireRole,
  requireAnyRole,
  requireAllRoles,
  requireAuth,
} from './auth.middleware.ts';
import type { AuthenticatedUser, DiscordUser, DiscordTokenResponse } from './auth.types.ts';

const originalFetch = global.fetch;
let fetchMock: any;

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

function createMockApp(withDatabase: boolean = false): FastifyInstance {
  const app: any = {
    log: {
      error: createMockFn(),
      info: createMockFn(),
      warn: createMockFn(),
      debug: createMockFn(),
    },
  };

  if (withDatabase) {
    app.pg = {
      query: createMockFn(Promise.resolve({ rows: [] })),
    };
  }

  return app as unknown as FastifyInstance;
}

function createMockRequest(cookies: Record<string, string> = {}, method: string = 'GET'): FastifyRequest {
  return {
    cookies,
    method,
    user: undefined,
  } as unknown as FastifyRequest;
}

function createMockReply(): FastifyReply & {
  code: MockWithTracking;
  send: MockWithTracking;
  setCookie: MockWithTracking;
  clearCookie: MockWithTracking;
} {
  const reply = {} as any;

  reply.code = createMockFn(reply, reply);
  reply.send = createMockFn(reply, reply);
  reply.setCookie = createMockFn(reply, reply);
  reply.clearCookie = createMockFn(reply, reply);

  return reply as FastifyReply & {
    code: MockWithTracking;
    send: MockWithTracking;
    setCookie: MockWithTracking;
    clearCookie: MockWithTracking;
  };
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    const implementations: (() => Promise<Response>)[] = [];
    let callIndex = 0;

    fetchMock = ((...args: any[]) => {
      if (implementations.length > 0 && callIndex < implementations.length) {
        const impl = implementations[callIndex];
        callIndex++;
        return impl();
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
    }) as any;

    const calls: any[][] = [];

    fetchMock.mock = {
      calls,
      callCount: () => calls.length,
      mockImplementationOnce: (impl: () => Promise<Response>) => {
        implementations.push(impl);
      },
      reset: () => {
        implementations.length = 0;
        calls.length = 0;
        callIndex = 0;
      },
    };

    const originalFetchFn = fetchMock;
    fetchMock = ((...args: any[]) => {
      calls.push(args);
      return originalFetchFn(...args);
    }) as any;
    fetchMock.mock = originalFetchFn.mock;

    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
    delete process.env.DISCORD_GUILD_ID;
    delete process.env.DISCORD_TOKEN;
    delete process.env.REFRESH_TOKEN_MAX_AGE_DAYS;
    delete process.env.NODE_ENV;
    delete process.env.COOKIE_DOMAIN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('requireAuth', () => {
    test('devrait retourner null si aucun access_token', async () => {
      const req = createMockRequest({});
      const reply = createMockReply();
      const app = createMockApp();

      const user = await requireAuth(req, reply, app);

      assert.equal(user, null);
    });

    test('devrait retourner l\'utilisateur si le token est valide', async () => {
      process.env.DISCORD_GUILD_ID = 'test-guild-id';
      process.env.DISCORD_TOKEN = 'test-bot-token';

      const userData: DiscordUser = {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: 'avatar-hash',
        email: 'test@example.com',
      };

      const guildMember = {
        roles: ['role1'],
      };

      const guildRoles = [
        { id: 'role1', name: 'Admin' },
      ];

      fetchMock.mock.reset();

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => userData,
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => guildMember,
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => guildRoles,
        } as Response)
      );

      const req = createMockRequest({
        discord_access_token: 'valid-token',
      });
      const reply = createMockReply();
      const app = createMockApp();

      const user = await requireAuth(req, reply, app);

      assert.notEqual(user, null);
      assert.equal(user?.id, userData.id);
      assert.equal(user?.username, userData.username);
      assert.ok(Array.isArray(user?.roles));
    });

    test('devrait rafraîchir le token si expiré', async () => {
      process.env.DISCORD_CLIENT_ID = 'test-client-id';
      process.env.DISCORD_CLIENT_SECRET = 'test-secret';
      process.env.DISCORD_GUILD_ID = 'test-guild-id';
      process.env.DISCORD_TOKEN = 'test-bot-token';

      const refreshData: DiscordTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'identify email',
      };

      const userData: DiscordUser = {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: null,
        email: 'test@example.com',
      };

      fetchMock.mock.reset();

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => refreshData,
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => userData,
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ roles: [] }),
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response)
      );

      const req = createMockRequest({
        discord_access_token: 'expired-token',
        discord_refresh_token: 'valid-refresh-token',
      });
      const reply = createMockReply();
      const app = createMockApp();

      const user = await requireAuth(req, reply, app);

      assert.notEqual(user, null);
      assert.equal(reply.setCookie.mock.callCount(), 2);
    });

    test('devrait retourner null si le refresh token échoue', async () => {
      process.env.DISCORD_CLIENT_ID = 'test-client-id';
      process.env.DISCORD_CLIENT_SECRET = 'test-secret';

      fetchMock.mock.reset();

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
        } as Response)
      );

      const req = createMockRequest({
        discord_access_token: 'expired-token',
        discord_refresh_token: 'invalid-refresh-token',
      });
      const reply = createMockReply();
      const app = createMockApp();

      const user = await requireAuth(req, reply, app);

      assert.equal(user, null);
      assert.equal(reply.clearCookie.mock.callCount(), 2);
    });
  });

  describe('authenticateHook', () => {
    test('devrait passer si OPTIONS', async () => {
      const req = createMockRequest({}, 'OPTIONS');
      const reply = createMockReply();
      const app = createMockApp();

      const hook = authenticateHook(app);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 0);
    });

    test('devrait retourner 401 si non authentifié', async () => {
      const req = createMockRequest({});
      const reply = createMockReply();
      const app = createMockApp();

      fetchMock.mock.reset();
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
        } as Response)
      );

      const hook = authenticateHook(app);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 401);
      assert.equal(reply.send.mock.callCount(), 1);
    });

    test('devrait définir req.user si authentifié', async () => {
      process.env.DISCORD_GUILD_ID = 'test-guild-id';
      process.env.DISCORD_TOKEN = 'test-bot-token';

      const userData: DiscordUser = {
        id: '123456789',
        username: 'testuser',
        discriminator: '0001',
        avatar: null,
        email: 'test@example.com',
      };

      fetchMock.mock.reset();

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => userData,
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ roles: [] }),
        } as Response)
      );

      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        } as Response)
      );

      const req = createMockRequest({
        discord_access_token: 'valid-token',
      });
      const reply = createMockReply();
      const app = createMockApp();

      const hook = authenticateHook(app);
      await hook(req, reply);

      assert.notEqual(req.user, undefined);
      assert.equal(req.user?.id, userData.id);
    });
  });

  describe('hasRole', () => {
    test('devrait retourner false si user est undefined', () => {
      assert.equal(hasRole(undefined, 'admin'), false);
    });

    test('devrait retourner true si l\'utilisateur a le rôle', () => {
      const user: AuthenticatedUser = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['admin', 'user'],
      };

      assert.equal(hasRole(user, 'admin'), true);
      assert.equal(hasRole(user, 'ADMIN'), true);
      assert.equal(hasRole(user, 'user'), true);
    });

    test('devrait retourner false si l\'utilisateur n\'a pas le rôle', () => {
      const user: AuthenticatedUser = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['user'],
      };

      assert.equal(hasRole(user, 'admin'), false);
    });
  });

  describe('hasAnyRole', () => {
    test('devrait retourner false si user est undefined', () => {
      assert.equal(hasAnyRole(undefined, ['admin']), false);
    });

    test('devrait retourner true si l\'utilisateur a au moins un rôle', () => {
      const user: AuthenticatedUser = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['user'],
      };

      assert.equal(hasAnyRole(user, ['admin', 'user']), true);
      assert.equal(hasAnyRole(user, ['admin', 'moderator']), false);
    });
  });

  describe('hasAllRoles', () => {
    test('devrait retourner false si user est undefined', () => {
      assert.equal(hasAllRoles(undefined, ['admin']), false);
    });

    test('devrait retourner true si l\'utilisateur a tous les rôles', () => {
      const user: AuthenticatedUser = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['admin', 'user'],
      };

      assert.equal(hasAllRoles(user, ['admin', 'user']), true);
      assert.equal(hasAllRoles(user, ['admin']), true);
      assert.equal(hasAllRoles(user, ['admin', 'moderator']), false);
    });
  });

  describe('requireRole', () => {
    test('devrait passer si OPTIONS', async () => {
      const req = createMockRequest({}, 'OPTIONS');
      const reply = createMockReply();

      const hook = requireRole('admin');
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 0);
    });

    test('devrait retourner 401 si non authentifié', async () => {
      const req = createMockRequest({});
      const reply = createMockReply();

      const hook = requireRole('admin');
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 401);
    });

    test('devrait retourner 403 si l\'utilisateur n\'a pas le rôle', async () => {
      const req = createMockRequest({});
      req.user = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['user'],
      };
      const reply = createMockReply();

      const hook = requireRole('admin');
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 403);
    });

    test('devrait passer si l\'utilisateur a le rôle', async () => {
      const req = createMockRequest({});
      req.user = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['admin'],
      };
      const reply = createMockReply();

      const hook = requireRole('admin');
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 0);
    });
  });

  describe('requireAnyRole', () => {
    test('devrait passer si OPTIONS', async () => {
      const req = createMockRequest({}, 'OPTIONS');
      const reply = createMockReply();

      const hook = requireAnyRole(['admin']);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 0);
    });

    test('devrait retourner 403 si l\'utilisateur n\'a aucun des rôles', async () => {
      const req = createMockRequest({});
      req.user = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['user'],
      };
      const reply = createMockReply();

      const hook = requireAnyRole(['admin', 'moderator']);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 403);
    });

    test('devrait passer si l\'utilisateur a au moins un rôle', async () => {
      const req = createMockRequest({});
      req.user = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['admin'],
      };
      const reply = createMockReply();

      const hook = requireAnyRole(['admin', 'moderator']);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 0);
    });
  });

  describe('requireAllRoles', () => {
    test('devrait passer si OPTIONS', async () => {
      const req = createMockRequest({}, 'OPTIONS');
      const reply = createMockReply();

      const hook = requireAllRoles(['admin']);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 0);
    });

    test('devrait retourner 403 si l\'utilisateur n\'a pas tous les rôles', async () => {
      const req = createMockRequest({});
      req.user = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['admin'],
      };
      const reply = createMockReply();

      const hook = requireAllRoles(['admin', 'moderator']);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 1);
      assert.equal(reply.code.mock.calls[0][0], 403);
    });

    test('devrait passer si l\'utilisateur a tous les rôles', async () => {
      const req = createMockRequest({});
      req.user = {
        id: '123',
        username: 'test',
        discriminator: '0001',
        avatar: null,
        roles: ['admin', 'moderator'],
      };
      const reply = createMockReply();

      const hook = requireAllRoles(['admin', 'moderator']);
      await hook(req, reply);

      assert.equal(reply.code.mock.callCount(), 0);
    });
  });
});

