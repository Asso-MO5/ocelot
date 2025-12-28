import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type {
  DiscordTokenResponse,
  DiscordUser,
  DiscordUserPublic,
  DiscordErrorResponse,
  DiscordOAuthCallbackQuery,
} from './auth.types.ts';
import {
  callbackSchema,
  meSchema,
  signinSchema,
} from './auth.schemas.ts';
import { saveUserIfNotExists } from './auth.service.ts';
import { authUtils } from './auth.utils.ts';
import { requireAuth } from './auth.middleware.ts';

export async function signinHandler(_req: FastifyRequest, reply: FastifyReply) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const port = process.env.PORT || 4000;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://localhost:${port}/auth/callback`;
  const scopes = process.env.DISCORD_SCOPES || 'identify email';

  if (!clientId) {
    return reply.status(500).send({ error: 'DISCORD_CLIENT_ID non configuré' });
  }

  const authUrl = new URL('https://discord.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);

  return reply.redirect(authUrl.toString());
}


export async function meHandler(req: FastifyRequest, reply: FastifyReply, app: FastifyInstance) {
  try {
    const user = await requireAuth(req, reply, app);

    if (!user) {
      return reply.status(401).send({ error: 'Non authentifié' });
    }

    const savedUser = await saveUserIfNotExists(app, user.id, user.username);


    const publicUserData: DiscordUserPublic = {
      id: savedUser?.id || user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email,
      roles: user.roles,
    };

    return reply.send(publicUserData);
  } catch (err) {
    app.log.error(err, 'Erreur lors de la récupération des données utilisateur');
    return reply.status(500).send({ error: 'Erreur serveur' });
  }
}

export async function callbackHandler(
  req: FastifyRequest<{ Querystring: DiscordOAuthCallbackQuery }>,
  reply: FastifyReply,
  app: FastifyInstance
) {
  const { code, error } = req.query as { code?: string; error?: string };

  const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (error) {
    return reply.redirect(`${redirectUrl}?error=${error}`);
  }

  if (!code) {
    return reply.redirect(`${redirectUrl}?error=missing_code`);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const port = process.env.PORT || 4000;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://localhost:${port}/auth/callback`;

  if (!clientId || !clientSecret) {
    return reply.status(500).send({ error: 'Configuration Discord manquante' });
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  });

  const discordResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    body: params.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
  });

  if (!discordResponse.ok) {
    const errorData = await discordResponse.json() as DiscordErrorResponse;
    app.log.error(errorData, 'Erreur token');
    return reply.redirect(`http://localhost:3000?error=${errorData.error || 'unknown'}`);
  }

  const discordData = await discordResponse.json() as DiscordTokenResponse;

  const cookieOptions = authUtils.getCookieOptions();

  if (discordData.access_token) {
    reply.setCookie('discord_access_token', discordData.access_token, {
      ...cookieOptions,
      maxAge: discordData.expires_in || 604800
    });
  }

  if (discordData.refresh_token) {
    const refreshTokenMaxAge = Number(process.env.REFRESH_TOKEN_MAX_AGE_DAYS) || 90;
    reply.setCookie('discord_refresh_token', discordData.refresh_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * refreshTokenMaxAge
    });
  }

  try {
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${discordData.access_token}` },
    });

    if (userResponse.ok) {
      const userData = await userResponse.json() as DiscordUser;
      await saveUserIfNotExists(app, userData.id, userData.username);
    }
  } catch (err) {
    app.log.error({ err }, 'Erreur lors de la récupération des données utilisateur dans callback');
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return reply.redirect(`${frontendUrl}?success=true`);
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.get('/auth/signin', { schema: signinSchema }, signinHandler);
  app.get('/auth/me', { schema: meSchema }, (req, reply) => meHandler(req, reply, app));
  app.get<{ Querystring: DiscordOAuthCallbackQuery }>(
    '/auth/callback',
    { schema: callbackSchema },
    (req, reply) => callbackHandler(req, reply, app)
  );
}

