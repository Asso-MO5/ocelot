import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Ajouter le champ language à la table tickets
  pgm.addColumn('tickets', {
    language: {
      type: 'varchar(10)',
      // Code de langue (ex: 'fr', 'en', 'es')
      // Optionnel, peut être null pour les tickets existants
    },
  });
};

export const down = (pgm: MigrationBuilder) => {
  // Supprimer le champ language de la table tickets
  pgm.dropColumn('tickets', 'language');
};

