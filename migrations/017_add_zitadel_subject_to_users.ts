import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  pgm.alterColumn('users', 'discord_id', { notNull: false });
  pgm.addColumn('users', {
    zitadel_subject: {
      type: 'varchar(255)',
      unique: true,
    },
  });
};

export const down = (pgm: MigrationBuilder) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM users
        WHERE zitadel_subject IS NOT NULL OR discord_id IS NULL
      ) THEN
        RAISE EXCEPTION
          'Rollback impossible : des identités Zitadel ou des utilisateurs sans discord_id existent';
      END IF;
    END $$;
  `);
  pgm.dropColumn('users', 'zitadel_subject');
  pgm.alterColumn('users', 'discord_id', { notNull: true });
};
