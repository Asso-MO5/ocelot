import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  hasAllRoles,
  hasAnyRole,
  hasMuseumScope,
  hasRole,
  requireAuth,
  requireMuseumScope,
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

  test('enforces one explicit museum scope per action', () => {
    const mediator = { ...user, roles: ['membre', 'museum_mediateur'] };
    const configurator = { ...user, roles: ['museum_configuration'] };
    const member = { ...user, roles: ['membre'] };
    const administrator = { ...user, roles: ['museum_administrateur'] };

    assert.equal(hasMuseumScope(mediator, 'ticket_scan'), true);
    assert.equal(hasMuseumScope(mediator, 'ticket_manage'), false);
    assert.equal(hasMuseumScope(configurator, 'configuration'), true);
    assert.equal(hasMuseumScope(configurator, 'ticket_scan'), false);
    assert.equal(hasMuseumScope(member, 'ticket_scan'), false);
    assert.equal(hasMuseumScope(administrator, 'donation_proof_manage'), false);
    assert.equal(hasMuseumScope({ ...user, roles: ['dev'] }, 'configuration'), false);
  });

  test('rejects a mediator from ticket administration', async () => {
    let statusCode: number | undefined;
    const hook = requireMuseumScope('ticket_manage');
    await hook(
      { method: 'POST', user: { ...user, roles: ['museum_mediateur'] } } as any,
      { code: (code: number) => ({ send: () => { statusCode = code; } }) } as any,
    );
    assert.equal(statusCode, 403);
  });
});
