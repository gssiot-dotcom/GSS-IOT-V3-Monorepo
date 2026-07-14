export interface WebEnv {
  apiBaseUrl: string;
}

export function readWebEnv(): WebEnv {
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  };
}
