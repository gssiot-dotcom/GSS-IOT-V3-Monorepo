const messages = {
  "app.name": "GSS IoT V3",
  "auth.company": "Company",
  "auth.email": "Email",
  "auth.gss": "GSS Admin",
  "auth.inactive": "Your session is inactive. Please sign in again.",
  "auth.login": "Sign in",
  "auth.loginError": "Unable to sign in with those credentials.",
  "auth.password": "Password",
  "auth.signOut": "Sign out",
  "common.forbidden": "You do not have access to this page.",
  "common.loading": "Loading",
  "common.pageUnavailable": "This workspace is not available yet.",
  "nav.adminCompanies": "Companies",
  "nav.adminDashboard": "Dashboard",
  "nav.adminRoles": "GSS roles",
  "nav.companyBuildings": "Buildings",
  "nav.companyDashboard": "Dashboard",
  "nav.companyRoles": "Roles",
  "nav.companyUsers": "Users",
} as const;

export type TranslationKey = keyof typeof messages;

export function t(key: TranslationKey): string {
  return messages[key];
}
