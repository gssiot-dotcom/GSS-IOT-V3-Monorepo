import type { AuthSession } from "@gss-iot/contracts";

import { type TranslationKey } from "../../app/i18n";
import { hasPermission } from "./has-permission";

export interface SidebarItem {
  permission: string;
  path: string;
  titleKey: TranslationKey;
}

export function filterSidebarItems<TItem extends SidebarItem>(
  items: TItem[],
  session: AuthSession | undefined,
): TItem[] {
  return items.filter((item) => hasPermission(session, item.permission));
}
