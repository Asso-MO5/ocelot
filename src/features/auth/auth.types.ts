export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  verified?: boolean;
  locale?: string;
  mfa_enabled?: boolean;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

export interface DiscordErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface DiscordOAuthCallbackQuery {
  code?: string;
  error?: string;
  state?: string;
}

export interface DiscordUserPublic {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  roles: string[];
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  roles: string[];
}

