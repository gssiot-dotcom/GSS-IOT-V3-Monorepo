import type { AuthSession } from "@gss-iot/contracts";

import { type TranslationKey } from "../../app/i18n";
import { hasPermission } from "./has-permission";

export interface SidebarItem {
  permission: string;
  path: string;
  titleKey: TranslationKey;
}

export function filterSidebarItems(
  items: SidebarItem[],
  session: AuthSession | undefined,
): SidebarItem[] {
  return items.filter((item) => hasPermission(session, item.permission));
}
