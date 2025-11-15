import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Créer l'enum pour le statut du ticket
  pgm.createType('ticket_status', ['pending', 'paid', 'cancelled', 'used', 'expired']);

  pgm.createTable('tickets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // Code QR unique pour le scan
    qr_code: {
      type: 'varchar(8)',
      notNull: true,
      unique: true,
      // Code alphanumérique majuscules (8 caractères = 36^8 combinaisons)
    },
    // Informations utilisateur (optionnel sauf email)
    first_name: {
      type: 'varchar(255)',
      // Prénom (optionnel)
    },
    last_name: {
      type: 'varchar(255)',
      // Nom (optionnel)
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      // Email obligatoire pour recevoir le ticket
    },
    // Informations de réservation
    reservation_date: {
      type: 'date',
      notNull: true,
      // Date de la réservation (jour)
    },
    slot_start_time: {
      type: 'time',
      notNull: true,
      // Heure de début du créneau horaire
    },
    slot_end_time: {
      type: 'time',
      notNull: true,
      // Heure de fin du créneau horaire
    },
    // Informations de transaction (SumUp)
    checkout_id: {
      type: 'varchar(255)',
      // ID du checkout SumUp
    },
    checkout_reference: {
      type: 'varchar(255)',
      // Référence du checkout SumUp
    },
    transaction_status: {
      type: 'varchar(50)',
      // Statut de la transaction SumUp (ex: 'PAID', 'PENDING', etc.)
    },
    // Montants
    ticket_price: {
      type: 'decimal(10, 2)',
      notNull: true,
      // Prix du ticket
    },
    donation_amount: {
      type: 'decimal(10, 2)',
      default: 0,
      // Montant du don optionnel (0 par défaut)
    },
    total_amount: {
      type: 'decimal(10, 2)',
      notNull: true,
      // Montant total (ticket_price + donation_amount)
    },
    // Statut du ticket
    status: {
      type: 'ticket_status',
      notNull: true,
      default: 'pending',
      // Statut du ticket (pending, paid, cancelled, used, expired)
    },
    // Date d'utilisation (si le ticket a été scanné)
    used_at: {
      type: 'timestamp',
      // Date/heure où le ticket a été utilisé (scanné)
    },
    // Informations supplémentaires
    notes: {
      type: 'text',
      // Notes optionnelles
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Index pour les recherches rapides
  pgm.createIndex('tickets', 'qr_code');
  pgm.createIndex('tickets', 'email');
  pgm.createIndex('tickets', 'reservation_date');
  pgm.createIndex('tickets', 'status');
  pgm.createIndex('tickets', 'checkout_id');
  pgm.createIndex('tickets', 'checkout_reference');
  pgm.createIndex('tickets', ['reservation_date', 'slot_start_time', 'slot_end_time']);
  pgm.createIndex('tickets', ['status', 'reservation_date']);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('tickets');
  pgm.dropType('ticket_status');
};

