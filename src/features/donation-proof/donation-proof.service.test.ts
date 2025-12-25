import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mountToLetter, generateDonationProofPDF, generateDonationProofFromTicket } from './donation-proof.service.ts';
import type { Ticket } from '../tickets/tickets.types.ts';

describe('Donation Proof Service', () => {
  describe('mountToLetter', () => {
    test('devrait convertir 0 en chaîne vide', () => {
      assert.equal(mountToLetter(0), '');
    });

    test('devrait convertir les nombres de 1 à 16', () => {
      assert.equal(mountToLetter(1), 'un');
      assert.equal(mountToLetter(5), 'cinq');
      assert.equal(mountToLetter(10), 'dix');
      assert.equal(mountToLetter(16), 'seize');
    });

    test('devrait convertir les nombres de 17 à 19', () => {
      assert.equal(mountToLetter(17), 'dix-sept');
      assert.equal(mountToLetter(18), 'dix-huit');
      assert.equal(mountToLetter(19), 'dix-neuf');
    });

    test('devrait convertir les dizaines', () => {
      assert.equal(mountToLetter(20), 'vingt');
      assert.equal(mountToLetter(30), 'trente');
      assert.equal(mountToLetter(50), 'cinquante');
    });

    test('devrait convertir les nombres composés', () => {
      assert.equal(mountToLetter(21), 'vingt-un');
      assert.equal(mountToLetter(22), 'vingt-deux');
      assert.equal(mountToLetter(25), 'vingt-cinq');
    });

    test('devrait convertir les centaines', () => {
      assert.equal(mountToLetter(100), 'cent');
      assert.equal(mountToLetter(200), 'deux cent ');
      assert.equal(mountToLetter(150), 'cent cinquante');
    });

    test('devrait convertir les milliers', () => {
      assert.equal(mountToLetter(1000), 'mille ');
      assert.equal(mountToLetter(2000), 'deux mille ');
    });

    test('devrait retourner "Nombre trop grand" pour les nombres >= 1000000', () => {
      assert.equal(mountToLetter(1000000), 'Nombre trop grand');
      assert.equal(mountToLetter(2000000), 'Nombre trop grand');
    });
  });

  describe('generateDonationProofFromTicket', () => {
    test('devrait retourner null si le ticket n\'a pas de don', async () => {
      const ticket: Partial<Ticket> = {
        id: 'test-id',
        qr_code: 'TEST123',
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'test@example.com',
        reservation_date: '2024-01-01',
        slot_start_time: '10:00:00',
        slot_end_time: '12:00:00',
        ticket_price: 10,
        donation_amount: 0,
        guided_tour_price: 0,
        total_amount: 10,
        status: 'paid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Ticket;

      const result = await generateDonationProofFromTicket(ticket as Ticket);

      assert.equal(result, null);
    });

    test('devrait retourner null si donation_amount est négatif', async () => {
      const ticket: Partial<Ticket> = {
        id: 'test-id',
        qr_code: 'TEST123',
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'test@example.com',
        reservation_date: '2024-01-01',
        slot_start_time: '10:00:00',
        slot_end_time: '12:00:00',
        ticket_price: 10,
        donation_amount: -5,
        guided_tour_price: 0,
        total_amount: 5,
        status: 'paid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Ticket;

      const result = await generateDonationProofFromTicket(ticket as Ticket);

      assert.equal(result, null);
    });

    test('devrait utiliser checkout_reference comme invoice_id si disponible', async () => {
      const ticket: Ticket = {
        id: 'test-id',
        qr_code: 'TEST123',
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'test@example.com',
        reservation_date: '2024-01-01',
        slot_start_time: '10:00:00',
        slot_end_time: '12:00:00',
        checkout_id: null,
        checkout_reference: 'CHECKOUT-REF-123',
        transaction_status: null,
        ticket_price: 10,
        donation_amount: 50,
        guided_tour_price: 0,
        total_amount: 60,
        status: 'paid',
        used_at: null,
        notes: null,
        language: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await generateDonationProofFromTicket(ticket);

      assert.notEqual(result, null);
      assert.ok(Buffer.isBuffer(result));
    });

    test('devrait utiliser checkout_id comme invoice_id si checkout_reference n\'existe pas', async () => {
      const ticket: Ticket = {
        id: 'test-id',
        qr_code: 'TEST123',
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'test@example.com',
        reservation_date: '2024-01-01',
        slot_start_time: '10:00:00',
        slot_end_time: '12:00:00',
        checkout_id: 'checkout-id-123',
        checkout_reference: null,
        transaction_status: null,
        ticket_price: 10,
        donation_amount: 50,
        guided_tour_price: 0,
        total_amount: 60,
        status: 'paid',
        used_at: null,
        notes: null,
        language: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await generateDonationProofFromTicket(ticket);

      assert.notEqual(result, null);
      assert.ok(Buffer.isBuffer(result));
    });

    test('devrait utiliser l\'ID du ticket comme invoice_id si ni checkout_reference ni checkout_id n\'existent', async () => {
      const ticket: Ticket = {
        id: 'test-ticket-id-12345',
        qr_code: 'TEST123',
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'test@example.com',
        reservation_date: '2024-01-01',
        slot_start_time: '10:00:00',
        slot_end_time: '12:00:00',
        checkout_id: null,
        checkout_reference: null,
        transaction_status: null,
        ticket_price: 10,
        donation_amount: 50,
        guided_tour_price: 0,
        total_amount: 60,
        status: 'paid',
        used_at: null,
        notes: null,
        language: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await generateDonationProofFromTicket(ticket);

      assert.notEqual(result, null);
      assert.ok(Buffer.isBuffer(result));
    });

    test('devrait gérer donation_amount comme string', async () => {
      const ticket: Ticket = {
        id: 'test-id',
        qr_code: 'TEST123',
        first_name: 'Jean',
        last_name: 'Dupont',
        email: 'test@example.com',
        reservation_date: '2024-01-01',
        slot_start_time: '10:00:00',
        slot_end_time: '12:00:00',
        checkout_id: null,
        checkout_reference: null,
        transaction_status: null,
        ticket_price: 10,
        donation_amount: '50' as any,
        guided_tour_price: 0,
        total_amount: 60,
        status: 'paid',
        used_at: null,
        notes: null,
        language: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await generateDonationProofFromTicket(ticket);

      assert.notEqual(result, null);
      assert.ok(Buffer.isBuffer(result));
    });
  });

  describe('generateDonationProofPDF', () => {
    test('devrait générer un PDF avec les données fournies', async () => {
      const testData = {
        amount: 50.00,
        first_name: 'Jean',
        last_name: 'Dupont',
        address: '123 Rue de la République',
        postal_code: '75001',
        city: 'Paris',
        date: new Date(),
        invoice_id: 'TEST-12345',
      };

      const result = await generateDonationProofPDF(testData);

      assert.ok(Buffer.isBuffer(result));
      assert.ok(result.length > 0);
    });

    test('devrait générer un PDF même sans adresse', async () => {
      const testData = {
        amount: 50.00,
        first_name: 'Jean',
        last_name: 'Dupont',
        date: new Date(),
        invoice_id: 'TEST-12345',
      };

      const result = await generateDonationProofPDF(testData);

      assert.ok(Buffer.isBuffer(result));
      assert.ok(result.length > 0);
    });
  });
});

