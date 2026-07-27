import { ConfirmActionModal } from "@gss-iot/ui";
import {
  Alert,
  Button,
  FileButton,
  Group,
  Paper,
  Progress,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { IconBuilding, IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

import { t, tf } from "../../app/i18n";
import type { LogoLoadStatus } from "./use-authenticated-logo";

const maxLogoBytes = 2 * 1024 * 1024;
const acceptedLogoTypes = ["image/jpeg", "image/png", "image/webp"];

export interface CompanyLogoEditorProps {
  canManage: boolean;
  companyName: string;
  logoUrl?: string;
  onRemove: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  status: LogoLoadStatus;
}

export function CompanyLogoEditor({
  canManage,
  companyName,
  logoUrl,
  onRemove,
  onUpload,
  status,
}: CompanyLogoEditorProps) {
  const resetFileRef = useRef<() => void>(null);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [selectedUrl, setSelectedUrl] = useState<string>();
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  useEffect(() => {
    if (!selectedFile) {
      setSelectedUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setSelectedUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const chooseFile = (file: File | null) => {
    setError(undefined);
    setSuccess(undefined);
    if (!file) return;
    if (!acceptedLogoTypes.includes(file.type) || file.size === 0 || file.size > maxLogoBytes) {
      setSelectedFile(undefined);
      resetFileRef.current?.();
      setError(t("branding.logoFileInvalid"));
      return;
    }
    setSelectedFile(file);
  };

  const cancelSelection = () => {
    setSelectedFile(undefined);
    resetFileRef.current?.();
    setError(undefined);
  };

  const upload = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await onUpload(selectedFile);
      cancelSelection();
      setSuccess(t("branding.logoSaved"));
    } catch {
      setError(t("branding.logoActionFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setIsSaving(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      await onRemove();
      setConfirmRemoveOpen(false);
      setSuccess(t("branding.logoRemoved"));
    } catch {
      setError(t("branding.logoActionFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const previewUrl = selectedUrl ?? logoUrl;
  const hasCurrentLogo = status === "ready" && Boolean(logoUrl);

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text fw={700}>{t("branding.companyLogo")}</Text>
        <Text c="dimmed" size="sm">
          {canManage ? t("branding.logoHelp") : t("branding.logoReadonly")}
        </Text>
      </Stack>
      {success ? <Alert color="green">{success}</Alert> : null}
      {error ? <Alert color="red">{error}</Alert> : null}
      <Paper className="gss-company-logo-editor-preview" p="md" withBorder>
        {status === "loading" && !selectedUrl ? (
          <Skeleton height={96} radius="md" width={160} />
        ) : previewUrl ? (
          <img
            alt={tf("branding.logoAlt", { company: companyName })}
            className="gss-company-logo-image"
            src={previewUrl}
          />
        ) : (
          <Stack align="center" gap={6}>
            <IconBuilding aria-hidden="true" color="var(--mantine-color-dimmed)" size={38} />
            <Text c="dimmed" fw={700} size="sm">
              {initials(companyName)}
            </Text>
          </Stack>
        )}
      </Paper>
      {selectedFile ? (
        <Group justify="space-between" wrap="wrap">
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fw={600} lineClamp={1} size="sm">
              {selectedFile.name}
            </Text>
            <Text c="dimmed" size="xs">
              {tf("branding.logoSelectedSize", { size: Math.ceil(selectedFile.size / 1024) })}
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              disabled={isSaving}
              leftSection={<IconX size={16} />}
              onClick={cancelSelection}
              variant="default"
            >
              {t("common.cancel")}
            </Button>
            <Button
              leftSection={<IconUpload size={16} />}
              loading={isSaving}
              onClick={() => void upload()}
            >
              {t("branding.logoUpload")}
            </Button>
          </Group>
        </Group>
      ) : canManage ? (
        <Group justify="space-between" wrap="wrap">
          <FileButton
            accept={acceptedLogoTypes.join(",")}
            onChange={chooseFile}
            resetRef={resetFileRef}
          >
            {(props) => (
              <Button leftSection={<IconPhoto size={16} />} variant="default" {...props}>
                {hasCurrentLogo ? t("branding.logoReplace") : t("branding.logoChoose")}
              </Button>
            )}
          </FileButton>
          {hasCurrentLogo ? (
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => setConfirmRemoveOpen(true)}
              variant="subtle"
            >
              {t("branding.logoRemove")}
            </Button>
          ) : null}
        </Group>
      ) : null}
      {isSaving ? <Progress animated aria-label={t("branding.logoProgress")} value={100} /> : null}
      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("branding.logoRemove")}
        description={t("branding.logoRemoveDescription")}
        entityName={companyName}
        loading={isSaving}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={() => void remove()}
        opened={confirmRemoveOpen}
        title={t("branding.logoRemoveTitle")}
      />
    </Stack>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || t("branding.fallbackInitials")
  );
}
