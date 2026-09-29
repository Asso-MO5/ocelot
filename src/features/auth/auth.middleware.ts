import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from './auth.types.ts';
import { authUtils } from './auth.utils.ts';
import { getOidcDiscovery, getUserinfo, refreshTokens } from './auth.oidc.ts';
import { getZitadelConfiguration } from './auth.zitadel.ts';
import { museumPermissionRoles, type MuseumPermission } from './auth.permissions.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
  interface FastifyInstance {
    ws: {
      on(event: 'connection', listener: (socket: any) => void): any;
      send?: (room: string, action: string) => void;
    } & { send(room: string, action: string): void };
  }
}

function clearSessionCookies(reply: FastifyReply) {
  const options = { ...authUtils.getCookieOptions(), maxAge: 0 };
  reply.clearCookie('zitadel_access_token', options);
  reply.clearCookie('zitadel_refresh_token', options);
}

function setSessionCookies(reply: FastifyReply, tokens: { access_token: string; expires_in?: number; refresh_token?: string }) {
  const options = authUtils.getCookieOptions();
  reply.setCookie('zitadel_access_token', tokens.access_token, {
    ...options,
    maxAge: tokens.expires_in || 3600,
  });
  if (tokens.refresh_token) {
    reply.setCookie('zitadel_refresh_token', tokens.refresh_token, {
      ...options,
      maxAge: 60 * 60 * 24 * (Number(process.env.REFRESH_TOKEN_MAX_AGE_DAYS) || 90),
    });
  }
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
  app: FastifyInstance,
): Promise<AuthenticatedUser | null> {
  const accessToken = req.cookies.zitadel_access_token;
  if (!accessToken) return null;

  try {
    const configuration = getZitadelConfiguration();
    const discovery = await getOidcDiscovery(configuration);
    let user = await getUserinfo(configuration, discovery, accessToken);
    if (user) return user;

    const refreshToken = req.cookies.zitadel_refresh_token;
    if (!refreshToken) {
      clearSessionCookies(reply);
      return null;
    }
    const tokens = await refreshTokens(configuration, discovery, refreshToken);
    user = await getUserinfo(configuration, discovery, tokens.access_token);
    if (!user) {
      clearSessionCookies(reply);
      return null;
    }
    setSessionCookies(reply, { ...tokens, refresh_token: tokens.refresh_token || refreshToken });
    return user;
  } catch (err) {
    app.log.error({ err }, 'Échec de la vérification de session Zitadel');
    clearSessionCookies(reply);
    return null;
  }
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
  return Boolean(user?.roles.includes(role.toLowerCase()));
}

export function hasAnyRole(user: AuthenticatedUser | undefined, requiredRoles: readonly string[]): boolean {
  return Boolean(
    user?.roles.some((userRole) => requiredRoles.some((role) => userRole === role.toLowerCase()))
  );
}

export function hasAllRoles(user: AuthenticatedUser | undefined, roles: string[]): boolean {
  return Boolean(user && roles.every((role) => user.roles.includes(role.toLowerCase())));
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
  };
}

export function hasMuseumPermission(user: AuthenticatedUser | undefined, permission: MuseumPermission): boolean {
  return hasAnyRole(user, [...museumPermissionRoles[permission]]);
}

export function requireMuseumPermission(permission: MuseumPermission) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method === 'OPTIONS') return;
    if (!req.user) return reply.code(401).send({ error: 'Non authentifié' });
    if (!hasMuseumPermission(req.user, permission)) {
      return reply.code(403).send({ error: 'Accès refusé : permission insuffisante' });
    }
  };
}

export function requireAllRoles(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method === 'OPTIONS') return;
    if (!req.user) return reply.code(401).send({ error: 'Non authentifié' });
    if (!hasAllRoles(req.user, roles)) return reply.code(403).send({ error: 'Accès refusé : rôles insuffisants' });
  };
}
