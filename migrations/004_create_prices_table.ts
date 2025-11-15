import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Réutiliser l'enum audience_type existant ou le créer s'il n'existe pas
  // On vérifie d'abord s'il existe déjà (créé dans la migration schedules)

  pgm.createTable('prices', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    amount: {
      type: 'decimal(10, 2)',
      notNull: true,
      // Montant en euros
    },
    audience_type: {
      type: 'audience_type',
      notNull: true,
      // Type d'audience (public ou member)
    },
    // Pour gérer les changements de prix dans le temps
    start_date: {
      type: 'date',
      // Date de début de validité du tarif (null = valide indéfiniment)
    },
    end_date: {
      type: 'date',
      // Date de fin de validité du tarif (null = valide indéfiniment)
    },
    // Pour marquer les tarifs comme inactifs sans les supprimer
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
      // Indique si le tarif est actif
    },
    // Indique si le tarif nécessite un justificatif (ex: tarif réduit étudiant, senior, etc.)
    requires_proof: {
      type: 'boolean',
      notNull: true,
      default: false,
      // Indique si le tarif nécessite un justificatif
    },
    // Note: name et description sont maintenant gérés via la table translations
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
  pgm.createIndex('prices', 'audience_type');
  pgm.createIndex('prices', 'is_active');
  pgm.createIndex('prices', ['start_date', 'end_date']);
  pgm.createIndex('prices', ['audience_type', 'is_active']);

  // Index composite pour récupérer les tarifs actifs pour une date donnée
  pgm.createIndex('prices', ['is_active', 'start_date', 'end_date']);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('prices');
};

