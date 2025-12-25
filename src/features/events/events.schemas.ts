export const createEventSchema = {
  body: {
    type: 'object',
    required: ['type', 'start_date'],
    properties: {
      type: {
        type: 'string',
        enum: ['museum', 'association', 'external'],
        description: 'Type d\'événement',
      },
      category: {
        type: 'string',
        enum: ['live', 'mediation', 'workshop', 'conference', 'exhibition', 'other'],
        description: 'Catégorie pour les événements musée (requis si type=museum)',
      },
      status: {
        type: 'string',
        enum: ['draft', 'private', 'member', 'public'],
        default: 'draft',
        description: 'Statut de visibilité',
      },
      start_date: {
        type: 'string',
        format: 'date',
        description: 'Date de début (format YYYY-MM-DD)',
      },
      end_date: {
        type: ['string', 'null'],
        format: 'date',
        description: 'Date de fin (optionnel, format YYYY-MM-DD)',
      },
      start_time: {
        type: ['string', 'null'],
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de début (format HH:MM:SS)',
      },
      end_time: {
        type: ['string', 'null'],
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
        description: 'Heure de fin (format HH:MM:SS)',
      },
      location_type: {
        type: 'string',
        enum: ['museum', 'external'],
        default: 'museum',
        description: 'Type de localisation',
      },
      location_name: {
        type: ['string', 'null'],
        maxLength: 255,
        description: 'Nom du lieu',
      },
      location_address: {
        type: ['string', 'null'],
        description: 'Adresse complète',
      },
      location_city: {
        type: ['string', 'null'],
        maxLength: 100,
        description: 'Ville',
      },
      location_postal_code: {
        type: ['string', 'null'],
        maxLength: 20,
        description: 'Code postal',
      },
      public_title_fr: {
        type: ['string', 'null'],
        maxLength: 255,
        description: 'Titre public en français',
      },
      public_title_en: {
        type: ['string', 'null'],
        maxLength: 255,
        description: 'Titre public en anglais',
      },
      public_description_fr: {
        type: ['string', 'null'],
        description: 'Description publique en français',
      },
      public_description_en: {
        type: ['string', 'null'],
        description: 'Description publique en anglais',
      },
      public_image_url: {
        type: ['string', 'null'],
        maxLength: 500,
        description: 'URL de l\'image publique',
      },
      private_notes: {
        type: ['string', 'null'],
        description: 'Notes privées pour les admins',
      },
      private_contact: {
        type: ['string', 'null'],
        maxLength: 255,
        description: 'Contact privé',
      },
      manager_dev: {
        type: 'boolean',
        default: false,
        description: 'Géré par dev',
      },
      manager_bureau: {
        type: 'boolean',
        default: false,
        description: 'Géré par bureau',
      },
      manager_museum: {
        type: 'boolean',
        default: false,
        description: 'Géré par musée',
      },
      manager_com: {
        type: 'boolean',
        default: false,
        description: 'Géré par com',
      },
      capacity: {
        type: ['integer', 'null'],
        minimum: 1,
        description: 'Capacité maximale',
      },
      is_active: {
        type: 'boolean',
        default: true,
        description: 'Événement actif',
      },
      related_event_ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
        description: 'IDs des événements à lier',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        category: { type: ['string', 'null'] },
        status: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: ['string', 'null'] },
        start_time: { type: ['string', 'null'] },
        end_time: { type: ['string', 'null'] },
        location_type: { type: 'string' },
        location_name: { type: ['string', 'null'] },
        location_address: { type: ['string', 'null'] },
        location_city: { type: ['string', 'null'] },
        location_postal_code: { type: ['string', 'null'] },
        public_title_fr: { type: ['string', 'null'] },
        public_title_en: { type: ['string', 'null'] },
        public_description_fr: { type: ['string', 'null'] },
        public_description_en: { type: ['string', 'null'] },
        public_image_url: { type: ['string', 'null'] },
        private_notes: { type: ['string', 'null'] },
        private_contact: { type: ['string', 'null'] },
        manager_dev: { type: 'boolean' },
        manager_bureau: { type: 'boolean' },
        manager_museum: { type: 'boolean' },
        manager_com: { type: 'boolean' },
        capacity: { type: ['integer', 'null'] },
        is_active: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
  },
};

export const updateEventSchema = {
  body: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['museum', 'association', 'external'],
      },
      category: {
        type: ['string', 'null'],
        enum: ['live', 'mediation', 'workshop', 'conference', 'exhibition', 'other'],
      },
      status: {
        type: 'string',
        enum: ['draft', 'private', 'member', 'public'],
      },
      start_date: {
        type: 'string',
        format: 'date',
      },
      end_date: {
        type: ['string', 'null'],
        format: 'date',
      },
      start_time: {
        type: ['string', 'null'],
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
      },
      end_time: {
        type: ['string', 'null'],
        pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$',
      },
      location_type: {
        type: 'string',
        enum: ['museum', 'external'],
      },
      location_name: {
        type: ['string', 'null'],
        maxLength: 255,
      },
      location_address: {
        type: ['string', 'null'],
      },
      location_city: {
        type: ['string', 'null'],
        maxLength: 100,
      },
      location_postal_code: {
        type: ['string', 'null'],
        maxLength: 20,
      },
      public_title_fr: {
        type: ['string', 'null'],
        maxLength: 255,
      },
      public_title_en: {
        type: ['string', 'null'],
        maxLength: 255,
      },
      public_description_fr: {
        type: ['string', 'null'],
      },
      public_description_en: {
        type: ['string', 'null'],
      },
      public_image_url: {
        type: ['string', 'null'],
        maxLength: 500,
      },
      private_notes: {
        type: ['string', 'null'],
      },
      private_contact: {
        type: ['string', 'null'],
        maxLength: 255,
      },
      manager_dev: {
        type: 'boolean',
      },
      manager_bureau: {
        type: 'boolean',
      },
      manager_museum: {
        type: 'boolean',
      },
      manager_com: {
        type: 'boolean',
      },
      capacity: {
        type: ['integer', 'null'],
        minimum: 1,
      },
      is_active: {
        type: 'boolean',
      },
      related_event_ids: {
        type: 'array',
        items: {
          type: 'string',
          format: 'uuid',
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        category: { type: ['string', 'null'] },
        status: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: ['string', 'null'] },
        start_time: { type: ['string', 'null'] },
        end_time: { type: ['string', 'null'] },
        location_type: { type: 'string' },
        location_name: { type: ['string', 'null'] },
        location_address: { type: ['string', 'null'] },
        location_city: { type: ['string', 'null'] },
        location_postal_code: { type: ['string', 'null'] },
        public_title_fr: { type: ['string', 'null'] },
        public_title_en: { type: ['string', 'null'] },
        public_description_fr: { type: ['string', 'null'] },
        public_description_en: { type: ['string', 'null'] },
        public_image_url: { type: ['string', 'null'] },
        private_notes: { type: ['string', 'null'] },
        private_contact: { type: ['string', 'null'] },
        manager_dev: { type: 'boolean' },
        manager_bureau: { type: 'boolean' },
        manager_museum: { type: 'boolean' },
        manager_com: { type: 'boolean' },
        capacity: { type: ['integer', 'null'] },
        is_active: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
  },
};

export const getEventsSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['museum', 'association', 'external'],
      },
      category: {
        type: 'string',
        enum: ['live', 'mediation', 'workshop', 'conference', 'exhibition', 'other'],
      },
      status: {
        type: 'string',
        enum: ['draft', 'private', 'member', 'public'],
      },
      start_date: {
        type: 'string',
        format: 'date',
      },
      end_date: {
        type: 'string',
        format: 'date',
      },
      date: {
        type: 'string',
        format: 'date',
      },
      location_type: {
        type: 'string',
        enum: ['museum', 'external'],
      },
      is_active: {
        type: 'boolean',
      },
      include_relations: {
        type: 'boolean',
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 500,
        default: 50,
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              category: { type: ['string', 'null'] },
              status: { type: 'string' },
              start_date: { type: 'string' },
              end_date: { type: ['string', 'null'] },
              start_time: { type: ['string', 'null'] },
              end_time: { type: ['string', 'null'] },
              location_type: { type: 'string' },
              location_name: { type: ['string', 'null'] },
              location_address: { type: ['string', 'null'] },
              location_city: { type: ['string', 'null'] },
              location_postal_code: { type: ['string', 'null'] },
              public_title_fr: { type: ['string', 'null'] },
              public_title_en: { type: ['string', 'null'] },
              public_description_fr: { type: ['string', 'null'] },
              public_description_en: { type: ['string', 'null'] },
              public_image_url: { type: ['string', 'null'] },
              private_notes: { type: ['string', 'null'] },
              private_contact: { type: ['string', 'null'] },
              manager_dev: { type: 'boolean' },
              manager_bureau: { type: 'boolean' },
              manager_museum: { type: 'boolean' },
              manager_com: { type: 'boolean' },
              capacity: { type: ['integer', 'null'] },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
        },
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
    },
  },
};

export const getEventByIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      include_relations: {
        type: 'boolean',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        category: { type: ['string', 'null'] },
        status: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: ['string', 'null'] },
        start_time: { type: ['string', 'null'] },
        end_time: { type: ['string', 'null'] },
        location_type: { type: 'string' },
        location_name: { type: ['string', 'null'] },
        location_address: { type: ['string', 'null'] },
        location_city: { type: ['string', 'null'] },
        location_postal_code: { type: ['string', 'null'] },
        public_title_fr: { type: ['string', 'null'] },
        public_title_en: { type: ['string', 'null'] },
        public_description_fr: { type: ['string', 'null'] },
        public_description_en: { type: ['string', 'null'] },
        public_image_url: { type: ['string', 'null'] },
        private_notes: { type: ['string', 'null'] },
        private_contact: { type: ['string', 'null'] },
        manager_dev: { type: 'boolean' },
        manager_bureau: { type: 'boolean' },
        manager_museum: { type: 'boolean' },
        manager_com: { type: 'boolean' },
        capacity: { type: ['integer', 'null'] },
        is_active: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
  },
};

export const deleteEventSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  },
};

export const getCalendarSchema = {
  querystring: {
    type: 'object',
    required: ['start_date'],
    properties: {
      start_date: {
        type: 'string',
        format: 'date',
        description: 'Date de début (format YYYY-MM-DD)',
      },
      end_date: {
        type: 'string',
        format: 'date',
        description: 'Date de fin (optionnel, par défaut = start_date)',
      },
      view: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        default: 'month',
        description: 'Vue du calendrier',
      },
      status: {
        type: 'string',
        enum: ['draft', 'private', 'member', 'public'],
        description: 'Filtrer par statut (par défaut: public et member)',
      },
      include_private: {
        type: 'boolean',
        default: false,
        description: 'Inclure les événements privés (admin uniquement)',
      },
      event_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['museum', 'association', 'external'],
        },
        description: 'Filtrer par types d\'événements (par défaut: tous les types)',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              is_open: { type: 'boolean' },
              opening_hours: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    start_time: { type: 'string' },
                    end_time: { type: 'string' },
                    audience_type: { type: 'string' },
                    description: { type: ['string', 'null'] },
                  },
                },
              },
              paid_tickets_count: { type: 'integer' },
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    category: { type: ['string', 'null'] },
                    status: { type: 'string' },
                    start_date: { type: 'string' },
                    end_date: { type: ['string', 'null'] },
                    start_time: { type: ['string', 'null'] },
                    end_time: { type: ['string', 'null'] },
                    location_type: { type: 'string' },
                    location_name: { type: ['string', 'null'] },
                    location_address: { type: ['string', 'null'] },
                    location_city: { type: ['string', 'null'] },
                    location_postal_code: { type: ['string', 'null'] },
                    public_title_fr: { type: ['string', 'null'] },
                    public_title_en: { type: ['string', 'null'] },
                    public_description_fr: { type: ['string', 'null'] },
                    public_description_en: { type: ['string', 'null'] },
                    public_image_url: { type: ['string', 'null'] },
                    private_notes: { type: ['string', 'null'] },
                    private_contact: { type: ['string', 'null'] },
                    manager_dev: { type: 'boolean' },
                    manager_bureau: { type: 'boolean' },
                    manager_museum: { type: 'boolean' },
                    manager_com: { type: 'boolean' },
                    capacity: { type: ['integer', 'null'] },
                    is_active: { type: 'boolean' },
                    created_at: { type: 'string' },
                    updated_at: { type: 'string' },
                  },
                },
              },
              holiday_periods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: ['string', 'null'] },
                    start_date: { type: 'string' },
                    end_date: { type: 'string' },
                    zone: { type: ['string', 'null'] },
                  },
                },
              },
              closure_periods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: ['string', 'null'] },
                    start_date: { type: 'string' },
                    end_date: { type: 'string' },
                    zone: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        view: { type: 'string' },
      },
    },
  },
};

