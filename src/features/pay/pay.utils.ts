import type { FastifyInstance } from 'fastify';
import type {
  SumUpCheckoutRequest,
  SumUpCheckoutResponse,
  SumUpCheckoutStatus,
} from './pay.types.ts';

const SUMUP_API_BASE = 'https://api.sumup.com/v0.1';

/**
 * Récupère la clé API SumUp depuis les variables d'environnement
 */
function getSumUpApiKey(): string {
  const apiKey = process.env.SUMUP_API_KEY;
  if (!apiKey) {
    throw new Error('SUMUP_API_KEY n\'est pas configurée');
  }
  return apiKey;
}

/**
 * Récupère le code marchand SumUp depuis les variables d'environnement
 */
function getSumUpMerchantCode(): string {
  const merchantCode = process.env.SUMUP_MERCHANT_CODE;
  if (!merchantCode) {
    throw new Error('SUMUP_MERCHANT_CODE n\'est pas configuré');
  }
  return merchantCode;
}

/**
 * Crée un checkout SumUp
 */
export async function createSumUpCheckout(
  app: FastifyInstance,
  amount: number,
  description?: string,
  currency: string = 'EUR',
): Promise<SumUpCheckoutResponse> {
  const apiKey = getSumUpApiKey();

  const checkout_reference = `checkout_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  const checkoutData: SumUpCheckoutRequest = {
    checkout_reference,
    amount,
    currency,
    merchant_code: getSumUpMerchantCode(),
  };

  if (description) {
    checkoutData.description = description;
  }

  console.log(checkoutData);

  try {
    const response = await fetch(`${SUMUP_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(checkoutData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      app.log.error({ status: response.status, error: errorText }, 'Erreur lors de la création du checkout SumUp');
      throw new Error(`Erreur SumUp: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as SumUpCheckoutResponse;
    app.log.info({ checkoutId: data.id, amount, currency }, 'Checkout SumUp créé');
    return data;
  } catch (err) {
    app.log.error({ err, amount, currency }, 'Erreur lors de la création du checkout SumUp');
    throw err;
  }
}

/**
 * Vérifie le statut d'un checkout SumUp
 */
export async function getSumUpCheckoutStatus(
  app: FastifyInstance,
  checkoutId: string
): Promise<SumUpCheckoutStatus> {
  const apiKey = getSumUpApiKey();

  try {
    const response = await fetch(`${SUMUP_API_BASE}/checkouts/${checkoutId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      app.log.error({ status: response.status, error: errorText, checkoutId }, 'Erreur lors de la vérification du statut SumUp');
      throw new Error(`Erreur SumUp: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as SumUpCheckoutStatus;
    return data;
  } catch (err) {
    app.log.error({ err, checkoutId }, 'Erreur lors de la vérification du statut SumUp');
    throw err;
  }
}

