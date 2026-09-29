import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { callbackHandler, signoutHandler, signinHandler } from './auth.ctrl.ts';
import { resetOidcDiscoveryCache } from './auth.oidc.ts';

const originalFetch = globalThis.fetch;

function reply() {
  const result: any = { cookies: [], cleared: [] };
  result.status = () => result;
  result.code = () => result;
  result.send = (body: unknown) => { result.body = body; return result; };
  result.redirect = (url: string) => { result.redirectedTo = url; return result; };
  result.setCookie = (name: string, value: string) => result.cookies.push([name, value]);
  result.clearCookie = (name: string) => result.cleared.push(name);
  result.log = { error: () => undefined };
  return result;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetOidcDiscoveryCache();
  delete process.env.ZITADEL_ISSUER;
  delete process.env.ZITADEL_CLIENT_ID;
  delete process.env.ZITADEL_CLIENT_SECRET;
  delete process.env.ZITADEL_REDIRECT_URI;
});

describe('Auth controller Zitadel', () => {
  test('does not start login without Zitadel configuration', async () => {
    const previousIssuer = process.env.ZITADEL_ISSUER;
    delete process.env.ZITADEL_ISSUER;
    const res = reply();
    await signinHandler({} as any, res);
    assert.deepEqual(res.body, { error: 'Configuration Zitadel invalide' });
    if (previousIssuer === undefined) delete process.env.ZITADEL_ISSUER;
    else process.env.ZITADEL_ISSUER = previousIssuer;
  });

  test('rejects a callback whose signed state is absent', async () => {
    const res = reply();
    const app = { log: { error: () => undefined } };
    await callbackHandler({ query: { code: 'code', state: 'state' }, cookies: {}, unsignCookie: () => ({ valid: false }) } as any, res, app as any);
    assert.match(res.redirectedTo, /error=invalid_state/);
  });

  test('creates a session only after a valid signed ID token callback', async () => {
    process.env.ZITADEL_ISSUER = 'https://id.example.test';
    process.env.ZITADEL_CLIENT_ID = 'client-id';
    process.env.ZITADEL_CLIENT_SECRET = 'client-secret';
    process.env.ZITADEL_REDIRECT_URI = 'https://api.example.test/auth/callback';
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    jwk.kid = 'test-key';
    const idToken = await new SignJWT({ nonce: 'nonce', preferred_username: 'musee' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(process.env.ZITADEL_ISSUER)
      .setAudience(process.env.ZITADEL_CLIENT_ID)
      .setSubject('zitadel-subject')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith('/.well-known/openid-configuration')) {
        return Response.json({
          issuer: process.env.ZITADEL_ISSUER,
          authorization_endpoint: `${process.env.ZITADEL_ISSUER}/authorize`,
          token_endpoint: `${process.env.ZITADEL_ISSUER}/token`,
          userinfo_endpoint: `${process.env.ZITADEL_ISSUER}/userinfo`,
          jwks_uri: `${process.env.ZITADEL_ISSUER}/keys`,
        });
      }
      if (url.endsWith('/keys')) return Response.json({ keys: [jwk] });
      return Response.json({ access_token: 'access-token', token_type: 'Bearer', id_token: idToken, expires_in: 60 });
    }) as typeof fetch;

    const res = reply();
    const errors: unknown[] = [];
    const app = { log: { error: ({ err }: { err: unknown }) => errors.push(err), debug: () => undefined } };
    await callbackHandler({
      query: { code: 'code', state: 'state' },
      cookies: { zitadel_oauth_state: 'state', zitadel_oauth_nonce: 'nonce', zitadel_oauth_verifier: 'verifier' },
      unsignCookie: (value: string) => ({ valid: true, value }),
    } as any, res, app as any);

    assert.equal(errors.length, 0, String(errors[0]));
    assert.match(res.redirectedTo, /success=true/);
    assert.deepEqual(res.cookies.map(([name]: [string]) => name), ['zitadel_access_token']);
  });

  test('clears Zitadel and temporary cookies on logout', async () => {
    const res = reply();
    await signoutHandler({} as any, res);
    assert.deepEqual(res.cleared, [
      'zitadel_access_token',
      'zitadel_refresh_token',
      'zitadel_oauth_state',
      'zitadel_oauth_nonce',
      'zitadel_oauth_verifier',
    ]);
  });
});
