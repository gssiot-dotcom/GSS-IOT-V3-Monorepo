export interface GssPlatformBrandProps {
  compact?: boolean;
  label: string;
}

export function GssPlatformBrand({ compact = false, label }: GssPlatformBrandProps) {
  return (
    <img
      alt={label}
      className={compact ? "gss-platform-logo gss-platform-logo-compact" : "gss-platform-logo"}
      src="/assets/gss-logos/Gss-logo-blue.svg"
    />
  );
}
