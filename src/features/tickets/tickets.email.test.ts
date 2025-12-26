import { strict as assert } from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { sendTicketsConfirmationEmails } from './tickets.email.ts';
import type { Ticket } from './tickets.types.ts';

interface MockWithTracking {
  (...args: any[]): any;
  mock: {
    calls: any[][];
    callCount(): number;
  };
}

function createMockFn(returnValue?: any, chainTarget?: any): MockWithTracking {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    return returnValue ?? chainTarget ?? fn;
  }) as MockWithTracking;
  fn.mock = {
    calls,
    callCount: () => calls.length,
  };
  return fn;
}

function createMockApp(): FastifyInstance {
  const app: any = {
    log: {
      error: createMockFn(),
      info: createMockFn(),
      warn: createMockFn(),
      debug: createMockFn(),
    },
  };

  return app as unknown as FastifyInstance;
}

function createMockTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    qr_code: 'ABC12345',
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    reservation_date: '2025-12-31',
    slot_start_time: '10:00:00',
    slot_end_time: '12:00:00',
    ticket_price: 10,
    donation_amount: 0,
    guided_tour_price: 0,
    total_amount: 10,
    status: 'paid',
    language: 'fr',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as Ticket;
}

describe('Tickets Email', () => {
  let originalSendEmail: any;
  let sendEmailCalls: any[];
  let emailUtilsModule: any;

  beforeEach(async () => {
    sendEmailCalls = [];

    emailUtilsModule = await import('../email/email.utils.ts');
    originalSendEmail = emailUtilsModule.emailUtils.sendEmail;

    emailUtilsModule.emailUtils.sendEmail = async (data: any) => {
      sendEmailCalls.push(data);
      return { success: true };
    };
  });

  afterEach(async () => {
    if (originalSendEmail && emailUtilsModule) {
      emailUtilsModule.emailUtils.sendEmail = originalSendEmail;
    }
  });

  describe('sendTicketsConfirmationEmails', () => {
    test('ne devrait rien faire si aucun ticket', async () => {
      const app = createMockApp();
      await sendTicketsConfirmationEmails(app, []);
      assert.equal(sendEmailCalls.length, 0);
    });

    test('devrait envoyer un email pour un seul ticket', async () => {
      const app = createMockApp();
      const ticket = createMockTicket({ status: 'paid' });

      const originalImport = (globalThis as any).import;
      (globalThis as any).import = async (path: string) => {
        if (path.includes('tickets.pdf.ts')) {
          return {
            generateTicketPDF: async () => Buffer.from('fake-pdf')
          };
        }
        return originalImport ? originalImport(path) : {};
      };

      try {
        await sendTicketsConfirmationEmails(app, [ticket]);
      } catch (error) {
        app.log.error({ error }, 'Erreur lors de l\'envoi de l\'email');
      }

      (globalThis as any).import = originalImport;

      assert.equal(sendEmailCalls.length, 1);
      assert.equal(sendEmailCalls[0].email, ticket.email);
      assert.equal(sendEmailCalls[0].subject, 'Votre billet pour le Musée du Jeu Vidéo');
      assert.equal(sendEmailCalls[0].attachments?.length, 1);
      assert.equal(sendEmailCalls[0].attachments[0].name, `billet-${ticket.qr_code}.pdf`);
    });

    test('devrait envoyer un seul email groupé pour plusieurs tickets', async () => {
      const app = createMockApp();
      const ticket1 = createMockTicket({ id: 'ticket-1', qr_code: 'ABC12345', status: 'paid' });
      const ticket2 = createMockTicket({ id: 'ticket-2', qr_code: 'DEF67890', status: 'paid' });
      const ticket3 = createMockTicket({ id: 'ticket-3', qr_code: 'GHI11111', status: 'paid' });

      const originalImport = (globalThis as any).import;
      (globalThis as any).import = async (path: string) => {
        if (path.includes('tickets.pdf.ts')) {
          return {
            generateTicketPDF: async () => Buffer.from('fake-pdf')
          };
        }
        if (path.includes('qrcode')) {
          return {
            default: {
              toDataURL: async () => 'data:image/png;base64,fake-qr-code'
            }
          };
        }
        return originalImport ? originalImport(path) : {};
      };

      await sendTicketsConfirmationEmails(app, [ticket1, ticket2, ticket3]);

      (globalThis as any).import = originalImport;

      assert.equal(sendEmailCalls.length, 1, 'Un seul email devrait être envoyé pour plusieurs tickets');
      assert.equal(sendEmailCalls[0].email, ticket1.email);
      assert.equal(sendEmailCalls[0].subject, 'Vos billets pour le Musée du Jeu Vidéo');
      assert.equal(sendEmailCalls[0].attachments?.length, 3, 'Tous les PDFs devraient être attachés');
      assert.equal(sendEmailCalls[0].attachments[0].name, `billet-${ticket1.qr_code}.pdf`);
      assert.equal(sendEmailCalls[0].attachments[1].name, `billet-${ticket2.qr_code}.pdf`);
      assert.equal(sendEmailCalls[0].attachments[2].name, `billet-${ticket3.qr_code}.pdf`);
      assert.ok(sendEmailCalls[0].body.includes('Billet 1'), 'Le corps de l\'email devrait contenir "Billet 1"');
      assert.ok(sendEmailCalls[0].body.includes('Billet 2'), 'Le corps de l\'email devrait contenir "Billet 2"');
      assert.ok(sendEmailCalls[0].body.includes('Billet 3'), 'Le corps de l\'email devrait contenir "Billet 3"');
    });

    test('ne devrait envoyer que les tickets payés dans l\'email groupé', async () => {
      const app = createMockApp();
      const ticket1 = createMockTicket({ id: 'ticket-1', qr_code: 'ABC12345', status: 'paid' });
      const ticket2 = createMockTicket({ id: 'ticket-2', qr_code: 'DEF67890', status: 'pending' });
      const ticket3 = createMockTicket({ id: 'ticket-3', qr_code: 'GHI11111', status: 'paid' });

      const originalImport = (globalThis as any).import;
      (globalThis as any).import = async (path: string) => {
        if (path.includes('tickets.pdf.ts')) {
          return {
            generateTicketPDF: async () => Buffer.from('fake-pdf')
          };
        }
        return originalImport ? originalImport(path) : {};
      };

      await sendTicketsConfirmationEmails(app, [ticket1, ticket2, ticket3]);

      (globalThis as any).import = originalImport;

      assert.equal(sendEmailCalls.length, 1);
      assert.equal(sendEmailCalls[0].attachments?.length, 2, 'Seulement les tickets payés devraient avoir des PDFs');
      assert.equal(sendEmailCalls[0].attachments[0].name, `billet-${ticket1.qr_code}.pdf`);
      assert.equal(sendEmailCalls[0].attachments[1].name, `billet-${ticket3.qr_code}.pdf`);
    });

    test('ne devrait pas envoyer d\'email si aucun ticket payé', async () => {
      const app = createMockApp();
      const ticket1 = createMockTicket({ id: 'ticket-1', status: 'pending' });
      const ticket2 = createMockTicket({ id: 'ticket-2', status: 'pending' });

      await sendTicketsConfirmationEmails(app, [ticket1, ticket2]);

      assert.equal(sendEmailCalls.length, 0, 'Aucun email ne devrait être envoyé si aucun ticket n\'est payé');
    });
  });
});

