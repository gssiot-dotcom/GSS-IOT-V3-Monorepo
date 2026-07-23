import { createTheme, rem, type MantineColorsTuple } from "@mantine/core";

export const gssBlue: MantineColorsTuple = [
  "#eaf6ff",
  "#d7edff",
  "#b8dcff",
  "#8bc5ff",
  "#5eacff",
  "#2f91f1",
  "#176fca",
  "#12579e",
  "#0e4076",
  "#092b52",
];

export const gssCyan: MantineColorsTuple = [
  "#e8fbfc",
  "#d1f5f7",
  "#a5e9ed",
  "#72d9df",
  "#42c8d0",
  "#1db3bd",
  "#128d98",
  "#0e7078",
  "#0a5359",
  "#06373b",
];

export const gssIndigo: MantineColorsTuple = [
  "#eef0ff",
  "#dfe2ff",
  "#c5caff",
  "#a7adff",
  "#858df5",
  "#6670dd",
  "#5059b9",
  "#414898",
  "#343b78",
  "#252b5a",
];

export const gssViolet: MantineColorsTuple = [
  "#f5efff",
  "#eadfff",
  "#d8c4ff",
  "#c1a2ff",
  "#a47df1",
  "#895ce0",
  "#7047b8",
  "#5a3995",
  "#482f76",
  "#332252",
];

export const gssTeal: MantineColorsTuple = [
  "#e7fbf6",
  "#cef5eb",
  "#a1e9d7",
  "#6fd8bf",
  "#43c3a5",
  "#25a98d",
  "#198773",
  "#146b5c",
  "#105044",
  "#0b352e",
];

export const gssStatusColors = {
  caution: "#2fa84f",
  danger: "#dc2626",
  offline: "#7c8797",
  safe: "#1685b8",
  unconfigured: "#64748b",
  warning: "#d18a00",
} as const;

export const gssAccentColors = {
  blue: "gss",
  cyan: "gssCyan",
  indigo: "gssIndigo",
  neutral: "gray",
  teal: "gssTeal",
  violet: "gssViolet",
} as const;

export const gssSemanticTokens = {
  accent: { light: "#176fca", dark: "#5eacff" },
  accentCyan: { light: "#128d98", dark: "#42c8d0" },
  accentIndigo: { light: "#5059b9", dark: "#858df5" },
  accentTeal: { light: "#198773", dark: "#43c3a5" },
  accentViolet: { light: "#7047b8", dark: "#a47df1" },
  acknowledged: { light: "#128d98", dark: "#42c8d0" },
  background: { light: "#f4f7fb", dark: "#0b1424" },
  body: { light: "#26364d", dark: "#d8e4f1" },
  border: { light: "#d7e0eb", dark: "#263a52" },
  caution: { light: "#2fa84f", dark: "#63d477" },
  danger: { light: "#dc2626", dark: "#f87171" },
  disabled: { light: "#9aa8b8", dark: "#66788d" },
  disabledSurface: { light: "#eef2f6", dark: "#1a2d44" },
  elevatedSurface: { light: "#ffffff", dark: "#1b3049" },
  failed: { light: "#dc2626", dark: "#f87171" },
  foreground: { light: "#17263d", dark: "#eef5fb" },
  heading: { light: "#10213a", dark: "#f4f8fd" },
  info: { light: "#176fca", dark: "#5eacff" },
  informational: { light: "#176fca", dark: "#5eacff" },
  interactiveSurface: { light: "#f8fafd", dark: "#1a2e47" },
  hoverSurface: { light: "#f0f7ff", dark: "#1d3855" },
  muted: { light: "#6b7b91", dark: "#91a5bc" },
  nestedSurface: { light: "#f8fafd", dark: "#16253a" },
  offline: { light: "#7c8797", dark: "#a6b3c5" },
  online: { light: "#198773", dark: "#43c3a5" },
  panel: { light: "#ffffff", dark: "#172941" },
  pending: { light: "#5059b9", dark: "#858df5" },
  popoverSurface: { light: "#ffffff", dark: "#1b3049" },
  primary: { light: "#176fca", dark: "#5eacff" },
  selectedSurface: { light: "#e5f1ff", dark: "#20486c" },
  secondaryText: { light: "#4e6179", dark: "#b4c4d6" },
  strongBorder: { light: "#b8c8d9", dark: "#3a536f" },
  subtleBorder: { light: "#e5ebf2", dark: "#1f3148" },
  surface: { light: "#ffffff", dark: "#122137" },
  surfaceTinted: { light: "#f0f7ff", dark: "#152d48" },
  safe: { light: "#1685b8", dark: "#42b7e2" },
  stale: { light: "#b87412", dark: "#f0b94c" },
  tableHover: { light: "#f0f7ff", dark: "#1d3855" },
  tableSelected: { light: "#e5f1ff", dark: "#20486c" },
  tableStripe: { light: "#f8fafd", dark: "#14283e" },
  warning: { light: "#d18a00", dark: "#f2bd48" },
} as const;

export const gssLayoutTokens = {
  controlHeight: { compact: rem(32), default: rem(38), comfortable: rem(42) },
  radius: { card: rem(12), control: rem(8), pill: rem(999) },
  spacing: {
    page: rem(24),
    section: rem(20),
    compact: rem(8),
    control: rem(12),
  },
  sectionGap: rem(20),
  shadow: {
    card: "0 1px 2px rgb(15 23 42 / 0.04)",
    elevated: "0 12px 30px rgb(15 23 42 / 0.08)",
    focus: "0 0 0 3px rgb(47 145 241 / 0.22)",
  },
} as const;

export const gssTypographyScale = {
  body: rem(14),
  caption: rem(12),
  cardTitle: rem(16),
  display: rem(36),
  pageTitle: rem(30),
  sectionTitle: rem(20),
} as const;

export const gssTheme = createTheme({
  black: "#172033",
  colors: {
    gss: gssBlue,
    gssCyan,
    gssIndigo,
    gssTeal,
    gssViolet,
  },
  components: {
    ActionIcon: {
      defaultProps: {
        radius: "md",
        variant: "subtle",
      },
    },
    Badge: {
      defaultProps: {
        radius: "sm",
      },
    },
    Button: {
      defaultProps: {
        radius: "md",
      },
      styles: {
        root: {
          transition:
            "background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
        },
      },
    },
    Card: {
      defaultProps: {
        padding: "md",
        radius: "md",
        withBorder: true,
      },
    },
    Input: {
      styles: {
        input: {
          transition: "border-color 120ms ease, box-shadow 120ms ease",
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: "md",
      },
    },
  },
  cursorType: "pointer",
  defaultRadius: "md",
  fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif",
  other: {
    gssAccentColors,
    gssLayoutTokens,
    gssSemanticTokens,
    gssTypographyScale,
  },
  primaryShade: { dark: 5, light: 6 },
  shadows: {
    md: gssLayoutTokens.shadow.card,
    xl: gssLayoutTokens.shadow.elevated,
  },
  headings: {
    fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif",
    sizes: {
      h1: { fontSize: rem(30), fontWeight: "600", lineHeight: "1.2" },
      h2: { fontSize: rem(22), fontWeight: "600", lineHeight: "1.25" },
      h3: { fontSize: rem(18), fontWeight: "600", lineHeight: "1.3" },
    },
  },
  primaryColor: "gss",
});
