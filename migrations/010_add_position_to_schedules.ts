import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Ajouter la colonne position
  pgm.addColumn('schedules', {
    position: {
      type: 'integer',
      notNull: false, // Nullable pour les anciens enregistrements
      default: null,
    },
  });

  // Initialiser les positions pour les horaires existants
  // On initialise la position basée sur l'ordre actuel (is_exception, day_of_week, start_time)
  pgm.sql(`
    WITH ordered_schedules AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          ORDER BY 
            is_exception ASC,
            day_of_week ASC NULLS LAST,
            start_time ASC
        ) as new_position
      FROM schedules
    )
    UPDATE schedules s
    SET position = os.new_position
    FROM ordered_schedules os
    WHERE s.id = os.id;
  `);

  // Maintenant que toutes les positions sont définies, on peut rendre la colonne NOT NULL
  pgm.alterColumn('schedules', 'position', {
    notNull: true,
    default: null, // Pas de default, doit être défini explicitement
  });

  // Créer un index pour améliorer les performances de tri
  pgm.createIndex('schedules', 'position');
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropIndex('schedules', 'position');
  pgm.dropColumn('schedules', 'position');
};

