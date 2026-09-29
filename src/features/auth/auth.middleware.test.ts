import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  hasAllRoles,
  hasAnyRole,
  hasMuseumPermission,
  hasRole,
  requireAuth,
  requireMuseumPermission,
} from './auth.middleware.ts';

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

  test('enforces least-privilege museum permissions', () => {
    const scanner = { ...user, roles: ['museum_ticket_scan'] };
    const configurator = { ...user, roles: ['museum_configuration'] };
    const member = { ...user, roles: ['membre'] };
    const administrator = { ...user, roles: ['museum_administrateur'] };

    assert.equal(hasMuseumPermission(scanner, 'ticket_scan'), true);
    assert.equal(hasMuseumPermission(scanner, 'ticket_manage'), false);
    assert.equal(hasMuseumPermission(configurator, 'configuration'), true);
    assert.equal(hasMuseumPermission(configurator, 'ticket_scan'), false);
    assert.equal(hasMuseumPermission(member, 'configuration'), false);
    assert.equal(hasMuseumPermission(administrator, 'donation_proof_manage'), true);
  });

  test('rejects a scanner from ticket administration', async () => {
    let statusCode: number | undefined;
    const hook = requireMuseumPermission('ticket_manage');
    await hook(
      { method: 'POST', user: { ...user, roles: ['museum_ticket_scan'] } } as any,
      { code: (code: number) => ({ send: () => { statusCode = code; } }) } as any,
    );
    assert.equal(statusCode, 403);
  });
});
