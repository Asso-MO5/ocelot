import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { authUtils } from './auth.utils.ts';

describe('Auth Utils', () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.COOKIE_DOMAIN;
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.COOKIE_DOMAIN;
  });

  describe('getCookieOptions', () => {
    test('devrait retourner les options de base en développement', () => {
      process.env.NODE_ENV = 'development';

      const options = authUtils.getCookieOptions();

      assert.equal(options.httpOnly, true);
      assert.equal(options.secure, false);
      assert.equal(options.sameSite, 'lax');
      assert.equal(options.path, '/');
      assert.equal(options.domain, undefined);
    });

    test('devrait retourner secure=true en production', () => {
      process.env.NODE_ENV = 'production';

      const options = authUtils.getCookieOptions();

      assert.equal(options.secure, true);
    });

    test('devrait inclure le domaine si défini en production', () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_DOMAIN = 'example.com';

      const options = authUtils.getCookieOptions();

      assert.equal(options.domain, 'example.com');
    });

    test('ne devrait pas inclure le domaine si non défini en production', () => {
      process.env.NODE_ENV = 'production';

      const options = authUtils.getCookieOptions();

      assert.equal(options.domain, undefined);
    });

    test('ne devrait pas inclure le domaine en développement même si défini', () => {
      process.env.NODE_ENV = 'development';
      process.env.COOKIE_DOMAIN = 'example.com';

      const options = authUtils.getCookieOptions();

      assert.equal(options.domain, undefined);
    });
  });
});

