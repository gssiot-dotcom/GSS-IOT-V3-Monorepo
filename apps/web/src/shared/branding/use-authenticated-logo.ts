import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiBlob } from "../api/api-client";
import { useAuth } from "../auth/auth-context";

export type LogoLoadStatus = "empty" | "error" | "loading" | "ready";

export function useAuthenticatedLogo(path: string, enabled = true) {
  const { session } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string>();
  const [status, setStatus] = useState<LogoLoadStatus>(enabled ? "loading" : "empty");
  const objectUrlRef = useRef<string | undefined>(undefined);

  const clearObjectUrl = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = undefined;
    setLogoUrl(undefined);
  }, []);

  const refreshLogo = useCallback(async () => {
    if (!session) return;
    setStatus("loading");
    try {
      const blob = await apiBlob(session, path, { cache: "no-store" });
      const nextUrl = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = nextUrl;
      setLogoUrl(nextUrl);
      setStatus("ready");
    } catch (error) {
      clearObjectUrl();
      setStatus(error instanceof ApiError && error.status === 404 ? "empty" : "error");
    }
  }, [clearObjectUrl, path, session]);

  useEffect(() => {
    if (enabled) void refreshLogo();
    else {
      clearObjectUrl();
      setStatus("empty");
    }
  }, [clearObjectUrl, enabled, refreshLogo]);

  useEffect(() => () => clearObjectUrl(), [clearObjectUrl]);

  return { logoUrl, refreshLogo, status };
}
