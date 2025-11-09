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
  sessionSchema,
  meSchema,
  signinSchema,
} from './auth.schemas.ts';

function getCookieOptions() {
  const options: any = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  if (process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
}

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

export async function loginHandler(_req: FastifyRequest, reply: FastifyReply) {
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

export async function sessionHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    authenticated: !!req.cookies.discord_access_token,
    hasRefreshToken: !!req.cookies.discord_refresh_token
  });
}

export async function meHandler(req: FastifyRequest, reply: FastifyReply, app: FastifyInstance) {
  let accessToken = req.cookies.discord_access_token;

  if (!accessToken) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  try {
    let userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (userResponse.status === 401) {
      const refreshToken = req.cookies.discord_refresh_token;
      if (refreshToken) {
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;

        if (clientId && clientSecret) {
          const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          });

          const refreshResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
            method: 'POST',
            body: params.toString(),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${credentials}`,
            },
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json() as DiscordTokenResponse;
            const cookieOptions = getCookieOptions();

            if (refreshData.access_token) {
              reply.setCookie('discord_access_token', refreshData.access_token, {
                ...cookieOptions,
                maxAge: refreshData.expires_in || 604800
              });
              accessToken = refreshData.access_token;
            }

            if (refreshData.refresh_token) {
              const refreshTokenMaxAge = Number(process.env.REFRESH_TOKEN_MAX_AGE_DAYS) || 90;
              reply.setCookie('discord_refresh_token', refreshData.refresh_token, {
                ...cookieOptions,
                maxAge: 60 * 60 * 24 * refreshTokenMaxAge
              });
            }

            userResponse = await fetch('https://discord.com/api/users/@me', {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
          } else {
            reply.clearCookie('discord_access_token');
            reply.clearCookie('discord_refresh_token');
            return reply.status(401).send({ error: 'Session expirée, veuillez vous reconnecter' });
          }
        }
      } else {
        return reply.status(401).send({ error: 'Token expiré et aucun refresh token disponible' });
      }
    }

    if (!userResponse.ok) {
      return reply.status(userResponse.status).send({ error: 'Erreur' });
    }

    const userData = await userResponse.json() as DiscordUser;
    const publicUserData: DiscordUserPublic = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      email: userData.email
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
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return reply.redirect(`http://localhost:3000?error=${error}`);
  }

  if (!code) {
    return reply.redirect('http://localhost:3000?error=missing_code');
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

  const cookieOptions = getCookieOptions();

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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return reply.redirect(`${frontendUrl}?success=true`);
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.get('/auth/signin', { schema: signinSchema }, signinHandler);
  app.get('/auth/login', { schema: signinSchema }, loginHandler);
  app.get('/auth/session', { schema: sessionSchema }, sessionHandler);
  app.get('/auth/me', { schema: meSchema }, (req, reply) => meHandler(req, reply, app));
  app.get<{ Querystring: DiscordOAuthCallbackQuery }>(
    '/auth/callback',
    { schema: callbackSchema },
    (req, reply) => callbackHandler(req, reply, app)
  );
  // Note: /auth/refresh n'est pas nécessaire car /auth/me gère automatiquement le refresh du token
}

