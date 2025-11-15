import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable('translations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    entity_type: {
      type: 'varchar(50)',
      notNull: true,
      // Type d'entité (ex: 'price', 'schedule', etc.)
    },
    entity_id: {
      type: 'uuid',
      notNull: true,
      // ID de l'entité référencée
    },
    field_name: {
      type: 'varchar(50)',
      notNull: true,
      // Nom du champ à traduire (ex: 'name', 'description')
    },
    lang: {
      type: 'varchar(10)',
      notNull: true,
      // Code de langue (ex: 'fr', 'en', 'es')
    },
    translation: {
      type: 'text',
      notNull: true,
      // Texte traduit
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

  // Contrainte d'unicité : une seule traduction par entité/champ/langue
  pgm.addConstraint('translations', 'translations_unique', {
    unique: ['entity_type', 'entity_id', 'field_name', 'lang'],
  });

  // Index pour les recherches rapides
  pgm.createIndex('translations', ['entity_type', 'entity_id']);
  pgm.createIndex('translations', ['entity_type', 'entity_id', 'field_name']);
  pgm.createIndex('translations', ['entity_type', 'entity_id', 'lang']);
  pgm.createIndex('translations', 'lang');
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('translations');
};

