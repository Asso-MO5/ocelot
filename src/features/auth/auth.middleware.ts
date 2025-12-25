import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type { DiscordUser, DiscordTokenResponse, AuthenticatedUser } from './auth.types.ts';
import { authUtils } from './auth.utils.ts';

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

async function getUserWithRoles(
  app: FastifyInstance,
  accessToken: string
): Promise<AuthenticatedUser | null> {
  try {
    let userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (userResponse.status === 401) return null;
    if (!userResponse.ok) return null;

    const userData = await userResponse.json() as DiscordUser;

    const guildMemberResponse = await fetch(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userData.id}`,
      {
        headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` },
      }
    );

    if (!guildMemberResponse.ok) {
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

async function refreshAccessToken(
  app: FastifyInstance,
  refreshToken: string,
  reply: FastifyReply
): Promise<string | null> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

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

    if (!refreshResponse.ok) return null;

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

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance
): Promise<AuthenticatedUser | null> {
  let accessToken = req.cookies.discord_access_token;

  if (!accessToken) return null;

  let user = await getUserWithRoles(app, accessToken);

  if (!user) {
    const refreshToken = req.cookies.discord_refresh_token;
    if (refreshToken) {
      const newAccessToken = await refreshAccessToken(app, refreshToken, reply);
      if (newAccessToken) {
        user = await getUserWithRoles(app, newAccessToken);
      } else {
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


export function authenticateHook(app: FastifyInstance) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method === 'OPTIONS') return;

    const user = await requireAuth(req, reply, app);

    if (!user) return reply.code(401).send({ error: 'Non authentifié' });

    req.user = user;
  };
}


export function hasRole(user: AuthenticatedUser | undefined, role: string): boolean {
  if (!user) {
    return false;
  }
  return user.roles.includes(role.toLowerCase());
}


export function hasAnyRole(user: AuthenticatedUser | undefined, roles: string[]): boolean {
  if (!user) return false;

  return roles.some(role => user.roles.includes(role.toLowerCase()));
}


export function hasAllRoles(user: AuthenticatedUser | undefined, roles: string[]): boolean {
  if (!user) return false;
  return roles.every(role => user.roles.includes(role.toLowerCase()));
}

export function requireRole(role: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method === 'OPTIONS') return;
    if (!req.user) return reply.code(401).send({ error: 'Non authentifié' });
    if (!hasRole(req.user, role)) return reply.code(403).send({ error: 'Accès refusé : rôle insuffisant' });
  };
}


export function requireAnyRole(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method === 'OPTIONS') return;
    if (!req.user) return reply.code(401).send({ error: 'Non authentifié' });
    if (!hasAnyRole(req.user, roles)) return reply.code(403).send({ error: 'Accès refusé : rôle insuffisant' });
    return;
  };
}

export function requireAllRoles(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method === 'OPTIONS') return;
    if (!req.user) return reply.code(401).send({ error: 'Non authentifié' });
    if (!hasAllRoles(req.user, roles)) return reply.code(403).send({ error: 'Accès refusé : rôles insuffisants' });
    return;
  };
}

