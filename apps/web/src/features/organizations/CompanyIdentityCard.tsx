import type { CompanyRecord } from "@gss-iot/contracts";
import { isInteractiveTarget } from "@gss-iot/ui";
import { Avatar, Box, Card, Group, Skeleton, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  IconArrowUpRight,
  IconBuildingCommunity,
  IconMapPin,
  IconPhone,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { t } from "../../app/i18n";
import { useAuthenticatedLogo } from "../../shared/branding/use-authenticated-logo";

export function CompanyIdentityCard({
  action,
  company,
  onOpen,
  status,
}: {
  action?: ReactNode;
  company: CompanyRecord;
  onOpen: () => void;
  status: ReactNode;
}) {
  return (
    <Card
      aria-label={`${t("organizations.openCompany")}: ${company.name}`}
      className="gss-company-identity-card"
      onClick={(event) => {
        if (!isInteractiveTarget(event.target, event.currentTarget)) onOpen();
      }}
      onKeyDown={(event) => {
        if (
          !isInteractiveTarget(event.target, event.currentTarget) &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          onOpen();
        }
      }}
      role="button"
      shadow="md"
      tabIndex={0}
    >
      <Box className="gss-company-identity-band" />
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <CompanyCardLogo company={company} />
        {action}
      </Group>
      <Stack gap={5} mt="md">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          {company.code ?? t("organizations.noCode")}
        </Text>
        <Text fw={800} lineClamp={2} size="lg" title={company.name}>
          {company.name}
        </Text>
        {status}
      </Stack>
      <Stack className="gss-company-identity-meta" gap="xs" mt="md">
        <CompanyMeta icon={<IconPhone size={15} />} value={company.phone ?? company.email ?? "-"} />
        <CompanyMeta icon={<IconMapPin size={15} />} value={company.address ?? "-"} />
      </Stack>
      <Group className="gss-company-identity-open" gap="xs" justify="space-between" mt="auto">
        <Text fw={700} size="sm">
          {t("organizations.openCompany")}
        </Text>
        <IconArrowUpRight size={18} />
      </Group>
    </Card>
  );
}

function CompanyCardLogo({ company }: { company: CompanyRecord }) {
  const logo = useAuthenticatedLogo(`/admin/companies/${company.id}/logo`, company.hasLogo);
  return (
    <Box className="gss-company-identity-logo">
      {logo.status === "loading" ? (
        <Skeleton height="100%" radius="md" width="100%" />
      ) : logo.logoUrl ? (
        <img alt={company.name} src={logo.logoUrl} />
      ) : (
        <Avatar color="gss" radius="md" size="100%">
          {initials(company.name)}
        </Avatar>
      )}
    </Box>
  );
}

function CompanyMeta({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <ThemeIcon color="gray" size="sm" variant="light">
        {icon}
      </ThemeIcon>
      <Text c="dimmed" lineClamp={1} size="sm" title={value}>
        {value}
      </Text>
    </Group>
  );
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || <IconBuildingCommunity size={24} />
  );
}
