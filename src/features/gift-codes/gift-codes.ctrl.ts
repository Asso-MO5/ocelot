import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  createGiftCodePackSchema,
  distributeGiftCodesSchema,
  getGiftCodesSchema,
  getGiftCodePacksSchema,
  validateGiftCodeSchema,
  purchaseGiftCodesSchema,
  confirmPurchaseGiftCodesSchema,
} from './gift-codes.schemas.ts';
import type {
  CreateGiftCodePackBody,
  DistributeGiftCodesBody,
  GetGiftCodesQuery,
  GetGiftCodePacksQuery,
  PurchaseGiftCodesBody,
  ConfirmPurchaseGiftCodesBody,
} from './gift-codes.types.ts';
import {
  createGiftCodePack,
  getGiftCodes,
  validateGiftCode,
  getGiftCodePacks,
  purchaseGiftCodes,
  confirmPurchaseGiftCodes,
} from './gift-codes.service.ts';
import { authenticateHook, requireAnyRole } from '../auth/auth.middleware.ts';
import { roles } from '../auth/auth.const.ts';
import { emailUtils } from '../email/email.utils.ts';

export async function createGiftCodePackHandler(
  req: FastifyRequest<{ Body: CreateGiftCodePackBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const result = await createGiftCodePack(app, req.body);
    return reply.code(201).send(result);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création du pack de codes cadeaux');
    return reply.code(500).send({ error: err.message || 'Erreur lors de la création du pack de codes cadeaux' });
  }
}

async function distributeGiftCodesHandler(
  req: FastifyRequest<{ Body: DistributeGiftCodesBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { code_ids, recipient_email, subject, message, language = 'fr' } = req.body;

    if (!app.pg) {
      return reply.code(500).send({ error: 'Base de données non disponible' });
    }

    const codesResult = await app.pg.query<{ id: string; code: string; status: string }>(
      `SELECT id, code, status FROM gift_codes WHERE id = ANY($1::uuid[])`,
      [code_ids]
    );

    if (codesResult.rows.length !== code_ids.length) {
      return reply.code(400).send({ error: 'Certains codes n\'existent pas' });
    }

    const usedCodes = codesResult.rows.filter(c => c.status !== 'unused');
    if (usedCodes.length > 0) {
      return reply.code(400).send({
        error: `Certains codes sont déjà utilisés: ${usedCodes.map(c => c.code).join(', ')}`
      });
    }

    await app.pg.query(
      `UPDATE gift_codes 
       SET recipient_email = $1, updated_at = current_timestamp 
       WHERE id = ANY($2::uuid[])`,
      [recipient_email, code_ids]
    );

    const codesList = codesResult.rows.map(c => c.code).join('<br>');
    const emailSubject = subject || (language === 'en'
      ? 'Your gift codes for the Video Game Museum'
      : 'Vos codes cadeaux pour le Musée du Jeu Vidéo');

    const emailBody = `
      <p>${language === 'en' ? 'Hello,' : 'Bonjour,'}</p>
      ${message ? `<p>${message}</p>` : ''}
      <p>${language === 'en'
        ? 'Here are your gift codes:'
        : 'Voici vos codes cadeaux :'}</p>
      <p style="font-family: monospace; font-size: 16px; font-weight: bold;">
        ${codesList}
      </p>
      <p>${language === 'en'
        ? 'You can use these codes when booking your tickets on our website.'
        : 'Vous pouvez utiliser ces codes lors de la réservation de vos billets sur notre site web.'}</p>
      <p>${language === 'en'
        ? 'Best regards,<br>The MO5.com team'
        : 'Cordialement,<br>L\'équipe MO5.com'}</p>
    `;

    await emailUtils.sendEmail({
      email: recipient_email,
      name: recipient_email,
      subject: emailSubject,
      body: emailBody,
      language: language as 'fr' | 'en',
    });

    app.log.info({
      recipient_email,
      codes_count: code_ids.length
    }, 'Codes cadeaux distribués par email');

    return reply.send({
      message: language === 'en'
        ? 'Gift codes sent successfully'
        : 'Codes cadeaux envoyés avec succès',
      codes_sent: code_ids.length,
    });
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la distribution des codes cadeaux');
    return reply.code(500).send({ error: err.message || 'Erreur lors de la distribution des codes cadeaux' });
  }
}

async function getGiftCodesHandler(
  req: FastifyRequest<{ Querystring: GetGiftCodesQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const result = await getGiftCodes(app, req.query);
    return reply.send(result);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des codes cadeaux');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des codes cadeaux' });
  }
}

export async function validateGiftCodeHandler(
  req: FastifyRequest<{ Params: { code: string } }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const code = req.params.code.toUpperCase();
    const giftCode = await validateGiftCode(app, code);
    return reply.send(giftCode);
  } catch (err: any) {
    app.log.error({ err, code: req.params.code }, 'Erreur lors de la validation du code cadeau');

    if (err.message?.includes('invalide') || err.message?.includes('déjà été utilisé') || err.message?.includes('expiré')) {
      return reply.code(400).send({ error: err.message });
    }

    if (err.message?.includes('non trouvé')) {
      return reply.code(404).send({ error: err.message });
    }

    return reply.code(500).send({ error: 'Erreur lors de la validation du code cadeau' });
  }
}

async function getGiftCodePacksHandler(
  req: FastifyRequest<{ Querystring: GetGiftCodePacksQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const result = await getGiftCodePacks(app, req.query);
    return reply.send(result);
  } catch (err: any) {
    app.log.error({ err, query: req.query }, 'Erreur lors de la récupération des packs de codes cadeaux');
    return reply.code(500).send({ error: 'Erreur lors de la récupération des packs de codes cadeaux' });
  }
}

export async function purchaseGiftCodesHandler(
  req: FastifyRequest<{ Body: PurchaseGiftCodesBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const result = await purchaseGiftCodes(app, req.body);
    return reply.code(201).send(result);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la création du checkout pour les codes cadeaux');
    const message = err.message || 'Erreur lors de la création du checkout';
    return reply.code(400).send({ error: message });
  }
}

export async function confirmPurchaseGiftCodesHandler(
  req: FastifyRequest<{ Body: ConfirmPurchaseGiftCodesBody }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  try {
    const { checkout_id } = req.body;
    const result = await confirmPurchaseGiftCodes(app, checkout_id);
    return reply.send(result);
  } catch (err: any) {
    app.log.error({ err, body: req.body }, 'Erreur lors de la confirmation de l\'achat de codes cadeaux');
    const msg = err.message || 'Erreur lors de la confirmation';
    const isPayment = msg.includes('paiement') || msg.includes('payment');
    return reply.code(isPayment ? 400 : 500).send({ error: msg });
  }
}

export function registerGiftCodesRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateGiftCodePackBody }>(
    '/museum/gift-codes/packs',
    {
      schema: createGiftCodePackSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev]),
      ],
    },
    async (req, reply) => createGiftCodePackHandler(req, reply, app)
  );

  app.post<{ Body: DistributeGiftCodesBody }>(
    '/museum/gift-codes/distribute',
    {
      schema: distributeGiftCodesSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => distributeGiftCodesHandler(req, reply, app)
  );

  app.get<{ Querystring: GetGiftCodesQuery }>(
    '/museum/gift-codes',
    {
      schema: getGiftCodesSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => getGiftCodesHandler(req, reply, app)
  );

  app.get<{ Querystring: GetGiftCodePacksQuery }>(
    '/museum/gift-codes/packs',
    {
      schema: getGiftCodePacksSchema,
      preHandler: [
        authenticateHook(app),
        requireAnyRole([roles.bureau, roles.dev, roles.museum]),
      ],
    },
    async (req, reply) => getGiftCodePacksHandler(req, reply, app)
  );

  app.get<{ Params: { code: string } }>(
    '/museum/gift-codes/validate/:code',
    {
      schema: validateGiftCodeSchema,
    },
    async (req, reply) => validateGiftCodeHandler(req, reply, app)
  );

  app.post<{ Body: PurchaseGiftCodesBody }>(
    '/museum/gift-codes/purchase',
    {
      schema: purchaseGiftCodesSchema,
    },
    async (req, reply) => purchaseGiftCodesHandler(req, reply, app)
  );

  app.post<{ Body: ConfirmPurchaseGiftCodesBody }>(
    '/museum/gift-codes/purchase/confirm',
    {
      schema: confirmPurchaseGiftCodesSchema,
    },
    async (req, reply) => confirmPurchaseGiftCodesHandler(req, reply, app)
  );
}

