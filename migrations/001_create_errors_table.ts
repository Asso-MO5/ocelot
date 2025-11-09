import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable('errors', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    error_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    error_message: {
      type: 'text',
      notNull: true,
    },
    stack_trace: {
      type: 'text',
    },
    status_code: {
      type: 'integer',
      notNull: true,
      default: 500,
    },
    url: {
      type: 'varchar(2048)',
    },
    method: {
      type: 'varchar(10)',
    },
    ip: {
      type: 'varchar(45)',
    },
    error_type: {
      type: 'varchar(50)',
      notNull: true,
      default: 'Route Error',
    },
    error_hash: {
      type: 'varchar(64)',
      notNull: true,
    },
    sent_to_discord: {
      type: 'boolean',
      notNull: true,
      default: false,
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

  // Index pour la recherche rapide de doublons
  pgm.createIndex('errors', 'error_hash');
  pgm.createIndex('errors', 'created_at');
  pgm.createIndex('errors', ['error_hash', 'created_at']);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('errors');
};

