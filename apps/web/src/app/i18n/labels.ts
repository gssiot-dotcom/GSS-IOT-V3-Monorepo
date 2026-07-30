import { hasTranslationKey, t } from "./locale-context";

export function nodeTypeLabel(key: string | null | undefined, fallback: string): string {
  if (!key) return fallback;
  const translationKey = `nodeType.${key}`;
  return hasTranslationKey(translationKey) ? t(translationKey) : fallback;
}
