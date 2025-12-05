import type { MigrationBuilder } from 'node-pg-migrate';

export const up = (pgm: MigrationBuilder) => {
  // Créer les enums
  pgm.createType('event_type', ['museum', 'association', 'external']);
  pgm.createType('event_category', [
    'live',
    'mediation',
    'workshop',
    'conference',
    'exhibition',
    'other',
  ]);
  pgm.createType('event_status', ['draft', 'private', 'member', 'public']);
  pgm.createType('event_manager_role', ['dev', 'bureau', 'museum', 'com']);

  // Table principale des événements
  pgm.createTable('events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    type: {
      type: 'event_type',
      notNull: true,
      // Type d'événement : museum, association, external
    },
    category: {
      type: 'event_category',
      // Catégorie pour les événements musée (live, médiation, atelier...)
      // Null pour association et external
    },
    status: {
      type: 'event_status',
      notNull: true,
      default: 'draft',
      // Statut de visibilité : draft (admin uniquement), private, member, public
    },
    // Dates et heures
    start_date: {
      type: 'date',
      notNull: true,
      // Date de début de l'événement
    },
    end_date: {
      type: 'date',
      // Date de fin (optionnel pour les événements d'une journée)
    },
    start_time: {
      type: 'time',
      // Heure de début (optionnel)
    },
    end_time: {
      type: 'time',
      // Heure de fin (optionnel)
    },
    // Localisation
    location_type: {
      type: 'varchar(50)',
      notNull: true,
      default: 'museum',
      // 'museum' ou 'external'
    },
    location_name: {
      type: 'varchar(255)',
      // Nom du lieu (ex: "Salle de conférence", "Médiathèque de Lyon")
    },
    location_address: {
      type: 'text',
      // Adresse complète pour les événements externes
    },
    location_city: {
      type: 'varchar(100)',
      // Ville pour les événements externes
    },
    location_postal_code: {
      type: 'varchar(20)',
      // Code postal
    },
    // Informations publiques (seront traduites)
    public_title_fr: {
      type: 'varchar(255)',
      // Titre public en français
    },
    public_title_en: {
      type: 'varchar(255)',
      // Titre public en anglais
    },
    public_description_fr: {
      type: 'text',
      // Description publique en français
    },
    public_description_en: {
      type: 'text',
      // Description publique en anglais
    },
    public_image_url: {
      type: 'varchar(500)',
      // URL de l'image publique
    },
    // Informations privées (pour les admins)
    private_notes: {
      type: 'text',
      // Notes privées pour les admins
    },
    private_contact: {
      type: 'varchar(255)',
      // Contact privé (email, téléphone...)
    },
    // Gestionnaires
    manager_dev: {
      type: 'boolean',
      notNull: true,
      default: false,
      // Géré par dev
    },
    manager_bureau: {
      type: 'boolean',
      notNull: true,
      default: false,
      // Géré par bureau
    },
    manager_museum: {
      type: 'boolean',
      notNull: true,
      default: false,
      // Géré par musée
    },
    manager_com: {
      type: 'boolean',
      notNull: true,
      default: false,
      // Géré par com
    },
    // Métadonnées
    capacity: {
      type: 'integer',
      // Capacité maximale (optionnel)
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
      // Permet de désactiver un événement sans le supprimer
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

  // Contrainte : end_date doit être >= start_date si fourni
  pgm.addConstraint('events', 'events_dates_check', {
    check: 'end_date IS NULL OR end_date >= start_date',
  });

  // Table de liaison pour les relations entre événements
  pgm.createTable('event_relations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    parent_event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
      // Événement parent (ex: événement externe)
    },
    child_event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
      // Événement enfant (ex: live pendant un événement externe)
    },
    relation_type: {
      type: 'varchar(50)',
      notNull: true,
      default: 'related',
      // Type de relation : 'related', 'sub_event', etc.
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Contrainte : un événement ne peut pas être lié à lui-même
  pgm.addConstraint('event_relations', 'event_relations_no_self_reference', {
    check: 'parent_event_id != child_event_id',
  });

  // Contrainte : éviter les doublons de relations
  pgm.addConstraint('event_relations', 'event_relations_unique', {
    unique: ['parent_event_id', 'child_event_id', 'relation_type'],
  });

  // Index pour les recherches rapides
  pgm.createIndex('events', 'type');
  pgm.createIndex('events', 'category');
  pgm.createIndex('events', 'status');
  pgm.createIndex('events', ['start_date', 'end_date']);
  pgm.createIndex('events', ['type', 'status']);
  pgm.createIndex('events', 'is_active');
  pgm.createIndex('events', 'location_type');
  pgm.createIndex('event_relations', 'parent_event_id');
  pgm.createIndex('event_relations', 'child_event_id');
};

export const down = (pgm: MigrationBuilder) => {
  pgm.dropTable('event_relations');
  pgm.dropTable('events');
  pgm.dropType('event_manager_role');
  pgm.dropType('event_status');
  pgm.dropType('event_category');
  pgm.dropType('event_type');
};

