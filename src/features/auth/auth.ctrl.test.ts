import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { callbackHandler, signoutHandler, signinHandler } from './auth.ctrl.ts';

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
