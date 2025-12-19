import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Créer l'enum pour la période de présence
  pgm.createType('presence_period', ['morning', 'afternoon', 'both']);

  pgm.createTable('member_presences', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    date: {
      type: 'date',
      notNull: true,
      // Date de présence
    },
    period: {
      type: 'presence_period',
      notNull: true,
      // Période : matin, après-midi, ou les deux
    },
    refused_by_admin: {
      type: 'boolean',
      notNull: true,
      default: false,
      // Indique si l'admin a refusé cette présence
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

  // Contrainte unique : un membre ne peut avoir qu'une seule présence par date
  pgm.addConstraint('member_presences', 'member_presences_user_date_unique', {
    unique: ['user_id', 'date'],
  });

  // Index pour la recherche rapide par date
  pgm.createIndex('member_presences', 'date');
  // Index pour la recherche rapide par user_id
  pgm.createIndex('member_presences', 'user_id');
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('member_presences');
  pgm.dropType('presence_period');
};

