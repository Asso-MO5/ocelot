import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration de transition pour supprimer les colonnes name et description
 * de la table prices si elles existent déjà (pour les bases de données existantes).
 * Ces champs sont maintenant gérés via la table translations.
 */
export const up = (pgm: MigrationBuilder) => {
  // Supprimer les colonnes name et description si elles existent
  // (pour les bases de données existantes créées avant cette migration)
  // Note: node-pg-migrate ne supporte pas directement les requêtes conditionnelles
  // On utilise un bloc DO PostgreSQL
  pgm.sql(`
    DO $$
    BEGIN
      -- Supprimer la colonne name si elle existe
      IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'prices' 
        AND column_name = 'name'
      ) THEN
        ALTER TABLE prices DROP COLUMN name;
      END IF;

      -- Supprimer la colonne description si elle existe
      IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'prices' 
        AND column_name = 'description'
      ) THEN
        ALTER TABLE prices DROP COLUMN description;
      END IF;
    END $$;
  `);
};

export const down = (pgm: MigrationBuilder) => {
  // Restaurer les colonnes si elles n'existent pas
  pgm.sql(`
    DO $$
    BEGIN
      -- Ajouter la colonne name si elle n'existe pas
      IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'prices' 
        AND column_name = 'name'
      ) THEN
        ALTER TABLE prices ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '';
      END IF;

      -- Ajouter la colonne description si elle n'existe pas
      IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'prices' 
        AND column_name = 'description'
      ) THEN
        ALTER TABLE prices ADD COLUMN description TEXT;
      END IF;
    END $$;
  `);
};

