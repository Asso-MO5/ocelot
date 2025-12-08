import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Ajouter la colonne guided_tour_price pour stocker le prix de la visite guidée
  pgm.addColumn('tickets', {
    guided_tour_price: {
      type: 'decimal(10, 2)',
      notNull: false,
      default: 0,
      // Prix de la visite guidée (0 par défaut si pas de visite guidée)
    },
  });

  // Mettre à jour le commentaire de total_amount pour refléter le nouveau calcul
  pgm.sql(`
    COMMENT ON COLUMN tickets.total_amount IS 'Montant total (ticket_price + donation_amount + guided_tour_price)';
  `);
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropColumn('tickets', 'guided_tour_price');

  // Restaurer le commentaire original
  pgm.sql(`
    COMMENT ON COLUMN tickets.total_amount IS 'Montant total (ticket_price + donation_amount)';
  `);
};

