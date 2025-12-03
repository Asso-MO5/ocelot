import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Créer l'enum pour le statut du code cadeau
  pgm.createType('gift_code_status', ['unused', 'used', 'expired']);

  pgm.createTable('gift_codes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    // Code unique (12 caractères alphanumériques majuscules)
    code: {
      type: 'varchar(12)',
      notNull: true,
      unique: true,
    },
    // Statut du code
    status: {
      type: 'gift_code_status',
      notNull: true,
      default: 'unused',
    },
    // Ticket associé (null si non utilisé)
    ticket_id: {
      type: 'uuid',
    },
    // Pack auquel appartient ce code (optionnel, pour grouper les codes créés ensemble)
    pack_id: {
      type: 'uuid',
      // Référence vers une table gift_code_packs si on veut gérer les packs
      // Pour l'instant, on stocke juste un UUID pour grouper
    },
    // Email du destinataire (pour la distribution par email)
    recipient_email: {
      type: 'varchar(255)',
    },
    // Date d'expiration (optionnelle)
    expires_at: {
      type: 'timestamp',
    },
    // Date d'utilisation
    used_at: {
      type: 'timestamp',
    },
    // Informations supplémentaires
    notes: {
      type: 'text',
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

  // Créer la contrainte de clé étrangère pour ticket_id
  pgm.sql(`
    ALTER TABLE gift_codes 
    ADD CONSTRAINT gift_codes_ticket_id_fkey 
    FOREIGN KEY (ticket_id) 
    REFERENCES tickets(id) 
    ON DELETE SET NULL;
  `);

  // Index pour les recherches rapides
  pgm.createIndex('gift_codes', 'code');
  pgm.createIndex('gift_codes', 'status');
  pgm.createIndex('gift_codes', 'ticket_id');
  pgm.createIndex('gift_codes', 'pack_id');
  pgm.createIndex('gift_codes', 'recipient_email');
  pgm.createIndex('gift_codes', ['status', 'expires_at']);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('gift_codes');
  pgm.dropType('gift_code_status');
};

