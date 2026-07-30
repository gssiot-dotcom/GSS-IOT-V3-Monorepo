import type { BuildingPlanImageRecord } from "@gss-iot/contracts";
import {
  ConfirmActionModal,
  EmptyState,
  EntityActionMenu,
  ErrorState,
  ForbiddenState,
  LoadingState,
  WorkspaceTabs,
} from "@gss-iot/ui";
import {
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Image,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
} from "@mantine/core";
import { IconPhotoPlus, IconTrash } from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";

import { formatDateTime, t, tf } from "../../app/i18n";
import { ApiError, apiBlob, apiMultipartRequest, apiRequest } from "../../shared/api/api-client";
import { useAuth } from "../../shared/auth/auth-context";
import { hasPermission } from "../../shared/rbac/has-permission";

const MAX_IMAGES_PER_KIND = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function BuildingImageManager({
  basePath,
  buildingId,
}: {
  basePath: "/admin" | "/company";
  buildingId: string;
}) {
  const { session } = useAuth();
  const [images, setImages] = useState<BuildingPlanImageRecord[]>();
  const [kind, setKind] = useState<"PLAN" | "REAL">("PLAN");
  const [errorStatus, setErrorStatus] = useState<number>();
  const [uploadOpened, setUploadOpened] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [selectedKind, setSelectedKind] = useState<"PLAN" | "REAL">("PLAN");
  const [selectedDelete, setSelectedDelete] = useState<BuildingPlanImageRecord>();
  const [mutationError, setMutationError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const canManage = hasPermission(session, "building-plans.manage");

  const load = async () => {
    if (!session) return;
    setErrorStatus(undefined);
    try {
      setImages(
        await apiRequest<BuildingPlanImageRecord[]>(
          session,
          `${basePath}/buildings/${buildingId}/images`,
        ),
      );
    } catch (error) {
      setErrorStatus(error instanceof ApiError ? error.status : 500);
    }
  };

  useEffect(() => {
    void load();
  }, [basePath, buildingId, session?.accessToken]);

  const current = useMemo(
    () => (images ?? []).filter((image) => image.kind === kind),
    [images, kind],
  );
  const selectedCount = (images ?? []).filter((image) => image.kind === selectedKind).length;

  const upload = async () => {
    if (!session || !selectedFile) return;
    setMutationError(undefined);
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type) ||
      selectedFile.size > MAX_IMAGE_BYTES
    ) {
      setMutationError(t("buildingImages.invalidFile"));
      return;
    }
    const form = new FormData();
    form.append("image", selectedFile);
    form.append("kind", selectedKind);
    setSaving(true);
    try {
      await apiMultipartRequest(
        session,
        `${basePath}/buildings/${buildingId}/images`,
        form,
        "POST",
      );
      setSelectedFile(undefined);
      setUploadOpened(false);
      setKind(selectedKind);
      await load();
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!session || !selectedDelete) return;
    setMutationError(undefined);
    setSaving(true);
    try {
      await apiRequest(session, `${basePath}/building-images/${selectedDelete.id}`, {
        method: "DELETE",
      });
      setSelectedDelete(undefined);
      await load();
    } catch (error) {
      setMutationError(error instanceof ApiError ? error.message : t("common.errorDescription"));
    } finally {
      setSaving(false);
    }
  };

  if (errorStatus === 403) {
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  }
  if (errorStatus) {
    return <ErrorState description={t("common.errorDescription")} title={t("common.errorTitle")} />;
  }
  if (!images) return <LoadingState title={t("common.loading")} />;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Text fw={700}>{t("buildingImages.title")}</Text>
          <Text c="dimmed" size="sm">
            {t("buildingImages.subtitle")}
          </Text>
        </Stack>
        {canManage ? (
          <Button
            disabled={current.length >= MAX_IMAGES_PER_KIND}
            leftSection={<IconPhotoPlus size={16} />}
            onClick={() => {
              setSelectedKind(kind);
              setSelectedFile(undefined);
              setMutationError(undefined);
              setUploadOpened(true);
            }}
          >
            {t("buildingImages.upload")}
          </Button>
        ) : null}
      </Group>
      <WorkspaceTabs
        ariaLabel={t("buildingImages.kindTabs")}
        items={[
          {
            label: tf("buildingImages.planTab", {
              count: images.filter((image) => image.kind === "PLAN").length,
              max: MAX_IMAGES_PER_KIND,
            }),
            value: "PLAN",
          },
          {
            label: tf("buildingImages.realTab", {
              count: images.filter((image) => image.kind === "REAL").length,
              max: MAX_IMAGES_PER_KIND,
            }),
            value: "REAL",
          },
        ]}
        onChange={(value) => setKind(value as "PLAN" | "REAL")}
        value={kind}
      />
      {mutationError ? (
        <Text c="red" role="alert" size="sm">
          {mutationError}
        </Text>
      ) : null}
      {current.length ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {current.map((image) => (
            <Card key={image.id} p="sm" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Badge variant="light">{image.kind}</Badge>
                  {canManage ? (
                    <EntityActionMenu
                      ariaLabel={t("buildingImages.actions")}
                      items={[
                        {
                          color: "red",
                          destructive: true,
                          icon: <IconTrash size={16} />,
                          key: "delete",
                          label: t("buildingImages.delete"),
                          onClick: () => setSelectedDelete(image),
                        },
                      ]}
                    />
                  ) : null}
                </Group>
                <PrivateBuildingImage image={image} />
                <Text c="dimmed" size="xs">
                  {tf("buildingImages.metadata", {
                    date: formatDateTime(image.createdAt),
                    size: image.byteSize ? Math.ceil(image.byteSize / 1024) : "-",
                  })}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      ) : (
        <EmptyState
          description={t("buildingImages.emptyDescription")}
          title={t("common.emptyTitle")}
        />
      )}

      <Modal
        opened={uploadOpened}
        onClose={() => !saving && setUploadOpened(false)}
        size="lg"
        title={t("buildingImages.uploadTitle")}
      >
        <Stack>
          <Select
            data={[
              { label: t("buildingImages.plan"), value: "PLAN" },
              { label: t("buildingImages.real"), value: "REAL" },
            ]}
            label={t("buildingImages.kind")}
            onChange={(value) => setSelectedKind((value ?? "PLAN") as "PLAN" | "REAL")}
            value={selectedKind}
          />
          <FileButton
            accept="image/png,image/jpeg,image/webp"
            onChange={(file) => setSelectedFile(file ?? undefined)}
          >
            {(props) => (
              <Button {...props} variant="light">
                {selectedFile ? selectedFile.name : t("buildingImages.chooseFile")}
              </Button>
            )}
          </FileButton>
          {selectedFile ? <LocalImagePreview file={selectedFile} /> : null}
          <Text c="dimmed" size="sm">
            {t("buildingImages.uploadHelp")}
          </Text>
          <Group justify="flex-end">
            <Button disabled={saving} onClick={() => setUploadOpened(false)} variant="default">
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!selectedFile || selectedCount >= MAX_IMAGES_PER_KIND}
              loading={saving}
              onClick={() => void upload()}
            >
              {t("buildingImages.upload")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmActionModal
        cancelLabel={t("common.cancel")}
        confirmLabel={t("buildingImages.delete")}
        description={t("buildingImages.deleteDescription")}
        entityName={
          selectedDelete ? `${selectedDelete.kind} #${selectedDelete.orderIndex + 1}` : ""
        }
        loading={saving}
        onClose={() => !saving && setSelectedDelete(undefined)}
        onConfirm={() => void remove()}
        opened={Boolean(selectedDelete)}
        title={t("buildingImages.deleteTitle")}
      />
    </Stack>
  );
}

function PrivateBuildingImage({ image }: { image: BuildingPlanImageRecord }) {
  const { session } = useAuth();
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (!session) return;
    setFailed(false);
    void apiBlob(session, image.contentPath)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
    };
  }, [image.contentPath, session?.accessToken]);

  if (failed)
    return (
      <ErrorState description={t("buildingImages.previewError")} title={t("common.errorTitle")} />
    );
  if (!url) return <LoadingState title={t("common.loading")} />;
  return <Image alt={t("buildingImages.previewAlt")} fit="contain" h={180} radius="md" src={url} />;
}

function LocalImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url ? (
    <Image alt={t("buildingImages.selectedPreviewAlt")} fit="contain" h={220} src={url} />
  ) : null;
}
