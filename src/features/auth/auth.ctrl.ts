import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type { OidcCallbackQuery } from './auth.types.ts';
import { callbackSchema, meSchema, signinSchema, signoutSchema } from './auth.schemas.ts';
import { saveZitadelUserIfNotExists } from './auth.service.ts';
import { authUtils } from './auth.utils.ts';
import { requireAuth } from './auth.middleware.ts';
import {
  createAuthorizationTransaction,
  createAuthorizationUrl,
  exchangeAuthorizationCode,
  getOidcDiscovery,
  verifyIdToken,
} from './auth.oidc.ts';
import { getZitadelConfiguration } from './auth.zitadel.ts';

const temporaryCookieNames = ['zitadel_oauth_state', 'zitadel_oauth_nonce', 'zitadel_oauth_verifier'] as const;

function frontendRedirect(reply: FastifyReply, parameter: 'error' | 'success', value: string) {
  try {
    const url = new URL(process.env.FRONTEND_URL || 'http://localhost:3000');
    url.searchParams.set(parameter, value);
    return reply.redirect(url.toString());
  } catch {
    return reply.status(500).send({ error: 'FRONTEND_URL non configurée' });
  }
}

function temporaryCookieOptions() {
  return { ...authUtils.getCookieOptions(), maxAge: 600, signed: true };
}

function clearTemporaryCookies(reply: FastifyReply) {
  for (const name of temporaryCookieNames) {
    reply.clearCookie(name, { ...authUtils.getCookieOptions(), maxAge: 0 });
  }
}

function readTemporaryCookie(req: FastifyRequest, name: string): string | null {
  const cookie = req.cookies[name];
  if (!cookie) return null;
  const unsigned = req.unsignCookie(cookie);
  return unsigned.valid && unsigned.value ? unsigned.value : null;
}

function setSessionCookies(reply: FastifyReply, tokens: { access_token: string; expires_in?: number; refresh_token?: string }) {
  const options = authUtils.getCookieOptions();
  reply.setCookie('zitadel_access_token', tokens.access_token, {
    ...options,
    maxAge: tokens.expires_in || 3600,
  });
  if (tokens.refresh_token) {
    const maxAgeDays = Number(process.env.REFRESH_TOKEN_MAX_AGE_DAYS) || 90;
    reply.setCookie('zitadel_refresh_token', tokens.refresh_token, {
      ...options,
      maxAge: 60 * 60 * 24 * maxAgeDays,
    });
  }
}

export async function signinHandler(_req: FastifyRequest, reply: FastifyReply) {
  try {
    const configuration = getZitadelConfiguration();
    const discovery = await getOidcDiscovery(configuration);
    const transaction = createAuthorizationTransaction();
    const options = temporaryCookieOptions();
    reply.setCookie('zitadel_oauth_state', transaction.state, options);
    reply.setCookie('zitadel_oauth_nonce', transaction.nonce, options);
    reply.setCookie('zitadel_oauth_verifier', transaction.verifier, options);
    return reply.redirect(createAuthorizationUrl(configuration, discovery, transaction));
  } catch (err) {
    reply.log.error({ err }, 'Impossible de démarrer l’authentification Zitadel');
    return reply.status(500).send({ error: 'Configuration Zitadel invalide' });
  }
}

export async function meHandler(req: FastifyRequest, reply: FastifyReply, app: FastifyInstance) {
  try {
    const user = await requireAuth(req, reply, app);
    if (!user) return reply.status(401).send({ error: 'Non authentifié' });

    const savedUser = await saveZitadelUserIfNotExists(app, user.id, user.username);
    return reply.send({
      id: savedUser?.id || user.id,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      roles: user.roles,
    });
  } catch (err) {
    app.log.error({ err }, 'Erreur lors de la récupération de l’utilisateur Zitadel');
    return reply.status(500).send({ error: 'Erreur serveur' });
  }
}

export async function callbackHandler(
  req: FastifyRequest<{ Querystring: OidcCallbackQuery }>,
  reply: FastifyReply,
  app: FastifyInstance,
) {
  const { code, error, state } = req.query;
  const expectedState = readTemporaryCookie(req, 'zitadel_oauth_state');
  const nonce = readTemporaryCookie(req, 'zitadel_oauth_nonce');
  const verifier = readTemporaryCookie(req, 'zitadel_oauth_verifier');
  clearTemporaryCookies(reply);

  if (!state || !expectedState || state !== expectedState || !nonce || !verifier) {
    return frontendRedirect(reply, 'error', 'invalid_state');
  }
  if (error) return frontendRedirect(reply, 'error', 'authentication_failed');
  if (!code) return frontendRedirect(reply, 'error', 'missing_code');

  try {
    const configuration = getZitadelConfiguration();
    const discovery = await getOidcDiscovery(configuration);
    const tokens = await exchangeAuthorizationCode(configuration, discovery, code, verifier);
    if (!tokens.id_token) throw new Error('ID token absent');

    const user = await verifyIdToken(configuration, discovery, tokens.id_token, nonce);
    setSessionCookies(reply, tokens);
    await saveZitadelUserIfNotExists(app, user.id, user.username);
    return frontendRedirect(reply, 'success', 'true');
  } catch (err) {
    app.log.error({ err }, 'Échec du callback Zitadel');
    return frontendRedirect(reply, 'error', 'authentication_failed');
  }
}

export async function signoutHandler(_req: FastifyRequest, reply: FastifyReply) {
  const options = { ...authUtils.getCookieOptions(), maxAge: 0 };
  reply.clearCookie('zitadel_access_token', options);
  reply.clearCookie('zitadel_refresh_token', options);
  clearTemporaryCookies(reply);
  return reply.send({ success: true });
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.get('/auth/signin', { schema: signinSchema }, signinHandler);
  app.get('/auth/signout', { schema: signoutSchema }, signoutHandler);
  app.get('/auth/me', { schema: meSchema }, (req, reply) => meHandler(req, reply, app));
  app.get<{ Querystring: OidcCallbackQuery }>('/auth/callback', { schema: callbackSchema }, (req, reply) => callbackHandler(req, reply, app));
}
