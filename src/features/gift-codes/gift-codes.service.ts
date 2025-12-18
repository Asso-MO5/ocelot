import type { FastifyInstance } from 'fastify';
import type {
  GiftCode,
  GiftCodeStatus,
  CreateGiftCodePackBody,
  GiftCodePackResult,
  GetGiftCodesQuery,
  PaginatedGiftCodesResponse,
  GetGiftCodePacksQuery,
  PaginatedGiftCodePacksResponse,
  GiftCodePackWithCodes,
  PurchaseGiftCodesBody,
} from './gift-codes.types.ts';
import { createCheckout, getCheckoutStatus } from '../pay/pay.utils.ts';
import { getSettingValue } from '../settings/settings.service.ts';
import { emailUtils } from '../email/email.utils.ts';

/**
 * Génère un code cadeau unique (12 caractères alphanumériques majuscules)
 */
async function generateUniqueGiftCode(app: FastifyInstance): Promise<string> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const length = 12;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Générer un code aléatoire
    let code = '';
    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Vérifier l'unicité
    const existing = await app.pg.query<{ code: string }>(
      'SELECT code FROM gift_codes WHERE code = $1',
      [code]
    );

    if (existing.rows.length === 0) {
      return code;
    }

    attempts++;
  }

  throw new Error('Impossible de générer un code cadeau unique après plusieurs tentatives');
}

/**
 * Crée un pack de codes cadeaux
 */
export async function createGiftCodePack(
  app: FastifyInstance,
  data: CreateGiftCodePackBody
): Promise<GiftCodePackResult> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Validation
  if (!data.quantity || data.quantity < 1) {
    throw new Error('La quantité doit être supérieure à 0');
  }

  if (data.quantity > 1000) {
    throw new Error('La quantité ne peut pas dépasser 1000 codes par pack');
  }

  // Générer un pack_id unique
  const packId = crypto.randomUUID();

  // Créer les codes dans une transaction
  const codes: GiftCode[] = [];

  try {
    await app.pg.query('BEGIN');

    for (let i = 0; i < data.quantity; i++) {
      const code = await generateUniqueGiftCode(app);
      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;

      const result = await app.pg.query<GiftCode>(
        `INSERT INTO gift_codes (
          code, status, pack_id, expires_at, notes
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          code,
          'unused',
          packId,
          expiresAt,
          data.notes ?? null,
        ]
      );

      codes.push(result.rows[0]);
    }

    await app.pg.query('COMMIT');
  } catch (err) {
    await app.pg.query('ROLLBACK');
    throw err;
  }

  return {
    pack_id: packId,
    codes,
    quantity: data.quantity,
  };
}

/**
 * Valide un code cadeau (vérifie qu'il existe, n'est pas utilisé et n'est pas expiré)
 */
export async function validateGiftCode(
  app: FastifyInstance,
  code: string
): Promise<GiftCode> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Récupérer le code
  const result = await app.pg.query<GiftCode>(
    'SELECT * FROM gift_codes WHERE code = $1',
    [code.toUpperCase()]
  );

  if (result.rows.length === 0) {
    throw new Error(`Code cadeau invalide: ${code}`);
  }

  const giftCode = result.rows[0];

  // Vérifier le statut
  if (giftCode.status === 'used') {
    throw new Error(`Le code cadeau ${code} a déjà été utilisé`);
  }

  if (giftCode.status === 'expired') {
    throw new Error(`Le code cadeau ${code} a expiré`);
  }

  // Vérifier l'expiration
  if (giftCode.expires_at) {
    const expiresAt = new Date(giftCode.expires_at);
    const now = new Date();
    if (now > expiresAt) {
      // Marquer comme expiré
      await app.pg.query(
        'UPDATE gift_codes SET status = $1, updated_at = current_timestamp WHERE id = $2',
        ['expired', giftCode.id]
      );
      throw new Error(`Le code cadeau ${code} a expiré`);
    }
  }

  return giftCode;
}

/**
 * Utilise un code cadeau (l'associe à un ticket)
 */
export async function useGiftCode(
  app: FastifyInstance,
  code: string,
  ticketId: string
): Promise<GiftCode> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Valider le code
  const giftCode = await validateGiftCode(app, code);

  // Marquer le code comme utilisé
  const result = await app.pg.query<GiftCode>(
    `UPDATE gift_codes 
     SET status = 'used', 
         ticket_id = $1, 
         used_at = current_timestamp,
         updated_at = current_timestamp
     WHERE id = $2
     RETURNING *`,
    [ticketId, giftCode.id]
  );

  return result.rows[0];
}

/**
 * Utilise plusieurs codes cadeaux (pour une commande)
 */
export async function useGiftCodes(
  app: FastifyInstance,
  codes: string[],
  ticketIds: string[]
): Promise<GiftCode[]> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  if (codes.length !== ticketIds.length) {
    throw new Error('Le nombre de codes doit correspondre au nombre de tickets');
  }

  const usedCodes: GiftCode[] = [];

  try {
    await app.pg.query('BEGIN');

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const ticketId = ticketIds[i];
      const usedCode = await useGiftCode(app, code, ticketId);
      usedCodes.push(usedCode);
    }

    await app.pg.query('COMMIT');
  } catch (err) {
    await app.pg.query('ROLLBACK');
    throw err;
  }

  return usedCodes;
}

/**
 * Récupère tous les codes cadeaux avec filtres optionnels et pagination
 */
export async function getGiftCodes(
  app: FastifyInstance,
  query: GetGiftCodesQuery = {}
): Promise<PaginatedGiftCodesResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Paramètres de pagination (par défaut : page 1, limit 100)
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 100;
  const offset = (page - 1) * limit;

  // Construction de la clause WHERE
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (query.status) {
    whereClause += ` AND status = $${paramIndex}`;
    params.push(query.status);
    paramIndex++;
  }

  if (query.pack_id) {
    whereClause += ` AND pack_id = $${paramIndex}`;
    params.push(query.pack_id);
    paramIndex++;
  }

  if (query.recipient_email) {
    whereClause += ` AND recipient_email = $${paramIndex}`;
    params.push(query.recipient_email);
    paramIndex++;
  }

  if (query.ticket_id) {
    whereClause += ` AND ticket_id = $${paramIndex}`;
    params.push(query.ticket_id);
    paramIndex++;
  }

  // Requête pour compter le total
  const countSql = `SELECT COUNT(*) as total FROM gift_codes ${whereClause}`;
  const countResult = await app.pg.query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Requête pour récupérer les codes avec pagination
  const limitParamIndex = paramIndex;
  const offsetParamIndex = paramIndex + 1;
  const dataSql = `SELECT * FROM gift_codes ${whereClause} ORDER BY created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;
  const dataParams = [...params, limit, offset];
  const result = await app.pg.query<GiftCode>(dataSql, dataParams);

  // Calculer le nombre total de pages
  const totalPages = Math.ceil(total / limit);

  return {
    codes: result.rows,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Récupère un code cadeau par son code
 */
export async function getGiftCodeByCode(
  app: FastifyInstance,
  code: string
): Promise<GiftCode | null> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const result = await app.pg.query<GiftCode>(
    'SELECT * FROM gift_codes WHERE code = $1',
    [code.toUpperCase()]
  );

  return result.rows[0] || null;
}

/**
 * Récupère les packs de codes cadeaux avec leurs codes associés (paginé)
 * Si un code est fourni dans la recherche, retourne uniquement le pack qui contient ce code
 */
export async function getGiftCodePacks(
  app: FastifyInstance,
  query: GetGiftCodePacksQuery = {}
): Promise<PaginatedGiftCodePacksResponse> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  // Paramètres de pagination (par défaut : page 1, limit 50)
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? query.limit : 50;
  const offset = (page - 1) * limit;

  let packIds: string[] = [];

  // Si une recherche par code est demandée, trouver le pack_id correspondant
  if (query.code) {
    const codeResult = await app.pg.query<{ pack_id: string | null }>(
      'SELECT pack_id FROM gift_codes WHERE code = $1',
      [query.code.toUpperCase()]
    );

    if (codeResult.rows.length === 0 || !codeResult.rows[0].pack_id) {
      // Aucun pack trouvé pour ce code
      return {
        packs: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    packIds = [codeResult.rows[0].pack_id];
  } else {
    // Récupérer tous les pack_ids distincts
    const packIdsResult = await app.pg.query<{ pack_id: string }>(
      `SELECT DISTINCT pack_id 
       FROM gift_codes 
       WHERE pack_id IS NOT NULL
       ORDER BY pack_id DESC`
    );
    packIds = packIdsResult.rows.map(row => row.pack_id);
  }

  const total = packIds.length;
  const totalPages = Math.ceil(total / limit);

  // Paginer les pack_ids
  const paginatedPackIds = packIds.slice(offset, offset + limit);

  // Pour chaque pack, récupérer ses codes et les statistiques
  const packs: GiftCodePackWithCodes[] = [];

  for (const packId of paginatedPackIds) {
    // Récupérer tous les codes du pack
    const codesResult = await app.pg.query<GiftCode>(
      `SELECT * FROM gift_codes 
       WHERE pack_id = $1 
       ORDER BY created_at ASC`,
      [packId]
    );

    const codes = codesResult.rows;

    // Calculer les statistiques
    const unused_count = codes.filter(c => c.status === 'unused').length;
    const used_count = codes.filter(c => c.status === 'used').length;
    const expired_count = codes.filter(c => c.status === 'expired').length;

    // Récupérer la date de création (date du premier code créé)
    const created_at = codes.length > 0 ? codes[0].created_at : new Date().toISOString();

    packs.push({
      pack_id: packId,
      codes,
      codes_count: codes.length,
      unused_count,
      used_count,
      expired_count,
      created_at,
    });
  }

  return {
    packs,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Crée une session de paiement pour l'achat public de codes cadeaux
 * Prix unitaire récupéré depuis le setting "gift_code_price"
 */
export async function purchaseGiftCodes(
  app: FastifyInstance,
  data: PurchaseGiftCodesBody
): Promise<{ checkout_id: string; checkout_url: string }> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  if (!data.quantity || data.quantity < 1) {
    throw new Error('La quantité doit être au moins 1');
  }
  if (data.quantity > 100) {
    throw new Error('La quantité maximale autorisée est 100');
  }

  const pricePerCode = (await getSettingValue<number>(app, 'gift_code_price', 0)) || 0;
  if (pricePerCode <= 0) {
    throw new Error('Le prix des codes cadeaux (gift_code_price) doit être configuré');
  }

  const totalAmount = pricePerCode * data.quantity;
  const currency = 'EUR';

  const metadata: Record<string, string> = {
    purchase_type: 'gift_codes',
    gift_codes_quantity: String(data.quantity),
    buyer_email: data.email,
    language: data.language || 'fr',
  };

  const checkout = await createCheckout(
    app,
    totalAmount,
    `Achat de ${data.quantity} code(s) cadeau`,
    currency,
    data.success_url,
    data.cancel_url,
    metadata
  );

  return {
    checkout_id: checkout.id,
    checkout_url: checkout.url,
  };
}

/**
 * Confirme un achat public de codes cadeaux après paiement
 * - Vérifie le statut Stripe (payment_status = paid)
 * - Génère le pack et envoie l'email avec les codes
 */
export async function confirmPurchaseGiftCodes(
  app: FastifyInstance,
  checkoutId: string
): Promise<{ pack_id: string; codes: string[] }> {
  if (!app.pg) {
    throw new Error('Base de données non disponible');
  }

  const status = await getCheckoutStatus(app, checkoutId);
  if (status.payment_status !== 'paid') {
    throw new Error('Le paiement n\'est pas confirmé pour cette session');
  }

  const quantity = parseInt(status.metadata?.gift_codes_quantity || '0', 10);
  const buyerEmail = status.metadata?.buyer_email;
  const language = (status.metadata?.language as 'fr' | 'en') || 'fr';

  if (!quantity || quantity <= 0) {
    throw new Error('Quantité invalide dans la session de paiement');
  }
  if (!buyerEmail) {
    throw new Error('Email de l\'acheteur manquant dans la session de paiement');
  }

  // Créer le pack de codes
  const pack = await createGiftCodePack(app, {
    quantity,
    notes: JSON.stringify({
      purchase_type: 'gift_codes_public',
      checkout_id: checkoutId,
      buyer_email: buyerEmail,
    }),
  });

  // Associer l'email du destinataire aux codes
  await app.pg.query(
    `UPDATE gift_codes 
     SET recipient_email = $1, updated_at = current_timestamp 
     WHERE pack_id = $2`,
    [buyerEmail, pack.pack_id]
  );

  // Envoyer l'email avec les codes et les instructions
  const codesList = pack.codes.map(c => c.code).join('<br>');
  const instructionsUrl = 'https://museedujeuvideo.org/fr/ticket';

  const subject = language === 'en'
    ? 'Your gift codes - Musée du Jeu Vidéo'
    : 'Vos codes cadeaux - Musée du Jeu Vidéo';

  const body = `
    <p>${language === 'en' ? 'Hello,' : 'Bonjour,'}</p>
    <p>${language === 'en'
      ? 'Here are your gift codes:'
      : 'Voici vos codes cadeaux :'}</p>
    <p style="font-family: monospace; font-size: 16px; font-weight: bold;">
      ${codesList}
    </p>
    <p>${language === 'en'
      ? 'To use them: go to the booking page, select a date and a slot, choose a ticket and enter your code via \"Add a gift code\" in the personal information section.'
      : 'Pour les utiliser : rendez-vous sur la page de réservation, sélectionnez une date et un horaire, choisissez une place et saisissez votre code via \"Ajouter un code cadeau\" dans la section informations personnelles.'}</p>
    <p>${language === 'en'
      ? `Booking page: <a href=\"${instructionsUrl}\">${instructionsUrl}</a>`
      : `Page de réservation : <a href=\"${instructionsUrl}\">${instructionsUrl}</a>`}</p>
    <p>${language === 'en'
      ? 'Best regards,<br>The MO5.com team'
      : 'Cordialement,<br>L\'équipe MO5.com'}</p>
  `;

  await emailUtils.sendEmail({
    email: buyerEmail,
    name: buyerEmail,
    subject,
    body,
    language,
  });

  return {
    pack_id: pack.pack_id,
    codes: pack.codes.map(c => c.code),
  };
}

