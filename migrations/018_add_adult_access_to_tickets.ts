import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  pgm.addColumns('tickets', {
    adult_access: { type: 'boolean', notNull: true, default: false },
    adult_access_amount: { type: 'decimal(10, 2)', notNull: true, default: 0 },
    adult_access_label: { type: 'varchar(255)' },
  });

  pgm.sql(`
    INSERT INTO museum_settings (key, value, value_type, description)
    VALUES (
      'adult_access_option',
      '{"enabled":false,"amount":0,"label":"Accès zone réservée aux majeurs"}',
      'json',
      'Configuration de l''option d''accès réservée aux majeurs'
    )
    ON CONFLICT (key) DO NOTHING;
  `);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropColumns('tickets', ['adult_access', 'adult_access_amount', 'adult_access_label']);
  pgm.sql("DELETE FROM museum_settings WHERE key = 'adult_access_option'");
};
