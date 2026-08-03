export interface WebEnv {
  apiBaseUrl: string;
  csrfCookieName?: string;
}

export function readWebEnv(): WebEnv {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
    csrfCookieName: import.meta.env.VITE_AUTH_CSRF_COOKIE_NAME ?? "gss_csrf",
  };
}
