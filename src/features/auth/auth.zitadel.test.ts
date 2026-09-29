import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  defaultZitadelRolesClaim,
  getZitadelConfiguration,
  getZitadelDiscoveryUrl,
} from './auth.zitadel.ts';

const variables = [
  'PORT',
  'ZITADEL_ISSUER',
  'ZITADEL_CLIENT_ID',
  'ZITADEL_CLIENT_SECRET',
  'ZITADEL_REDIRECT_URI',
  'ZITADEL_SCOPES',
  'ZITADEL_ROLES_CLAIM',
] as const;

const previousEnvironment = new Map(variables.map((name) => [name, process.env[name]]));

function setValidEnvironment() {
  process.env.ZITADEL_ISSUER = 'https://id.mo5.com/';
  process.env.ZITADEL_CLIENT_ID = 'ocelot-client';
  process.env.ZITADEL_CLIENT_SECRET = 'test-secret';
}

afterEach(() => {
  for (const name of variables) {
    const value = previousEnvironment.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('Zitadel configuration', () => {
  test('returns secure server-side OIDC settings with default scopes', () => {
    setValidEnvironment();
    process.env.PORT = '3500';

    const configuration = getZitadelConfiguration();

    assert.equal(configuration.issuer, 'https://id.mo5.com');
    assert.equal(configuration.redirectUri, 'http://localhost:3500/auth/callback');
    assert.deepEqual(configuration.scopes, [
      'openid',
      'profile',
      'email',
      'offline_access',
      defaultZitadelRolesClaim,
    ]);
    assert.equal(configuration.rolesClaim, defaultZitadelRolesClaim);
  });

  test('requires issuer, client ID and client secret', () => {
    assert.throws(getZitadelConfiguration, /ZITADEL_ISSUER non configuré/);

    process.env.ZITADEL_ISSUER = 'https://id.mo5.com';
    assert.throws(getZitadelConfiguration, /ZITADEL_CLIENT_ID non configuré/);

    process.env.ZITADEL_CLIENT_ID = 'ocelot-client';
    assert.throws(getZitadelConfiguration, /ZITADEL_CLIENT_SECRET non configuré/);
  });

  test('rejects non-HTTP(S) issuer and redirect URI values', () => {
    setValidEnvironment();
    process.env.ZITADEL_ISSUER = 'file:///etc/passwd';
    assert.throws(getZitadelConfiguration, /ZITADEL_ISSUER doit être une URL HTTP\(S\) absolue/);

    process.env.ZITADEL_ISSUER = 'https://id.mo5.com';
    process.env.ZITADEL_REDIRECT_URI = '/auth/callback';
    assert.throws(getZitadelConfiguration, /ZITADEL_REDIRECT_URI doit être une URL HTTP\(S\) absolue/);
  });

  test('uses OpenID discovery below the issuer', () => {
    assert.equal(
      getZitadelDiscoveryUrl('https://id.mo5.com/'),
      'https://id.mo5.com/.well-known/openid-configuration',
    );
  });
});
