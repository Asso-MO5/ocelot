import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse un scénario Gherkin pour extraire les informations
 */
interface ParsedScenario {
  name: string;
  steps: Array<{ type: 'given' | 'when' | 'then' | 'and'; text: string }>;
  path?: string;
  method?: string;
  statusCode?: number;
}

interface ParsedFeature {
  title: string;
  description: string;
  scenarios: ParsedScenario[];
}

/**
 * Parse le contenu Gherkin d'un fichier feature
 */
function parseGherkinFeature(content: string): ParsedFeature | null {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);

  let inFeature = false;
  let inScenario = false;
  let currentFeature: ParsedFeature | null = null;
  let currentScenario: ParsedScenario | null = null;

  for (const line of lines) {
    if (line.startsWith('Feature:')) {
      inFeature = true;
      const title = line.replace('Feature:', '').trim();
      currentFeature = {
        title,
        description: '',
        scenarios: [],
      };
    } else if (line.startsWith('Scenario:')) {
      if (currentScenario) {
        currentFeature?.scenarios.push(currentScenario);
      }
      inScenario = true;
      const name = line.replace('Scenario:', '').trim();
      currentScenario = {
        name,
        steps: [],
      };
    } else if (inFeature && !inScenario && line && !line.startsWith('Background:')) {
      if (currentFeature) {
        currentFeature.description += (currentFeature.description ? ' ' : '') + line;
      }
    } else if (inScenario && currentScenario) {
      const stepMatch = line.match(/^(Étant donné|Quand|Alors|Et)\s+(.+)$/i);
      if (stepMatch) {
        const [, keyword, text] = stepMatch;
        let type: 'given' | 'when' | 'then' | 'and' = 'given';

        if (keyword.toLowerCase().includes('quand')) type = 'when';
        else if (keyword.toLowerCase().includes('alors')) type = 'then';
        else if (keyword.toLowerCase().includes('et')) type = 'and';

        currentScenario.steps.push({ type, text });

        // Extraire le path et method des steps "Quand"
        if (type === 'when') {
          const pathMatch = text.match(/["']([^"']+)["']/);
          const methodMatch = text.match(/(GET|POST|PUT|DELETE|PATCH)/i);
          if (pathMatch) currentScenario.path = pathMatch[1];
          if (methodMatch) currentScenario.method = methodMatch[1].toUpperCase();
        }

        // Extraire le status code des steps "Alors"
        if (type === 'then' || type === 'and') {
          const statusMatch = text.match(/(\d{3})/);
          if (statusMatch) currentScenario.statusCode = parseInt(statusMatch[1], 10);
        }
      }
    }
  }

  if (currentScenario && currentFeature) {
    currentFeature.scenarios.push(currentScenario);
  }

  return currentFeature;
}

/**
 * Trouve les scénarios pour un endpoint donné
 */
function findScenariosForEndpoint(
  features: ParsedFeature[],
  method: string,
  path: string
): ParsedScenario[] {
  const scenarios: ParsedScenario[] = [];

  for (const feature of features) {
    for (const scenario of feature.scenarios) {
      if (scenario.path === path && scenario.method === method) {
        scenarios.push(scenario);
      }
    }
  }

  return scenarios;
}

/**
 * Convertit un schéma JSON Schema en schéma OpenAPI
 */
function jsonSchemaToOpenAPI(schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const openApiSchema: any = { ...schema };

  // Gérer les types nullables
  if (Array.isArray(openApiSchema.type) && openApiSchema.type.includes('null')) {
    openApiSchema.type = openApiSchema.type.filter((t: string) => t !== 'null');
    openApiSchema.nullable = true;
  }

  // Convertir les propriétés récursivement
  if (openApiSchema.properties) {
    for (const key in openApiSchema.properties) {
      openApiSchema.properties[key] = jsonSchemaToOpenAPI(openApiSchema.properties[key]);
    }
  }

  if (openApiSchema.items) {
    openApiSchema.items = jsonSchemaToOpenAPI(openApiSchema.items);
  }

  return openApiSchema;
}

/**
 * Génère la documentation OpenAPI
 */
async function generateOpenAPIDoc(): Promise<void> {
  const featuresDir = join(__dirname, '../features');
  const features: ParsedFeature[] = [];

  // Lire tous les fichiers .feature
  function findFeatureFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findFeatureFiles(fullPath));
      } else if (entry.endsWith('.feature')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  const featureFiles = findFeatureFiles(featuresDir);

  // Parser tous les fichiers feature
  for (const filePath of featureFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      // Parser directement le contenu du fichier .feature
      const feature = parseGherkinFeature(content);
      if (feature) {
        features.push(feature);
      }
    } catch (err) {
      console.warn(`Erreur lors de la lecture de ${filePath}:`, err);
    }
  }

  // Importer les schémas
  const {
    callbackSchema,
    meSchema,
    signinSchema
  } = await import('../features/auth/auth.schemas.ts');

  const {
    webhookSchema,
    getCheckoutStatusSchema
  } = await import('../features/pay/pay.schemas.ts');

  const {
    createScheduleSchema,
    updateScheduleSchema,
    getSchedulesSchema,
    getPublicSchedulesSchema,
    getScheduleByIdSchema,
    deleteScheduleSchema,
    reorderSchedulesSchema
  } = await import('../features/schedules/schedules.schemas.ts');

  const {
    createPriceSchema,
    updatePriceSchema,
    getPricesSchema,
    getPriceByIdSchema,
    deletePriceSchema,
    reorderPricesSchema
  } = await import('../features/prices/prices.schemas.ts');

  const {
    upsertSettingSchema,
    getSettingsSchema,
    getSettingByKeySchema,
    deleteSettingSchema,
    getMaxCapacitySchema,
    setMaxCapacitySchema,
    getValidatedTicketsBySlotSchema
  } = await import('../features/settings/settings.schemas.ts');

  const {
    createTicketSchema,
    createTicketsWithPaymentSchema,
    updateTicketSchema,
    getTicketsSchema,
    getTicketByIdSchema,
    getTicketsByCheckoutIdSchema,
    getTicketsStatsSchema,
    validateTicketSchema,
    deleteTicketSchema,
    getWeeklySlotsStatsSchema
  } = await import('../features/tickets/tickets.schemas.ts');

  const {
    getSlotsSchema
  } = await import('../features/slots/slots.schemas.ts');

  const {
    generateDonationProofSchema
  } = await import('../features/donation-proof/donation-proof.schemas.ts');

  const {
    createGiftCodePackSchema,
    distributeGiftCodesSchema,
    getGiftCodesSchema,
    getGiftCodePacksSchema,
    validateGiftCodeSchema,
    purchaseGiftCodesSchema,
    confirmPurchaseGiftCodesSchema,
  } = await import('../features/gift-codes/gift-codes.schemas.ts');

  const {
    createSpecialPeriodSchema,
    updateSpecialPeriodSchema,
    getSpecialPeriodsSchema
  } = await import('../features/special-periods/special-periods.schemas.ts');

  const {
    createEventSchema,
    updateEventSchema,
    getEventsSchema,
    getEventByIdSchema,
    deleteEventSchema,
    getCalendarSchema
  } = await import('../features/events/events.schemas.ts');

  // Définir les routes avec leurs schémas
  const routes = [
    {
      method: 'GET',
      path: '/auth/signin',
      schema: signinSchema,
      description: 'Redirige vers Discord OAuth2 pour l\'authentification',
      tag: 'Authentification',
    },
    {
      method: 'GET',
      path: '/auth/login',
      schema: signinSchema,
      description: 'Alias de /auth/signin - Redirige vers Discord OAuth2',
      tag: 'Authentification',
    },
    {
      method: 'GET',
      path: '/auth/callback',
      schema: callbackSchema,
      description: 'Callback OAuth2 de Discord - Échange le code d\'autorisation contre des tokens',
      tag: 'Authentification',
    },
    {
      method: 'GET',
      path: '/auth/me',
      schema: meSchema,
      description: 'Récupère les informations de l\'utilisateur authentifié (gère automatiquement le refresh du token)',
      tag: 'Authentification',
    },
    {
      method: 'GET',
      path: '/pay/checkout/:sessionId',
      schema: getCheckoutStatusSchema,
      description: 'Vérifie le statut d\'une session de checkout. Retourne le statut de paiement et les informations de la session (route publique)',
      tag: 'Paiement',
    },
    {
      method: 'POST',
      path: '/pay/webhook',
      schema: webhookSchema,
      description: 'Endpoint webhook pour recevoir les notifications de paiement. Met à jour automatiquement les tickets associés au session_id selon le statut du paiement (route publique)',
      tag: 'Paiement',
    },
    {
      method: 'POST',
      path: '/museum/schedules',
      schema: createScheduleSchema,
      description: 'Crée ou met à jour un horaire d\'ouverture (UPSERT). Pour les exceptions : cherche par start_date, end_date et audience_type. Pour les horaires récurrents : cherche par day_of_week et audience_type. Retourne 201 si créé, 200 si mis à jour.',
      tag: 'Musée - Horaires',
    },
    {
      method: 'GET',
      path: '/museum/schedules/public',
      schema: getPublicSchedulesSchema,
      description: 'Récupère uniquement les horaires publics (route publique, accessible sans authentification)',
      tag: 'Musée - Horaires',
    },
    {
      method: 'GET',
      path: '/museum/schedules',
      schema: getSchedulesSchema,
      description: 'Récupère tous les horaires avec filtres optionnels (authentification requise)',
      tag: 'Musée - Horaires',
    },
    {
      method: 'GET',
      path: '/museum/schedules/:id',
      schema: getScheduleByIdSchema,
      description: 'Récupère un horaire par son ID',
      tag: 'Musée - Horaires',
    },
    {
      method: 'PUT',
      path: '/museum/schedules/:id',
      schema: updateScheduleSchema,
      description: 'Met à jour un horaire',
      tag: 'Musée - Horaires',
    },
    {
      method: 'DELETE',
      path: '/museum/schedules/:id',
      schema: deleteScheduleSchema,
      description: 'Supprime un horaire',
      tag: 'Musée - Horaires',
    },
    {
      method: 'POST',
      path: '/museum/schedules/reorder',
      schema: reorderSchedulesSchema,
      description: 'Réordonne les horaires selon l\'ordre fourni. Met à jour les positions de tous les horaires selon l\'ordre des IDs fournis (premier ID = position 1, deuxième ID = position 2, etc.)',
      tag: 'Musée - Horaires',
    },
    {
      method: 'POST',
      path: '/museum/prices',
      schema: createPriceSchema,
      description: 'Crée ou met à jour un tarif (upsert). Si un id est fourni et existe, met à jour le tarif (retourne 200). Sinon, crée un nouveau tarif (retourne 201).',
      tag: 'Musée - Tarifs',
    },
    {
      method: 'GET',
      path: '/museum/prices',
      schema: getPricesSchema,
      description: 'Récupère tous les tarifs avec filtres optionnels',
      tag: 'Musée - Tarifs',
    },
    {
      method: 'GET',
      path: '/museum/prices/:id',
      schema: getPriceByIdSchema,
      description: 'Récupère un tarif par son ID',
      tag: 'Musée - Tarifs',
    },
    {
      method: 'PUT',
      path: '/museum/prices/:id',
      schema: updatePriceSchema,
      description: 'Met à jour un tarif',
      tag: 'Musée - Tarifs',
    },
    {
      method: 'DELETE',
      path: '/museum/prices/:id',
      schema: deletePriceSchema,
      description: 'Supprime un tarif',
      tag: 'Musée - Tarifs',
    },
    {
      method: 'POST',
      path: '/museum/prices/reorder',
      schema: reorderPricesSchema,
      description: 'Réordonne les tarifs selon l\'ordre fourni. Met à jour les positions de tous les tarifs selon l\'ordre des IDs fournis (premier ID = position 1, deuxième ID = position 2, etc.)',
      tag: 'Musée - Tarifs',
    },
    {
      method: 'GET',
      path: '/museum/settings',
      schema: getSettingsSchema,
      description: 'Récupère tous les paramètres avec filtres optionnels',
      tag: 'Musée - Paramètres',
    },
    {
      method: 'GET',
      path: '/museum/settings/:key',
      schema: getSettingByKeySchema,
      description: 'Récupère un paramètre par sa clé',
      tag: 'Musée - Paramètres',
    },
    {
      method: 'POST',
      path: '/museum/settings',
      schema: upsertSettingSchema,
      description: 'Crée ou met à jour un paramètre (upsert) - Retourne 201 si créé, 200 si mis à jour',
      tag: 'Musée - Paramètres',
    },
    {
      method: 'PUT',
      path: '/museum/settings',
      schema: upsertSettingSchema,
      description: 'Crée ou met à jour un paramètre (upsert) - Retourne 201 si créé, 200 si mis à jour',
      tag: 'Musée - Paramètres',
    },
    {
      method: 'DELETE',
      path: '/museum/settings/:key',
      schema: deleteSettingSchema,
      description: 'Supprime un paramètre par sa clé',
      tag: 'Musée - Paramètres',
    },
    {
      method: 'GET',
      path: '/museum/capacity/max',
      schema: getMaxCapacitySchema,
      description: 'Récupère la capacité maximale du musée',
      tag: 'Musée - Capacité',
    },
    {
      method: 'POST',
      path: '/museum/capacity/max',
      schema: setMaxCapacitySchema,
      description: 'Définit la capacité maximale du musée',
      tag: 'Musée - Capacité',
    },
    {
      method: 'GET',
      path: '/museum/capacity/validated-tickets',
      schema: getValidatedTicketsBySlotSchema,
      description: 'Récupère les tickets validés pour un créneau donné. Retourne le nombre de tickets validés (count) et la liste complète des tickets (tickets) pour le créneau spécifié. Peut inclure les créneaux adjacents si include_adjacent_slots est true.',
      tag: 'Musée - Capacité',
    },
    {
      method: 'POST',
      path: '/museum/tickets',
      schema: createTicketSchema,
      description: 'Crée un nouveau ticket avec génération automatique d\'un code QR unique',
      tag: 'Musée - Tickets',
    },
    {
      method: 'GET',
      path: '/museum/tickets',
      schema: getTicketsSchema,
      description: 'Récupère tous les tickets avec filtres optionnels (email, date, statut, etc.)',
      tag: 'Musée - Tickets',
    },
    {
      method: 'GET',
      path: '/museum/tickets/:id',
      schema: getTicketByIdSchema,
      description: 'Récupère un ticket par son ID (authentification requise)',
      tag: 'Musée - Tickets',
    },
    {
      method: 'GET',
      path: '/museum/tickets/qr/:qrCode',
      schema: getTicketByIdSchema,
      description: 'Récupère un ticket par son code QR (route publique)',
      tag: 'Musée - Tickets',
    },
    {
      method: 'POST',
      path: '/museum/tickets/validate',
      schema: validateTicketSchema,
      description: 'Valide/utilise un ticket en scannant son code QR (route publique)',
      tag: 'Musée - Tickets',
    },
    {
      method: 'POST',
      path: '/museum/tickets/payment',
      schema: createTicketsWithPaymentSchema,
      description: 'Crée plusieurs tickets avec paiement. Crée d\'abord un checkout avec le montant total (somme de tous les ticket_price + donation_amount), puis enregistre tous les tickets avec le checkout_id et le statut pending (route publique)',
      tag: 'Musée - Tickets',
    },
    {
      method: 'GET',
      path: '/museum/tickets/checkout/:checkoutId',
      schema: getTicketsByCheckoutIdSchema,
      description: 'Récupère tous les tickets associés à un checkout_id donné (route publique)',
      tag: 'Musée - Tickets',
    },
    {
      method: 'GET',
      path: '/museum/tickets/stats',
      schema: getTicketsStatsSchema,
      description: 'Récupère les statistiques des tickets : nombre total vendus, nombre de la semaine avec répartition par jour (route publique)',
      tag: 'Musée - Tickets',
    },
    {
      method: 'GET',
      path: '/museum/tickets/weekly-slots-stats',
      schema: getWeeklySlotsStatsSchema,
      description: 'Récupère les statistiques des créneaux horaires pour la semaine courante : pour chaque jour et start_time, nombre de personnes attendues et pourcentage d’occupation par rapport à la capacité',
      tag: 'Musée - Tickets',
    },
    {
      method: 'PUT',
      path: '/museum/tickets/:id',
      schema: updateTicketSchema,
      description: 'Met à jour un ticket',
      tag: 'Musée - Tickets',
    },
    {
      method: 'DELETE',
      path: '/museum/tickets/:id',
      schema: deleteTicketSchema,
      description: 'Supprime un ticket',
      tag: 'Musée - Tickets',
    },
    {
      method: 'GET',
      path: '/museum/slots',
      schema: getSlotsSchema,
      description: 'Récupère les créneaux horaires disponibles pour une date donnée avec leurs capacités et taux d\'occupation (route publique)',
      tag: 'Musée - Créneaux',
    },
    {
      method: 'GET',
      path: '/museum/donation-proof/generate',
      schema: generateDonationProofSchema,
      description: 'Génère et télécharge un certificat de don CERFA 11580 en PDF pour un ticket donné. Le ticket doit contenir un don (donation_amount > 0). Les paramètres address, postal_code et city sont optionnels et permettent de compléter les informations du donateur.',
      tag: 'Musée - Certificats de don',
    },
    {
      method: 'POST',
      path: '/museum/gift-codes/packs',
      schema: createGiftCodePackSchema,
      description: 'Crée un pack de codes cadeaux. Chaque code offre une place gratuite. Les codes peuvent être créés en lot pour faciliter la distribution (ex: pour un influenceur).',
      tag: 'Musée - Codes cadeaux',
    },
    {
      method: 'POST',
      path: '/museum/gift-codes/distribute',
      schema: distributeGiftCodesSchema,
      description: 'Distribue des codes cadeaux par email. Permet d\'envoyer un lot de codes à un destinataire (ex: influenceur). Les codes sont associés à l\'email du destinataire.',
      tag: 'Musée - Codes cadeaux',
    },
    {
      method: 'GET',
      path: '/museum/gift-codes',
      schema: getGiftCodesSchema,
      description: 'Récupère la liste des codes cadeaux avec pagination et filtres optionnels (statut, pack, destinataire, ticket associé).',
      tag: 'Musée - Codes cadeaux',
    },
    {
      method: 'GET',
      path: '/museum/gift-codes/packs',
      schema: getGiftCodePacksSchema,
      description: 'Récupère la liste paginée des packs de codes cadeaux avec leurs codes associés. Permet de rechercher un pack par code (paramètre `code`). Retourne les statistiques de chaque pack (nombre de codes, utilisés, non utilisés, expirés).',
      tag: 'Musée - Codes cadeaux',
    },
    {
      method: 'GET',
      path: '/museum/gift-codes/validate/:code',
      schema: validateGiftCodeSchema,
      description: 'Valide un code cadeau (route publique). Vérifie que le code existe, n\'est pas utilisé et n\'est pas expiré. Permet au frontend de valider un code avant de l\'utiliser dans une commande.',
      tag: 'Musée - Codes cadeaux',
    },
    {
      method: 'POST',
      path: '/museum/gift-codes/purchase',
      schema: purchaseGiftCodesSchema,
      description: 'Crée une session de paiement Stripe pour acheter des codes cadeaux (route publique). Utilise le setting gift_code_price comme prix unitaire et retourne checkout_id + checkout_url.',
      tag: 'Musée - Codes cadeaux',
    },
    {
      method: 'POST',
      path: '/museum/gift-codes/purchase/confirm',
      schema: confirmPurchaseGiftCodesSchema,
      description: 'Confirme un achat de codes cadeaux après paiement Stripe (route publique). Vérifie la session, génère un pack de codes et les envoie par email à l\'acheteur.',
      tag: 'Musée - Codes cadeaux',
    },
    {
      method: 'POST',
      path: '/museum/special-periods',
      schema: createSpecialPeriodSchema,
      description: 'Crée une période spéciale (vacances scolaires ou fermeture). Les périodes de vacances permettent d\'afficher automatiquement les horaires avec audience_type="holiday" en plus des horaires publics. Les périodes de fermeture masquent les horaires normaux.',
      tag: 'Musée - Périodes spéciales',
    },
    {
      method: 'GET',
      path: '/museum/special-periods',
      schema: getSpecialPeriodsSchema,
      description: 'Récupère la liste des périodes spéciales (vacances et fermetures) avec filtres optionnels (type, date, zone). Permet de vérifier si une date est dans une période spéciale.',
      tag: 'Musée - Périodes spéciales',
    },
    {
      method: 'GET',
      path: '/museum/special-periods/:id',
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID de la période spéciale',
            },
          },
        },
        response: {
          200: createSpecialPeriodSchema.response[201],
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      description: 'Récupère une période spéciale par son ID.',
      tag: 'Musée - Périodes spéciales',
    },
    {
      method: 'PUT',
      path: '/museum/special-periods/:id',
      schema: updateSpecialPeriodSchema,
      description: 'Met à jour une période spéciale (vacances ou fermeture).',
      tag: 'Musée - Périodes spéciales',
    },
    {
      method: 'DELETE',
      path: '/museum/special-periods/:id',
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID de la période spéciale',
            },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'Période spéciale supprimée avec succès',
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
      description: 'Supprime une période spéciale.',
      tag: 'Musée - Périodes spéciales',
    },
    {
      method: 'POST',
      path: '/events',
      schema: createEventSchema,
      description: 'Crée un nouvel événement (musée, association ou externe)',
      tag: 'Événements',
    },
    {
      method: 'GET',
      path: '/events',
      schema: getEventsSchema,
      description: 'Récupère les événements avec pagination et filtres (tous types)',
      tag: 'Événements',
    },
    {
      method: 'GET',
      path: '/events/:id',
      schema: getEventByIdSchema,
      description: 'Récupère un événement par son ID',
      tag: 'Événements',
    },
    {
      method: 'PUT',
      path: '/events/:id',
      schema: updateEventSchema,
      description: 'Met à jour un événement',
      tag: 'Événements',
    },
    {
      method: 'DELETE',
      path: '/events/:id',
      schema: deleteEventSchema,
      description: 'Supprime un événement',
      tag: 'Événements',
    },
    {
      method: 'GET',
      path: '/museum/calendar',
      schema: getCalendarSchema,
      description: 'Récupère le calendrier avec événements et horaires d\'ouverture du musée',
      tag: 'Musée - Calendrier',
    },
  ];

  // Générer le document OpenAPI
  const openApiDoc: any = {
    openapi: '3.1.0',
    info: {
      title: 'Ocelot API - Museum Back End',
      description: 'API backend Fastify avec authentification Discord OAuth2.\n\n' +
        'Cette documentation est générée à partir des scénarios Gherkin/Cucumber et des schémas Fastify.',
      version: '1.0.0',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Serveur de développement',
      },
    ],
    tags: [
      {
        name: 'Authentification',
        description: 'Endpoints d\'authentification Discord OAuth2',
      },
      {
        name: 'Paiement',
        description: 'Endpoints de paiement',
      },
      {
        name: 'Musée - Horaires',
        description: 'Endpoints de gestion des horaires d\'ouverture',
      },
      {
        name: 'Musée - Tarifs',
        description: 'Endpoints de gestion des tarifs',
      },
      {
        name: 'Musée - Paramètres',
        description: 'Endpoints de gestion des paramètres du musée',
      },
      {
        name: 'Musée - Capacité',
        description: 'Endpoints de gestion de la capacité et des visiteurs',
      },
      {
        name: 'Musée - Tickets',
        description: 'Endpoints de gestion des tickets et réservations',
      },
      {
        name: 'Musée - Créneaux',
        description: 'Endpoints de gestion des créneaux horaires et disponibilités',
      },
      {
        name: 'Musée - Périodes spéciales',
        description: 'Endpoints de gestion des périodes spéciales (vacances, fermetures)',
      },
      {
        name: 'Événements',
        description: 'Endpoints de gestion des événements (musée, association, externes)',
      },
      {
        name: 'Musée - Calendrier',
        description: 'Endpoint de récupération du calendrier avec événements et horaires',
      },
    ],
    paths: {} as Record<string, any>,
  };

  // Générer les paths à partir des routes
  for (const route of routes) {
    const scenarios = findScenariosForEndpoint(features, route.method, route.path);
    const pathItem: any = {
      [route.method.toLowerCase()]: {
        tags: [route.tag || 'Autre'],
        summary: route.description,
        description: generateDescriptionFromScenarios(scenarios),
        operationId: `${route.method.toLowerCase()}_${route.path.replace(/\//g, '_').replace(/^_|_$/g, '')}`,
        parameters: [],
        responses: {},
      },
    };

    // Ajouter les paramètres de query
    if ('querystring' in route.schema && route.schema.querystring) {
      const querySchema = route.schema.querystring as any;
      if (querySchema.properties) {
        for (const [key, prop] of Object.entries(querySchema.properties as Record<string, any>)) {
          pathItem[route.method.toLowerCase()].parameters.push({
            name: key,
            in: 'query',
            description: prop.description || '',
            required: querySchema.required?.includes(key) || false,
            schema: jsonSchemaToOpenAPI(prop),
          });
        }
      }
    }

    // Ajouter les paramètres de route (params)
    if ('params' in route.schema && route.schema.params) {
      const paramsSchema = route.schema.params as any;
      if (paramsSchema.properties) {
        for (const [key, prop] of Object.entries(paramsSchema.properties as Record<string, any>)) {
          pathItem[route.method.toLowerCase()].parameters.push({
            name: key,
            in: 'path',
            description: prop.description || '',
            required: paramsSchema.required?.includes(key) || true,
            schema: jsonSchemaToOpenAPI(prop),
          });
        }
      }
    }

    // Ajouter le body pour les requêtes POST/PUT
    if (['POST', 'PUT', 'PATCH'].includes(route.method) && 'body' in route.schema && route.schema.body) {
      const bodySchema = route.schema.body as any;
      pathItem[route.method.toLowerCase()].requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: jsonSchemaToOpenAPI(bodySchema),
          },
        },
      };
    }

    // Ajouter les réponses
    if (route.schema.response) {
      for (const [statusCode, responseSchema] of Object.entries(route.schema.response)) {
        const status = parseInt(statusCode, 10);
        const scenario = scenarios.find(s => s.statusCode === status);

        pathItem[route.method.toLowerCase()].responses[statusCode] = {
          description: getResponseDescription(status, scenario),
          content: status !== 302 ? {
            'application/json': {
              schema: jsonSchemaToOpenAPI(responseSchema as any),
              example: generateExampleFromScenario(scenario, responseSchema as any),
            },
          } : undefined,
          headers: status === 302 ? {
            Location: {
              schema: { type: 'string' },
              description: 'URL de redirection',
            },
          } : undefined,
        };
      }
    }

    // Ajouter les exemples de scénarios
    if (scenarios.length > 0) {
      pathItem[route.method.toLowerCase()].description += '\n\n### Scénarios de test\n\n';
      for (const scenario of scenarios) {
        pathItem[route.method.toLowerCase()].description += `**${scenario.name}**\n\n`;
        for (const step of scenario.steps) {
          const emoji = step.type === 'given' ? '📋' : step.type === 'when' ? '⚡' : '✅';
          pathItem[route.method.toLowerCase()].description += `${emoji} ${step.text}\n\n`;
        }
      }
    }

    if (!openApiDoc.paths[route.path]) {
      openApiDoc.paths[route.path] = {};
    }
    Object.assign(openApiDoc.paths[route.path], pathItem);
  }

  // Ajouter les composants de sécurité (cookies)
  openApiDoc.components = {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'discord_access_token',
        description: 'Token d\'accès Discord stocké dans un cookie HTTP-only',
      },
    },
  };

  // Ajouter la sécurité aux endpoints protégés
  const protectedPaths = [
    '/auth/me',
    '/auth/session',
    '/museum/settings', // POST, PUT, DELETE
    '/museum/settings/:key', // DELETE
    '/museum/capacity/max', // POST
    '/museum/capacity/validated-tickets', // GET (dev, bureau, museum)
    '/museum/schedules', // GET (membres), POST
    '/museum/schedules/:id', // PUT, DELETE
    '/museum/schedules/reorder', // POST
    '/museum/prices', // POST
    '/museum/prices/:id', // PUT, DELETE
    '/museum/prices/reorder', // POST
    '/museum/tickets', // POST
    '/museum/tickets/:id', // PUT, DELETE
    '/museum/tickets/validate', // POST (dev, bureau, museum)
    '/museum/donation-proof/generate', // GET (dev, bureau, museum)
    '/museum/gift-codes/packs', // POST (dev, bureau), GET (dev, bureau, museum)
    '/museum/gift-codes/distribute', // POST (dev, bureau)
    '/museum/gift-codes', // GET (dev, bureau, museum)
    '/museum/special-periods', // POST, GET (dev, bureau, museum)
    '/museum/special-periods/:id', // GET, PUT, DELETE (dev, bureau, museum)
    '/events', // POST, GET
    '/events/:id', // GET, PUT, DELETE
    '/museum/calendar', // GET (route publique)
  ];

  for (const path in openApiDoc.paths) {
    const methods = Object.keys(openApiDoc.paths[path]);
    for (const method of methods) {
      const pathObj = openApiDoc.paths[path][method];
      if (pathObj) {
        // Vérifier si le path correspond à un endpoint protégé
        const isProtected = protectedPaths.some(protectedPath => {
          // Gérer les paths avec paramètres
          const pathPattern = protectedPath.replace(/:[^/]+/g, '[^/]+');
          const pathRegex = new RegExp(`^${pathPattern}$`);
          return pathRegex.test(path);
        });

        // Les méthodes POST, PUT, DELETE sont protégées (sauf certaines routes publiques)
        const isWriteMethod = ['post', 'put', 'delete'].includes(method.toLowerCase());
        const isPublicWrite = path === '/auth/signin' || path === '/auth/callback';

        // Routes publiques qui ne nécessitent pas d'authentification
        const isPublicRoute = path === '/museum/schedules/public' ||
          path === '/museum/slots' ||
          path === '/museum/tickets/payment' ||
          path === '/pay/webhook' ||
          path.startsWith('/pay/checkout/') ||
          path.startsWith('/museum/tickets/checkout/') ||
          path.startsWith('/museum/gift-codes/validate/') ||
          path === '/museum/gift-codes/purchase' ||
          path === '/museum/gift-codes/purchase/confirm';

        if ((isProtected || (isWriteMethod && !isPublicWrite)) && !isPublicRoute) {
          pathObj.security = [{ cookieAuth: [] }];
        }
      }
    }
  }

  // Écrire le fichier OpenAPI
  const outputPath = join(__dirname, '../../docs/openapi.json');
  const outputDir = dirname(outputPath);

  try {
    // Créer le dossier docs s'il n'existe pas
    const { mkdirSync } = await import('node:fs');
    mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    // Le dossier existe peut-être déjà
  }

  writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2), 'utf-8');

  // Générer aussi un fichier YAML si possible
  try {
    const yamlContent = jsonToYaml(openApiDoc);
    const yamlPath = join(__dirname, '../../docs/openapi.yaml');
    writeFileSync(yamlPath, yamlContent, 'utf-8');
    console.log(`✅ Documentation générée : ${yamlPath}`);
  } catch (err) {
    console.warn('⚠️  Impossible de générer le YAML, seul le JSON est disponible');
  }

  // Générer la version HTML avec Swagger UI
  const htmlPath = join(__dirname, '../../docs/index.html');
  const htmlContent = generateSwaggerUIHTML();
  writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`✅ Documentation HTML générée : ${htmlPath}`);

  console.log(`✅ Documentation OpenAPI générée : ${outputPath}`);
  console.log(`📊 ${features.length} feature(s) parsée(s)`);
  console.log(`📝 ${routes.length} route(s) documentée(s)`);
}

/**
 * Génère une page HTML avec Swagger UI
 * Charge la spécification OpenAPI depuis l'endpoint /docs/openapi.json
 */
function generateSwaggerUIHTML(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ocelot API - Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
    .swagger-ui .topbar {
      background-color: #1f2937;
    }
    .swagger-ui .topbar .download-url-wrapper {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      // Charger la spécification OpenAPI depuis l'endpoint
      const url = '/docs/openapi.json';
      
      SwaggerUIBundle({
        url: url,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
        oauth2RedirectUrl: window.location.href
      });
    };
  </script>
</body>
</html>`;
}

/**
 * Génère une description à partir des scénarios
 */
function generateDescriptionFromScenarios(scenarios: ParsedScenario[]): string {
  if (scenarios.length === 0) return '';

  const descriptions: string[] = [];
  for (const scenario of scenarios) {
    const whenStep = scenario.steps.find(s => s.type === 'when');
    const thenSteps = scenario.steps.filter(s => s.type === 'then' || s.type === 'and');

    if (whenStep && thenSteps.length > 0) {
      descriptions.push(`**${scenario.name}** : ${thenSteps.map(s => s.text).join(' ')}`);
    }
  }

  return descriptions.join('\n\n');
}

/**
 * Génère une description de réponse
 */
function getResponseDescription(status: number, scenario?: ParsedScenario): string {
  const statusDescriptions: Record<number, string> = {
    200: 'Succès',
    302: 'Redirection',
    401: 'Non authentifié',
    500: 'Erreur serveur',
  };

  let description = statusDescriptions[status] || `Code ${status}`;

  if (scenario) {
    const thenSteps = scenario.steps.filter(s => s.type === 'then' || s.type === 'and');
    if (thenSteps.length > 0) {
      description += ' - ' + thenSteps.map(s => s.text).join(', ');
    }
  }

  return description;
}

/**
 * Génère un exemple à partir d'un scénario
 */
function generateExampleFromScenario(scenario: ParsedScenario | undefined, schema: any): any {
  if (!scenario || !schema || !schema.properties) return undefined;

  const example: any = {};
  for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
    if (prop.type === 'string') {
      example[key] = `exemple_${key}`;
    } else if (prop.type === 'boolean') {
      example[key] = true;
    } else if (prop.type === 'number') {
      example[key] = 123;
    } else if (Array.isArray(prop.type) && prop.type.includes('null')) {
      example[key] = null;
    }
  }

  return example;
}

/**
 * Convertit JSON en YAML (version simple)
 */
function jsonToYaml(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        yaml += `${spaces}- ${jsonToYaml(item, indent + 1).trim()}\n`;
      } else {
        yaml += `${spaces}- ${item}\n`;
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        yaml += `${spaces}${key}: null\n`;
      } else if (typeof value === 'string') {
        // Échapper les caractères spéciaux YAML
        const escaped = value.replace(/"/g, '\\"');
        yaml += `${spaces}${key}: "${escaped}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        yaml += `${spaces}${key}: ${value}\n`;
      } else if (Array.isArray(value)) {
        yaml += `${spaces}${key}:\n`;
        yaml += jsonToYaml(value, indent + 1);
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n`;
        yaml += jsonToYaml(value, indent + 1);
      }
    }
  } else {
    yaml += `${spaces}${obj}\n`;
  }

  return yaml;
}

// Exécuter le script
generateOpenAPIDoc().catch(err => {
  console.error('❌ Erreur lors de la génération de la documentation:', err);
  process.exit(1);
});

