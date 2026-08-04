import type { BuildingPlanImageRecord } from "@gss-iot/contracts";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  SessionExpiredState,
  WorkspaceTabs,
} from "@gss-iot/ui";
import { ActionIcon, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconArrowsMaximize, IconMinus, IconRefresh, IconPlus } from "@tabler/icons-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { t, tf } from "../../../app/i18n";
import { ApiError, apiBlob } from "../../../shared/api/api-client";
import { useAuth } from "../../../shared/auth/auth-context";
import { useApiQuery } from "../../../shared/query/api-query";
import { portalQueryKey } from "../../../shared/query/query-keys";
import { hasPermission } from "../../../shared/rbac/has-permission";

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.25;

export interface ImageTransform {
  panX: number;
  panY: number;
  zoom: number;
}

export function clampImageTransform(
  transform: ImageTransform,
  viewport: { height: number; width: number },
  fittedImage: { height: number; width: number },
): ImageTransform {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, transform.zoom));
  const maxPanX = Math.max(0, (fittedImage.width * zoom - viewport.width) / 2);
  const maxPanY = Math.max(0, (fittedImage.height * zoom - viewport.height) / 2);
  return {
    panX: Math.min(maxPanX, Math.max(-maxPanX, transform.panX)),
    panY: Math.min(maxPanY, Math.max(-maxPanY, transform.panY)),
    zoom,
  };
}

export function zoomImageAroundPoint(
  transform: ImageTransform,
  nextZoom: number,
  point: { x: number; y: number },
  viewport: { height: number; width: number },
  fittedImage: { height: number; width: number },
): ImageTransform {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const offsetX = point.x - viewport.width / 2;
  const offsetY = point.y - viewport.height / 2;
  const ratio = zoom / transform.zoom;
  return clampImageTransform(
    {
      panX: offsetX - (offsetX - transform.panX) * ratio,
      panY: offsetY - (offsetY - transform.panY) * ratio,
      zoom,
    },
    viewport,
    fittedImage,
  );
}

export function BuildingImageViewerPanel({
  basePath,
  buildingId,
  kind,
}: {
  basePath: "/admin" | "/company";
  buildingId: string;
  kind: "PLAN" | "REAL";
}) {
  const { session } = useAuth();
  const canView = hasPermission(session, "building-plans.view");
  const [selectedByKind, setSelectedByKind] = useState<Partial<Record<"PLAN" | "REAL", string>>>(
    {},
  );
  const imagesQuery = useApiQuery<BuildingPlanImageRecord[]>(
    session,
    session
      ? portalQueryKey(session, "building-images", buildingId)
      : ["building-images", "anonymous", buildingId],
    `${basePath}/buildings/${buildingId}/images`,
    { enabled: canView },
  );
  const images = imagesQuery.data;
  const status =
    imagesQuery.error instanceof ApiError
      ? imagesQuery.error.status
      : imagesQuery.isError
        ? 500
        : undefined;

  const current = useMemo(
    () => (images ?? []).filter((image) => image.kind === kind),
    [images, kind],
  );
  const selectedId = selectedByKind[kind];
  const selected = current.find((image) => image.id === selectedId) ?? current[0];

  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedByKind((value) => ({ ...value, [kind]: selected.id }));
    }
  }, [kind, selected, selectedId]);

  if (!canView) return null;
  if (status === 401) return <SessionExpiredState title={t("common.sessionExpired")} />;
  if (status === 403)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  if (status)
    return (
      <ErrorState description={t("buildingImages.previewError")} title={t("common.errorTitle")} />
    );
  if (!images) return <LoadingState title={t("common.loading")} />;
  if (!selected)
    return (
      <EmptyState
        description={t(kind === "PLAN" ? "monitoring.noPlanImage" : "monitoring.noRealImage")}
        title={t("common.emptyTitle")}
      />
    );

  return (
    <Stack className="gss-building-viewer-panel" gap="sm">
      {current.length > 1 ? (
        <WorkspaceTabs
          ariaLabel={t("monitoring.imageSelection")}
          items={current.map((image, index) => ({
            label: tf("monitoring.imageNumber", { count: index + 1 }),
            value: image.id,
          }))}
          onChange={(value) => setSelectedByKind((state) => ({ ...state, [kind]: value }))}
          value={selected.id}
        />
      ) : null}
      <PrivateInteractiveImage image={selected} />
    </Stack>
  );
}

function PrivateInteractiveImage({ image }: { image: BuildingPlanImageRecord }) {
  const { session } = useAuth();
  const [url, setUrl] = useState<string>();
  const [status, setStatus] = useState<number>();

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (!session) return;
    setUrl(undefined);
    setStatus(undefined);
    void apiBlob(session, image.contentPath)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error) => active && setStatus(error instanceof ApiError ? error.status : 500));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.contentPath, session?.user.id]);

  if (status === 401) return <SessionExpiredState title={t("common.sessionExpired")} />;
  if (status === 403)
    return (
      <ForbiddenState description={t("common.pageUnavailable")} title={t("common.forbidden")} />
    );
  if (status)
    return (
      <ErrorState description={t("buildingImages.previewError")} title={t("common.errorTitle")} />
    );
  if (!url) return <LoadingState title={t("common.loading")} />;
  return <InteractiveImageViewer key={image.id} src={url} />;
}

export function InteractiveImageViewer({ src }: { src: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    { panX: number; panY: number; pointerId: number; x: number; y: number } | undefined
  >(undefined);
  const [dragging, setDragging] = useState(false);
  const [natural, setNatural] = useState({ height: 0, width: 0 });
  const [viewport, setViewport] = useState({ height: 0, width: 0 });
  const [transform, setTransform] = useState<ImageTransform>({ panX: 0, panY: 0, zoom: 1 });

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const measure = () => setViewport({ height: element.clientHeight, width: element.clientWidth });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitted = useMemo(() => {
    if (!natural.width || !natural.height || !viewport.width || !viewport.height)
      return { height: 0, width: 0 };
    const scale = Math.min(viewport.width / natural.width, viewport.height / natural.height);
    return { height: natural.height * scale, width: natural.width * scale };
  }, [natural, viewport]);

  useEffect(() => {
    setTransform((value) => clampImageTransform(value, viewport, fitted));
  }, [fitted.height, fitted.width, viewport.height, viewport.width]);

  const reset = () => setTransform({ panX: 0, panY: 0, zoom: 1 });
  const zoomAtCenter = (factor: number) =>
    setTransform((value) =>
      zoomImageAroundPoint(
        value,
        value.zoom * factor,
        { x: viewport.width / 2, y: viewport.height / 2 },
        viewport,
        fitted,
      ),
    );
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    setTransform((value) =>
      zoomImageAroundPoint(
        value,
        value.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12),
        point,
        viewport,
        fitted,
      ),
    );
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (transform.zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      panX: transform.panX,
      panY: transform.panY,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setDragging(true);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setTransform(
      clampImageTransform(
        {
          panX: drag.panX + event.clientX - drag.x,
          panY: drag.panY + event.clientY - drag.y,
          zoom: transform.zoom,
        },
        viewport,
        fitted,
      ),
    );
  };
  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    setDragging(false);
  };

  return (
    <Box className="gss-building-image-viewer-shell">
      <Group className="gss-building-image-viewer-controls" gap={6}>
        <ViewerControl
          disabled={transform.zoom >= MAX_ZOOM}
          icon={<IconPlus size={17} />}
          label={t("monitoring.zoomIn")}
          onClick={() => zoomAtCenter(ZOOM_STEP)}
        />
        <ViewerControl
          disabled={transform.zoom <= MIN_ZOOM}
          icon={<IconMinus size={17} />}
          label={t("monitoring.zoomOut")}
          onClick={() => zoomAtCenter(1 / ZOOM_STEP)}
        />
        <ViewerControl
          icon={<IconRefresh size={17} />}
          label={t("monitoring.resetImage")}
          onClick={reset}
        />
        <ViewerControl
          icon={<IconArrowsMaximize size={17} />}
          label={t("monitoring.fitImage")}
          onClick={reset}
        />
        <Text aria-live="polite" c="dimmed" ml={4} size="xs">
          {Math.round(transform.zoom * 100)}%
        </Text>
      </Group>
      <Box
        aria-label={t("monitoring.imageViewer")}
        className="gss-building-image-viewer"
        data-dragging={dragging || undefined}
        onPointerCancel={endPointer}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onWheel={onWheel}
        ref={viewportRef}
        role="img"
      >
        <img
          alt={t("buildingImages.previewAlt")}
          draggable={false}
          onLoad={(event) =>
            setNatural({
              height: event.currentTarget.naturalHeight,
              width: event.currentTarget.naturalWidth,
            })
          }
          src={src}
          style={{
            height: fitted.height,
            left: `calc(50% - ${fitted.width / 2}px + ${transform.panX}px)`,
            top: `calc(50% - ${fitted.height / 2}px + ${transform.panY}px)`,
            transform: `scale(${transform.zoom})`,
            width: fitted.width,
          }}
        />
      </Box>
    </Box>
  );
}

function ViewerControl({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <ActionIcon aria-label={label} disabled={disabled} onClick={onClick} variant="default">
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
