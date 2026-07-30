import { Menu } from "@mantine/core";
import { GssIconButton } from "@gss-iot/ui";
import { IconCheck, IconWorld } from "@tabler/icons-react";
import type { ReactElement } from "react";

import { useI18n } from "./locale-context";
import type { Locale } from "./types";

const languageNames: ReadonlyArray<{ label: string; value: Locale }> = [
  { label: "한국어", value: "ko" },
  { label: "English", value: "en" },
];

export function LanguageSelector(): ReactElement {
  const { locale, setLocale, t } = useI18n();

  return (
    <Menu position="bottom-end" shadow="md" withinPortal>
      <Menu.Target>
        <GssIconButton aria-label={t("shell.languageSelector")} data-testid="language-selector">
          <IconWorld aria-hidden size={18} />
        </GssIconButton>
      </Menu.Target>
      <Menu.Dropdown aria-label={t("shell.languageSelector")}>
        {languageNames.map((language) => (
          <Menu.Item
            aria-checked={locale === language.value}
            key={language.value}
            leftSection={locale === language.value ? <IconCheck aria-hidden size={16} /> : null}
            onClick={() => setLocale(language.value)}
            role="menuitemradio"
          >
            {language.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
