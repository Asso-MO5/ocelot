import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  createAuthorizationTransaction,
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  getOidcDiscovery,
  getUserinfo,
  resetOidcDiscoveryCache,
  userFromClaims,
} from './auth.oidc.ts';
import type { ZitadelConfiguration } from './auth.zitadel.ts';

const configuration: ZitadelConfiguration = {
  issuer: 'https://id.example.test',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://api.example.test/auth/callback',
  scopes: ['openid', 'profile', 'email', 'offline_access', 'urn:zitadel:iam:org:project:roles'],
  rolesClaim: 'urn:zitadel:iam:org:project:roles',
};

const originalFetch = globalThis.fetch;

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

function installFetchMock() {
  const calls: Array<[string, RequestInit | undefined]> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push([input.toString(), init]);
    if (input.toString().endsWith('/.well-known/openid-configuration')) {
      return response({
        issuer: configuration.issuer,
        authorization_endpoint: `${configuration.issuer}/oauth/v2/authorize`,
        token_endpoint: `${configuration.issuer}/oauth/v2/token`,
        userinfo_endpoint: `${configuration.issuer}/oidc/v1/userinfo`,
        jwks_uri: `${configuration.issuer}/oauth/v2/keys`,
      });
    }
    if (input.toString().endsWith('/userinfo')) {
      return response({
        sub: 'zitadel-subject',
        preferred_username: 'musee',
        email: 'musee@example.test',
        [configuration.rolesClaim]: { bureau: {}, museum_ticket_scan: {} },
      });
    }
    return response({ access_token: 'access', token_type: 'Bearer', expires_in: 3600 });
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetOidcDiscoveryCache();
});

describe('OIDC Zitadel', () => {
  test('builds an authorization request with PKCE, state and nonce', async () => {
    installFetchMock();
    const discovery = await getOidcDiscovery(configuration);
    const transaction = createAuthorizationTransaction();
    const url = new URL(createAuthorizationUrl(configuration, discovery, transaction));

    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('state'), transaction.state);
    assert.equal(url.searchParams.get('nonce'), transaction.nonce);
    assert.equal(url.searchParams.get('code_challenge'), transaction.challenge);
  });

  test('exchanges a code with the PKCE verifier and confidential-client credentials', async () => {
    const calls = installFetchMock();
    const discovery = await getOidcDiscovery(configuration);
    await exchangeAuthorizationCode(configuration, discovery, 'authorization-code', 'verifier');

    const [, request] = calls[1];
    assert.equal(request?.headers && (request.headers as Record<string, string>).Authorization, 'Basic Y2xpZW50LWlkOmNsaWVudC1zZWNyZXQ=');
    assert.match(request?.body as string, /code_verifier=verifier/);
    assert.match(request?.body as string, /grant_type=authorization_code/);
  });

  test('returns roles from the configured Zitadel claim', async () => {
    const calls = installFetchMock();
    const discovery = await getOidcDiscovery(configuration);
    const user = await getUserinfo(configuration, discovery, 'access-token');

    assert.deepEqual(user, {
      id: 'zitadel-subject',
      username: 'musee',
      avatar: null,
      email: 'musee@example.test',
      roles: ['bureau', 'museum_ticket_scan'],
    });
    assert.equal((calls[1][1]?.headers as Record<string, string>).Authorization, 'Bearer access-token');
  });

  test('rejects claims without a subject', () => {
    assert.throws(() => userFromClaims({}, configuration), /Claim sub absent/);
  });
});
