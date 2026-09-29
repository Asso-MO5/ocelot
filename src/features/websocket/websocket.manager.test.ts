import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { sendToRoom } from './websocket.manager.ts';

describe('WebSocket Manager', () => {
  const originalFetch = globalThis.fetch;
  const originalMilena = process.env.MILENA;
  const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

  beforeEach(() => {
    requests.length = 0;
    process.env.MILENA = 'https://milena.test';
    globalThis.fetch = async (input, init) => {
      requests.push({ input, init });
      return new Response(null, { status: 202 });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalMilena === undefined) {
      delete process.env.MILENA;
    } else {
      process.env.MILENA = originalMilena;
    }
  });

  test('transmet une action de room au fournisseur WebSocket', async () => {
    await sendToRoom('museum-capacity', 'refresh');

    assert.equal(requests.length, 1);
    assert.equal(requests[0].input, 'https://milena.test/send');
    assert.deepEqual(requests[0].init, {
      method: 'POST',
      body: JSON.stringify({ room: 'museum-capacity', action: 'refresh' }),
      headers: {
        'Content-Type': 'application/json',
        'x-provider-id': 'ocelot',
      },
    });
  });

  test('absorbe une indisponibilité du fournisseur sans bloquer le flux métier', async () => {
    globalThis.fetch = async () => {
      throw new Error('provider unavailable');
    };
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      await assert.doesNotReject(sendToRoom('museum-capacity', 'refresh'));
    } finally {
      console.error = originalConsoleError;
    }
  });
});
