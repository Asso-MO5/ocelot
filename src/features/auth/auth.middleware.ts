import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type { DiscordUser, DiscordUserPublic } from './auth.types.ts';
import { authUtils } from './auth.utils.ts';
import type { DiscordTokenResponse } from './auth.types.ts';

/**
 * Données utilisateur avec rôles attachées à la requête
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  roles: string[];
}

/**
 * Extension de FastifyRequest pour inclure les données utilisateur
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
  interface FastifyInstance {
    ws: {
      on(event: 'connection', listener: (socket: any) => void): any;
      send?: (room: string, action: string) => void;
    } & {
      send(room: string, action: string): void;
    };
  }
}

/**
 * Récupère les données utilisateur Discord avec les rôles
 */
async function getUserWithRoles(
  app: FastifyInstance,
  accessToken: string
): Promise<AuthenticatedUser | null> {
  try {
    let userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    // Si le token est expiré, essayer de le rafraîchir
    if (userResponse.status === 401) {
      // Le refresh doit être géré par le middleware qui appelle cette fonction
      return null;
    }

    if (!userResponse.ok) {
      return null;
    }

    const userData = await userResponse.json() as DiscordUser;

    // Récupérer les rôles depuis la guild Discord
    const guildMemberResponse = await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userData.id}`,
      {
        headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` },
      }
    );

    if (!guildMemberResponse.ok) {
      // Si l'utilisateur n'est pas dans la guild, retourner quand même les données sans rôles
      return {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
        email: userData.email,
        roles: [],
      };
    }

    const guildMember = await guildMemberResponse.json();

    const guildRolesResponse = await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/roles`,
      {
        headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` },
      }
    );

    if (!guildRolesResponse.ok) {
      return {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
        email: userData.email,
        roles: [],
      };
    }

    const guildRolesData = await guildRolesResponse.json();
    const roles = guildRolesData
      .filter((role: any) => guildMember.roles.includes(role.id))
      .map((role: any) => role.name.toLowerCase());

    return {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : null,
      email: userData.email,
      roles,
    };
  } catch (err) {
    app.log.error({ err }, 'Erreur lors de la récupération des données utilisateur');
    return null;
  }
}

/**
 * Rafraîchit le token d'accès Discord
 */
async function refreshAccessToken(
  app: FastifyInstance,
  refreshToken: string,
  reply: FastifyReply
): Promise<string | null> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
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

    if (!refreshResponse.ok) {
      return null;
    }

    const refreshData = await refreshResponse.json() as DiscordTokenResponse;
    const cookieOptions = authUtils.getCookieOptions();

    if (refreshData.access_token) {
      reply.setCookie('discord_access_token', refreshData.access_token, {
        ...cookieOptions,
        maxAge: refreshData.expires_in || 604800
      });
    }

    if (refreshData.refresh_token) {
      const refreshTokenMaxAge = Number(process.env.REFRESH_TOKEN_MAX_AGE_DAYS) || 90;
      reply.setCookie('discord_refresh_token', refreshData.refresh_token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * refreshTokenMaxAge
      });
    }

    return refreshData.access_token;
  } catch (err) {
    app.log.error({ err }, 'Erreur lors du rafraîchissement du token');
    return null;
  }
}

/**
 * Middleware pour vérifier l'authentification
 * Attache les données utilisateur à req.user si authentifié
 */
export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
): Promise<AuthenticatedUser | null> {
  let accessToken = req.cookies.discord_access_token;

  if (!accessToken) {
    return null;
  }

  let user = await getUserWithRoles(app, accessToken);

  // Si le token est expiré, essayer de le rafraîchir
  if (!user) {
    const refreshToken = req.cookies.discord_refresh_token;
    if (refreshToken) {
      const newAccessToken = await refreshAccessToken(app, refreshToken, reply);
      if (newAccessToken) {
        user = await getUserWithRoles(app, newAccessToken);
      } else {
        // Refresh échoué, supprimer les cookies
        reply.clearCookie('discord_access_token');
        reply.clearCookie('discord_refresh_token');
        return null;
      }
    } else {
      return null;
    }
  }

  return user;
}

/**
 * Hook Fastify pour vérifier l'authentification
 * Utilisez-le comme preHandler sur les routes qui nécessitent une authentification
 */
export function authenticateHook(app: FastifyInstance) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Ignorer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return;
    }

    const user = await requireAuth(req, reply, app);

    if (!user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    req.user = user;
  };
}

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 */
export function hasRole(user: AuthenticatedUser | undefined, role: string): boolean {
  if (!user) {
    return false;
  }
  return user.roles.includes(role.toLowerCase());
}

/**
 * Vérifie si l'utilisateur a au moins un des rôles spécifiés
 */
export function hasAnyRole(user: AuthenticatedUser | undefined, roles: string[]): boolean {
  if (!user) {
    return false;
  }
  return roles.some(role => user.roles.includes(role.toLowerCase()));
}

/**
 * Vérifie si l'utilisateur a tous les rôles spécifiés
 */
export function hasAllRoles(user: AuthenticatedUser | undefined, roles: string[]): boolean {
  if (!user) {
    return false;
  }
  return roles.every(role => user.roles.includes(role.toLowerCase()));
}

/**
 * Hook Fastify pour vérifier les rôles
 * Utilisez-le comme preHandler après authenticateHook
 */
export function requireRole(role: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Ignorer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return;
    }

    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    if (!hasRole(req.user, role)) {
      return reply.code(403).send({ error: 'Accès refusé : rôle insuffisant' });
    }
  };
}

/**
 * Hook Fastify pour vérifier qu'au moins un des rôles est présent
 */
export function requireAnyRole(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Ignorer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return;
    }

    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }


    if (!hasAnyRole(req.user, roles)) {
      return reply.code(403).send({ error: 'Accès refusé : rôle insuffisant' });
    }
  };
}

/**
 * Hook Fastify pour vérifier que tous les rôles sont présents
 */
export function requireAllRoles(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    // Ignorer les requêtes OPTIONS (preflight CORS)
    if (req.method === 'OPTIONS') {
      return;
    }

    if (!req.user) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }

    if (!hasAllRoles(req.user, roles)) {
      return reply.code(403).send({ error: 'Accès refusé : rôles insuffisants' });
    }
  };
}

