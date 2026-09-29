import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { hasAllRoles, hasAnyRole, hasRole, requireAuth } from './auth.middleware.ts';

const user = { id: 'subject', username: 'musee', avatar: null, roles: ['bureau'] };

describe('Auth middleware Zitadel', () => {
  test('checks normalized role keys', () => {
    assert.equal(hasRole(user, 'BUREAU'), true);
    assert.equal(hasAnyRole(user, ['member', 'bureau']), true);
    assert.equal(hasAllRoles(user, ['bureau']), true);
    assert.equal(hasAllRoles(user, ['bureau', 'museum']), false);
  });

  test('rejects a request without Zitadel session', async () => {
    const result = await requireAuth(
      { cookies: {} } as any,
      { clearCookie: () => undefined } as any,
      { log: { error: () => undefined } } as any,
    );
    assert.equal(result, null);
  });
});
