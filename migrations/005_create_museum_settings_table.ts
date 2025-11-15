import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable('museum_settings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    key: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
      // Clé unique pour identifier le paramètre (ex: "max_capacity", "current_visitors")
    },
    value: {
      type: 'text',
      notNull: true,
      // Valeur du paramètre (peut être un nombre, JSON, etc.)
    },
    value_type: {
      type: 'varchar(50)',
      notNull: true,
      default: 'string',
      // Type de la valeur : 'string', 'number', 'boolean', 'json'
    },
    description: {
      type: 'text',
      // Description du paramètre
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

  // Index pour la recherche rapide par clé
  pgm.createIndex('museum_settings', 'key');

  // Insérer les paramètres par défaut
  pgm.sql(`
    INSERT INTO museum_settings (key, value, value_type, description) VALUES
    ('max_capacity', '0', 'number', 'Capacité maximale d''accueil du musée'),
    ('current_visitors', '0', 'number', 'Nombre actuel de visiteurs dans le musée')
  `);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('museum_settings');
};

