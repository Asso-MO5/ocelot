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

export const authUtils = {
  getCookieOptions,
}