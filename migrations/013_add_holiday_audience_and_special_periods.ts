import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Ajouter 'holiday' à l'enum audience_type
  pgm.sql(`
    ALTER TYPE audience_type ADD VALUE IF NOT EXISTS 'holiday';
  `);

  // Créer la table pour les périodes spéciales (vacances, fermetures)
  pgm.createType('special_period_type', ['holiday', 'closure']);

  pgm.createTable('special_periods', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    type: {
      type: 'special_period_type',
      notNull: true,
      // Type de période : 'holiday' (vacances) ou 'closure' (fermeture)
    },
    start_date: {
      type: 'date',
      notNull: true,
      // Date de début de la période
    },
    end_date: {
      type: 'date',
      notNull: true,
      // Date de fin de la période
    },
    name: {
      type: 'varchar(255)',
      // Nom de la période (ex: "Vacances de Noël 2024", "Fermeture annuelle")
    },
    description: {
      type: 'text',
      // Description optionnelle
    },
    zone: {
      type: 'varchar(50)',
      // Zone pour les vacances scolaires (ex: "A", "B", "C", "all")
      // Null pour les fermetures
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
      // Permet de désactiver une période sans la supprimer
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

  // Contrainte : end_date doit être >= start_date
  pgm.addConstraint('special_periods', 'special_periods_dates_check', {
    check: 'end_date >= start_date',
  });

  // Index pour les recherches rapides
  pgm.createIndex('special_periods', 'type');
  pgm.createIndex('special_periods', ['start_date', 'end_date']);
  pgm.createIndex('special_periods', ['type', 'is_active']);
  pgm.createIndex('special_periods', 'zone');
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('special_periods');
  pgm.dropType('special_period_type');
  // Note: On ne peut pas retirer une valeur d'un enum en PostgreSQL facilement
  // Il faudrait recréer l'enum, mais cela pourrait casser les données existantes
  // On laisse donc 'holiday' dans l'enum même après le rollback
};

