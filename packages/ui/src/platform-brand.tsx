export interface GssPlatformBrandProps {
  compact?: boolean;
  colorScheme: "dark" | "light";
  label: string;
  wordmark: string;
}

export function GssPlatformBrand({
  compact = false,
  colorScheme,
  label,
  wordmark,
}: GssPlatformBrandProps) {
  return (
    <span
      className={compact ? "gss-platform-brand gss-platform-brand-compact" : "gss-platform-brand"}
    >
      <img
        alt={label}
        className="gss-platform-logo"
        src={
          colorScheme === "dark"
            ? "/assets/gss-logos/GSS-logo.svg"
            : "/assets/gss-logos/Gss-logo-blue.svg"
        }
      />
      <span aria-hidden="true" className="gss-platform-wordmark">
        {wordmark}
      </span>
    </span>
  );
}
