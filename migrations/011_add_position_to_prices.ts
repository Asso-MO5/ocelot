import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Ajouter la colonne position
  pgm.addColumn('prices', {
    position: {
      type: 'integer',
      notNull: false, // Nullable pour les anciens enregistrements
      default: null,
    },
  });

  // Initialiser les positions pour les tarifs existants
  // On initialise la position basée sur l'ordre actuel (audience_type, amount)
  pgm.sql(`
    WITH ordered_prices AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          ORDER BY 
            audience_type ASC,
            amount ASC
        ) as new_position
      FROM prices
    )
    UPDATE prices p
    SET position = op.new_position
    FROM ordered_prices op
    WHERE p.id = op.id;
  `);

  // Maintenant que toutes les positions sont définies, on peut rendre la colonne NOT NULL
  pgm.alterColumn('prices', 'position', {
    notNull: true,
    default: null, // Pas de default, doit être défini explicitement
  });

  // Créer un index pour améliorer les performances de tri
  pgm.createIndex('prices', 'position');
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropIndex('prices', 'position');
  pgm.dropColumn('prices', 'position');
};

