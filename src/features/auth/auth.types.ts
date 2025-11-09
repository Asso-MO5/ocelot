/**
 * Types pour les payloads et réponses de l'API Discord OAuth2
 */

/**
 * Réponse de l'API Discord OAuth2 Token
 * Utilisée lors de l'échange du code d'autorisation ou du refresh token
 */
export interface DiscordTokenResponse {
  /** Token d'accès pour les requêtes API Discord */
  access_token: string;
  /** Type de token (généralement "Bearer") */
  token_type: string;
  /** Durée de vie du token en secondes */
  expires_in: number;
  /** Token de rafraîchissement pour obtenir un nouveau access_token */
  refresh_token: string;
  /** Scopes accordés (séparés par des espaces) */
  scope: string;
}

/**
 * Données utilisateur Discord retournées par l'API /users/@me
 */
export interface DiscordUser {
  /** ID unique de l'utilisateur Discord */
  id: string;
  /** Nom d'utilisateur (sans le discriminator) */
  username: string;
  /** Discriminator (4 chiffres, ex: "0001") */
  discriminator: string;
  /** Hash de l'avatar ou null si aucun avatar */
  avatar: string | null;
  /** Email de l'utilisateur (si le scope email est accordé) */
  email?: string;
  /** Indique si l'utilisateur a vérifié son email */
  verified?: boolean;
  /** Locale de l'utilisateur */
  locale?: string;
  /** Indique si l'utilisateur a activé la 2FA */
  mfa_enabled?: boolean;
  /** Flags utilisateur */
  flags?: number;
  /** Type de premium (0 = aucun, 1 = Nitro Classic, 2 = Nitro) */
  premium_type?: number;
  /** Flags publics */
  public_flags?: number;
}

/**
 * Réponse d'erreur de l'API Discord OAuth2
 */
export interface DiscordErrorResponse {
  /** Code d'erreur (ex: "invalid_grant", "invalid_request", etc.) */
  error: string;
  /** Description détaillée de l'erreur (optionnel) */
  error_description?: string;
  /** URI d'erreur (optionnel) */
  error_uri?: string;
}

/**
 * Paramètres de query du callback OAuth2 Discord
 */
export interface DiscordOAuthCallbackQuery {
  /** Code d'autorisation retourné par Discord (si succès) */
  code?: string;
  /** Code d'erreur retourné par Discord (si échec) */
  error?: string;
  /** État passé lors de la requête initiale (optionnel) */
  state?: string;
}

/**
 * Données utilisateur simplifiées retournées par notre API
 * (sous-ensemble de DiscordUser)
 */
export interface DiscordUserPublic {
  /** ID unique de l'utilisateur Discord */
  id: string;
  /** Nom d'utilisateur */
  username: string;
  /** Discriminator */
  discriminator: string;
  /** Hash de l'avatar ou null */
  avatar: string | null;
  /** Email de l'utilisateur */
  email?: string;
}

/**
 * Paramètres pour la requête d'échange de code OAuth2
 */
export interface DiscordTokenRequestParams {
  /** Type de grant (authorization_code ou refresh_token) */
  grant_type: 'authorization_code' | 'refresh_token';
  /** Code d'autorisation (pour authorization_code) */
  code?: string;
  /** Token de rafraîchissement (pour refresh_token) */
  refresh_token?: string;
  /** URI de redirection */
  redirect_uri: string;
}

