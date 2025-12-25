import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { emailUtils } from './email.utils.ts';

const originalFetch = global.fetch;
const originalEnv = process.env;

describe('Email Utils', () => {
  beforeEach(() => {
    process.env.EMAIL_API_URL = 'https://api.test.com/send';
    process.env.EMAIL_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe('sendEmail', () => {
    test('devrait envoyer un email simple sans pièce jointe', async () => {
      const mockResponse = {
        messageId: 'test-message-id',
        status: 'sent',
      };

      global.fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => mockResponse,
        } as Response;
      };

      const result = await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
      });

      assert.deepEqual(result, mockResponse);
    });

    test('devrait envoyer un email avec pièces jointes', async () => {
      const mockResponse = {
        messageId: 'test-message-id',
        status: 'sent',
      };

      let capturedPayload: any = null;

      global.fetch = async (url: any, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => mockResponse,
        } as Response;
      };

      const attachments = [
        {
          name: 'test.pdf',
          content: 'dGVzdA==',
          contentType: 'application/pdf',
        },
      ];

      await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
        attachments,
      });

      assert.ok(capturedPayload);
      assert.ok(Array.isArray(capturedPayload.attachment));
      assert.equal(capturedPayload.attachment.length, 1);
      assert.equal(capturedPayload.attachment[0].name, 'test.pdf');
      assert.equal(capturedPayload.attachment[0].content, 'dGVzdA==');
      assert.equal(capturedPayload.attachment[0].contentType, 'application/pdf');
    });

    test('devrait utiliser l\'expéditeur français pour la langue "fr"', async () => {
      let capturedPayload: any = null;

      global.fetch = async (url: any, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      };

      await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
      });

      assert.equal(capturedPayload.sender.name, 'Le Musée du Jeu Vidéo');
      assert.equal(capturedPayload.sender.email, 'ne-pas-repondre@lemuseedujeuvideo.fr');
    });

    test('devrait utiliser l\'expéditeur anglais pour la langue "en"', async () => {
      let capturedPayload: any = null;

      global.fetch = async (url: any, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      };

      await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'en',
      });

      assert.equal(capturedPayload.sender.name, 'The Video Game Museum');
      assert.equal(capturedPayload.sender.email, 'no-reply@lemuseedujeuvideo.fr');
    });

    test('devrait inclure les informations du destinataire', async () => {
      let capturedPayload: any = null;

      global.fetch = async (url: any, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      };

      await emailUtils.sendEmail({
        email: 'recipient@example.com',
        name: 'Recipient Name',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
      });

      assert.ok(Array.isArray(capturedPayload.to));
      assert.equal(capturedPayload.to.length, 1);
      assert.equal(capturedPayload.to[0].email, 'recipient@example.com');
      assert.equal(capturedPayload.to[0].name, 'Recipient Name');
    });

    test('devrait inclure le sujet et le corps HTML', async () => {
      let capturedPayload: any = null;

      global.fetch = async (url: any, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      };

      await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'My Subject',
        body: '<p>My HTML body</p>',
        language: 'fr',
      });

      assert.equal(capturedPayload.subject, 'My Subject');
      assert.equal(capturedPayload.htmlContent, '<p>My HTML body</p>');
    });

    test('ne devrait pas inclure le champ attachment si aucune pièce jointe n\'est fournie', async () => {
      let capturedPayload: any = null;

      global.fetch = async (url: any, options: any) => {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      };

      await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
      });

      assert.equal(capturedPayload.attachment, undefined);
    });

    test('devrait utiliser les variables d\'environnement pour l\'URL et la clé API', async () => {
      let capturedUrl: string = '';
      let capturedHeaders: any = {};

      global.fetch = async (url: any, options: any) => {
        capturedUrl = url as string;
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      };

      await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
      });

      assert.equal(capturedUrl, 'https://api.test.com/send');
      assert.equal(capturedHeaders['api-key'], 'test-api-key');
      assert.equal(capturedHeaders['content-type'], 'application/json');
      assert.equal(capturedHeaders['accept'], 'application/json');
    });

    test('devrait utiliser des valeurs par défaut si les variables d\'environnement ne sont pas définies', async () => {
      delete process.env.EMAIL_API_URL;
      delete process.env.EMAIL_API_KEY;

      let capturedUrl: string = '';
      let capturedHeaders: any = {};

      global.fetch = async (url: any, options: any) => {
        capturedUrl = url as string;
        capturedHeaders = options.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response;
      };

      await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
      });

      assert.equal(capturedUrl, '');
      assert.equal(capturedHeaders['api-key'], '');
    });

    test('devrait propager les erreurs lors de l\'envoi', async () => {
      const error = new Error('Network error');

      global.fetch = async () => {
        throw error;
      };

      await assert.rejects(
        async () => {
          await emailUtils.sendEmail({
            email: 'test@example.com',
            name: 'Test User',
            subject: 'Test Subject',
            body: '<p>Test body</p>',
            language: 'fr',
          });
        },
        {
          message: 'Network error',
        }
      );
    });

    test('devrait propager les erreurs de l\'API', async () => {
      global.fetch = async () => {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'API error' }),
        } as Response;
      };

      const result = await emailUtils.sendEmail({
        email: 'test@example.com',
        name: 'Test User',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
        language: 'fr',
      });

      assert.deepEqual(result, { error: 'API error' });
    });
  });
});

