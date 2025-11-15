import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Créer l'enum pour le type d'audience
  pgm.createType('audience_type', ['public', 'member']);

  pgm.createTable('schedules', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    day_of_week: {
      type: 'integer',
      // 0 = dimanche, 1 = lundi, ..., 6 = samedi
      // Nullable pour permettre les exceptions sans jour spécifique
    },
    start_time: {
      type: 'time',
      notNull: true,
    },
    end_time: {
      type: 'time',
      notNull: true,
    },
    audience_type: {
      type: 'audience_type',
      notNull: true,
    },
    // Pour les horaires spécifiques par période (vacances, etc.)
    start_date: {
      type: 'date',
    },
    end_date: {
      type: 'date',
    },
    // Pour marquer les exceptions (fermetures, jours spéciaux)
    is_exception: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    // Pour les jours de fermeture
    is_closed: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    // Description de l'exception ou du changement d'horaire
    description: {
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

  // Contrainte : si is_exception est true, start_date et end_date doivent être définis
  pgm.addConstraint('schedules', 'schedules_exception_dates_check', {
    check: '(is_exception = false) OR (is_exception = true AND start_date IS NOT NULL AND end_date IS NOT NULL)',
  });

  // Contrainte : pour les horaires récurrents (non exception), day_of_week doit être défini
  pgm.addConstraint('schedules', 'schedules_recurrent_day_check', {
    check: '(is_exception = true) OR (is_exception = false AND day_of_week IS NOT NULL)',
  });

  // Index pour les recherches rapides
  pgm.createIndex('schedules', 'day_of_week');
  pgm.createIndex('schedules', 'audience_type');
  pgm.createIndex('schedules', 'is_exception');
  pgm.createIndex('schedules', ['start_date', 'end_date']);
  pgm.createIndex('schedules', ['day_of_week', 'audience_type', 'is_exception']);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('schedules');
  pgm.dropType('audience_type');
};

