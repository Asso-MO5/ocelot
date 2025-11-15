import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import {
  signinHandler,
  meHandler,
  callbackHandler,
} from './auth.ctrl.ts';
import type { DiscordUser, DiscordTokenResponse, DiscordErrorResponse, DiscordOAuthCallbackQuery } from './auth.types.ts';

// Mock pour fetch global
const originalFetch = global.fetch;
let fetchMock: any;

// Type pour les mocks avec tracking
interface MockWithTracking {
  (...args: any[]): any;
  mock: {
    calls: any[][];
    callCount(): number;
  };
}

// Helper pour créer un mock avec tracking
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

// Mock pour FastifyInstance
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

// Helper pour créer un mock FastifyRequest
function createMockRequest(cookies: Record<string, string> = {}, query: Record<string, string> = {}): FastifyRequest {
  return {
    cookies,
    query,
  } as unknown as FastifyRequest;
}

// Helper pour créer un mock FastifyReply
function createMockReply(): FastifyReply & {
  status: MockWithTracking;
  send: MockWithTracking;
  redirect: MockWithTracking;
  setCookie: MockWithTracking;
  clearCookie: MockWithTracking;
  header: MockWithTracking;
} {
  const reply = {} as any;

  // Créer les méthodes mockées qui retournent reply pour le chaînage
  reply.status = createMockFn(reply, reply);
  reply.send = createMockFn(reply, reply);
  reply.redirect = createMockFn(reply, reply);
  reply.setCookie = createMockFn(reply, reply);
  reply.clearCookie = createMockFn(reply, reply);
  reply.header = createMockFn(reply, reply);

  return reply as FastifyReply & {
    status: MockWithTracking;
    send: MockWithTracking;
    redirect: MockWithTracking;
    setCookie: MockWithTracking;
    clearCookie: MockWithTracking;
    header: MockWithTracking;
  };
}

describe('Auth Controller', () => {
  beforeEach(() => {
    // Créer un mock personnalisé pour fetch
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

    // Enregistrer les appels dans la fonction fetchMock
    const originalFetchFn = fetchMock;
    fetchMock = ((...args: any[]) => {
      calls.push(args);
      return originalFetchFn(...args);
    }) as any;
    fetchMock.mock = originalFetchFn.mock;

    global.fetch = fetchMock as unknown as typeof fetch;
    // Reset des variables d'environnement
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
    delete process.env.DISCORD_REDIRECT_URI;
    delete process.env.DISCORD_SCOPES;
    delete process.env.PORT;
    delete process.env.FRONTEND_URL;
    delete process.env.REFRESH_TOKEN_MAX_AGE_DAYS;
    delete process.env.NODE_ENV;
    delete process.env.DISCORD_GUILD_ID;
    delete process.env.DISCORD_TOKEN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('signinHandler', () => {
    test('devrait rediriger vers Discord OAuth avec les bons paramètres', async () => {
      process.env.DISCORD_CLIENT_ID = 'test-client-id';
      process.env.PORT = '4000';

      const req = createMockRequest();
      const reply = createMockReply();

      await signinHandler(req, reply);

      assert.equal(reply.redirect.mock.callCount(), 1);
      const redirectUrl = reply.redirect.mock.calls[0][0] as string;
      const url = new URL(redirectUrl);

      assert.equal(url.origin, 'https://discord.com');
      assert.equal(url.pathname, '/oauth2/authorize');
      assert.equal(url.searchParams.get('client_id'), 'test-client-id');
      assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(url.searchParams.get('scope'), 'identify email');
      assert.ok(url.searchParams.get('redirect_uri')?.includes('/auth/callback'));
    });

    test('devrait retourner une erreur 500 si DISCORD_CLIENT_ID est manquant', async () => {
      const req = createMockRequest();
      const reply = createMockReply();

      await signinHandler(req, reply);

      assert.equal(reply.status.mock.callCount(), 1);
      assert.equal(reply.status.mock.calls[0][0], 500);
      assert.equal(reply.send.mock.callCount(), 1);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'DISCORD_CLIENT_ID non configuré');
    });

    test('devrait utiliser les scopes personnalisés si définis', async () => {
      process.env.DISCORD_CLIENT_ID = 'test-client-id';
      process.env.DISCORD_SCOPES = 'identify email guilds';

      const req = createMockRequest();
      const reply = createMockReply();

      await signinHandler(req, reply);

      const redirectUrl = reply.redirect.mock.calls[0][0] as string;
      const url = new URL(redirectUrl);
      assert.equal(url.searchParams.get('scope'), 'identify email guilds');
    });
  });

  describe('meHandler', () => {
    test('devrait retourner 401 si aucun access_token', async () => {
      const req = createMockRequest({});
      const reply = createMockReply();
      const app = createMockApp();

      await meHandler(req, reply, app);

      assert.equal(reply.status.mock.callCount(), 1);
      assert.equal(reply.status.mock.calls[0][0], 401);
      assert.equal(reply.send.mock.callCount(), 1);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Non authentifié');
    });

    test('devrait retourner les données utilisateur si le token est valide', async () => {
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
        roles: ['role1', 'role2'],
      };

      const guildRoles = [
        { id: 'role1', name: 'Admin' },
        { id: 'role2', name: 'Member' },
        { id: 'role3', name: 'Guest' },
      ];

      // Réinitialiser le mock
      fetchMock.mock.reset();

      // Appel pour récupérer les données utilisateur
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => userData,
        } as Response)
      );

      // Appel pour récupérer le membre de la guild
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => guildMember,
        } as Response)
      );

      // Appel pour récupérer les rôles de la guild
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
      const app = createMockApp(true);

      await meHandler(req, reply, app);

      assert.equal(fetchMock.mock.callCount(), 3);
      assert.equal(fetchMock.mock.calls[0][0], 'https://discord.com/api/users/@me');
      assert.equal(fetchMock.mock.calls[1][0], `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userData.id}`);
      assert.equal(fetchMock.mock.calls[2][0], `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/roles`);

      assert.equal(reply.send.mock.callCount(), 1);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.id, userData.id);
      assert.equal(response.username, userData.username);
      assert.equal(response.email, userData.email);
      assert.ok(Array.isArray(response.roles));
      assert.equal(response.roles.length, 2);
      assert.ok(response.roles.includes('admin'));
      assert.ok(response.roles.includes('member'));
    });

    test('devrait rafraîchir le token si le token est expiré', async () => {
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

      const guildMember = {
        roles: ['role1'],
      };

      const guildRoles = [
        { id: 'role1', name: 'Member' },
      ];

      // Réinitialiser le mock
      fetchMock.mock.reset();

      // Premier appel: token expiré (401)
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
        } as Response)
      );

      // Appel pour refresh token
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => refreshData,
        } as Response)
      );

      // Deuxième appel: récupération des données utilisateur avec le nouveau token
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => userData,
        } as Response)
      );

      // Appel pour récupérer le membre de la guild
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => guildMember,
        } as Response)
      );

      // Appel pour récupérer les rôles de la guild
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => guildRoles,
        } as Response)
      );

      const req = createMockRequest({
        discord_access_token: 'expired-token',
        discord_refresh_token: 'valid-refresh-token',
      });
      const reply = createMockReply();
      const app = createMockApp(true);

      await meHandler(req, reply, app);

      // Vérifie que le refresh a été appelé
      assert.equal(fetchMock.mock.callCount(), 5);
      assert.equal(reply.setCookie.mock.callCount(), 2); // access_token et refresh_token
      assert.equal(reply.send.mock.callCount(), 1);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.id, userData.id);
    });

    test('devrait retourner 401 si le refresh token est invalide', async () => {
      process.env.DISCORD_CLIENT_ID = 'test-client-id';
      process.env.DISCORD_CLIENT_SECRET = 'test-secret';

      // Réinitialiser le mock
      fetchMock.mock.reset();
      // Token expiré
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
        } as Response)
      );

      // Refresh token échoue
      const errorResponse: DiscordErrorResponse = { error: 'invalid_grant' };
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => errorResponse,
        } as Response)
      );

      const req = createMockRequest({
        discord_access_token: 'expired-token',
        discord_refresh_token: 'invalid-refresh-token',
      });
      const reply = createMockReply();
      const app = createMockApp(true);

      await meHandler(req, reply, app);

      assert.equal(reply.clearCookie.mock.callCount(), 2);
      assert.equal(reply.status.mock.callCount(), 1);
      assert.equal(reply.status.mock.calls[0][0], 401);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Session expirée, veuillez vous reconnecter');
    });

    test('devrait retourner 401 si aucun refresh token disponible', async () => {
      // Réinitialiser le mock
      fetchMock.mock.reset();
      // Token expiré
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
        } as Response)
      );

      const req = createMockRequest({
        discord_access_token: 'expired-token',
      });
      const reply = createMockReply();
      const app = createMockApp(true);

      await meHandler(req, reply, app);

      assert.equal(reply.status.mock.callCount(), 1);
      assert.equal(reply.status.mock.calls[0][0], 401);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Token expiré et aucun refresh token disponible');
    });
  });

  describe('callbackHandler', () => {
    test('devrait rediriger vers le frontend avec erreur si error est présent', async () => {
      const req = createMockRequest({}, { error: 'access_denied' }) as FastifyRequest<{ Querystring: DiscordOAuthCallbackQuery }>;
      const reply = createMockReply();
      const app = createMockApp();

      await callbackHandler(req, reply, app);

      assert.equal(reply.redirect.mock.callCount(), 1);
      const redirectUrl = reply.redirect.mock.calls[0][0] as string;
      assert.ok(redirectUrl.includes('error=access_denied'));
    });

    test('devrait rediriger avec missing_code si aucun code', async () => {
      const req = createMockRequest({}, {}) as FastifyRequest<{ Querystring: DiscordOAuthCallbackQuery }>;
      const reply = createMockReply();
      const app = createMockApp();

      await callbackHandler(req, reply, app);

      assert.equal(reply.redirect.mock.callCount(), 1);
      const redirectUrl = reply.redirect.mock.calls[0][0] as string;
      assert.ok(redirectUrl.includes('error=missing_code'));
    });

    test('devrait retourner 500 si la configuration Discord est manquante', async () => {
      const req = createMockRequest({}, { code: 'test-code' }) as FastifyRequest<{ Querystring: DiscordOAuthCallbackQuery }>;
      const reply = createMockReply();
      const app = createMockApp();

      await callbackHandler(req, reply, app);

      assert.equal(reply.status.mock.callCount(), 1);
      assert.equal(reply.status.mock.calls[0][0], 500);
      const response = reply.send.mock.calls[0][0];
      assert.equal(response.error, 'Configuration Discord manquante');
    });

    test('devrait échanger le code contre un token et rediriger vers le frontend', async () => {
      process.env.DISCORD_CLIENT_ID = 'test-client-id';
      process.env.DISCORD_CLIENT_SECRET = 'test-secret';
      process.env.FRONTEND_URL = 'http://localhost:3000';

      const tokenData: DiscordTokenResponse = {
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
        avatar: 'avatar-hash',
        email: 'test@example.com',
      };

      // Réinitialiser le mock
      fetchMock.mock.reset();

      // Appel pour échanger le code contre un token
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => tokenData,
        } as Response)
      );

      // Appel pour récupérer les données utilisateur
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => userData,
        } as Response)
      );

      const req = createMockRequest({}, { code: 'test-code' }) as FastifyRequest<{ Querystring: DiscordOAuthCallbackQuery }>;
      const reply = createMockReply();
      const app = createMockApp(true);

      await callbackHandler(req, reply, app);

      // Vérifie que fetch a été appelé pour échanger le code et récupérer les données utilisateur
      assert.equal(fetchMock.mock.callCount(), 2);
      assert.equal(fetchMock.mock.calls[0][0], 'https://discord.com/api/v10/oauth2/token');
      assert.equal(fetchMock.mock.calls[1][0], 'https://discord.com/api/users/@me');

      // Vérifie que les cookies ont été définis
      assert.equal(reply.setCookie.mock.callCount(), 2);

      // Vérifie que l'utilisateur a été sauvegardé
      assert.equal((app.pg.query as MockWithTracking).mock.callCount(), 1);

      // Vérifie la redirection vers le frontend
      assert.equal(reply.redirect.mock.callCount(), 1);
      const redirectUrl = reply.redirect.mock.calls[0][0] as string;
      assert.ok(redirectUrl.includes('http://localhost:3000'));
      assert.ok(redirectUrl.includes('success=true'));
    });

    test('devrait rediriger avec erreur si Discord retourne une erreur', async () => {
      process.env.DISCORD_CLIENT_ID = 'test-client-id';
      process.env.DISCORD_CLIENT_SECRET = 'test-secret';

      // Réinitialiser le mock
      fetchMock.mock.reset();
      const errorResponse: DiscordErrorResponse = { error: 'invalid_grant' };
      fetchMock.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => errorResponse,
        } as Response)
      );

      const req = createMockRequest({}, { code: 'invalid-code' }) as FastifyRequest<{ Querystring: DiscordOAuthCallbackQuery }>;
      const reply = createMockReply();
      const app = createMockApp();

      await callbackHandler(req, reply, app);

      assert.equal(reply.redirect.mock.callCount(), 1);
      const redirectUrl = reply.redirect.mock.calls[0][0] as string;
      assert.ok(redirectUrl.includes('error=invalid_grant'));
      assert.equal((app.log.error as MockWithTracking).mock.callCount(), 1);
    });
  });
});

