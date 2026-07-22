import { createTheme, rem, type MantineColorsTuple } from "@mantine/core";

export const gssBlue: MantineColorsTuple = [
  "#e8f7fd",
  "#d2effa",
  "#a7dff5",
  "#78ceef",
  "#48bdea",
  "#159fde",
  "#0b80b7",
  "#08648f",
  "#064c6d",
  "#03344a",
];

export const gssStatusColors = {
  caution: "#2fa84f",
  danger: "#dc2626",
  offline: "#7c8797",
  safe: "#0b80b7",
  unconfigured: "#64748b",
  warning: "#d18a00",
} as const;

export const gssSemanticTokens = {
  background: { light: "#f5f8fb", dark: "#0d1524" },
  border: { light: "#d8e0e8", dark: "#263449" },
  danger: { light: "#dc2626", dark: "#f87171" },
  foreground: { light: "#172033", dark: "#eef5fb" },
  muted: { light: "#64748b", dark: "#9aaac0" },
  surface: { light: "#ffffff", dark: "#131e30" },
} as const;

export const gssLayoutTokens = {
  controlHeight: { compact: rem(32), default: rem(38), comfortable: rem(42) },
  radius: { card: rem(12), control: rem(8), pill: rem(999) },
  sectionGap: rem(20),
  shadow: {
    card: "0 1px 2px rgb(15 23 42 / 0.04)",
    elevated: "0 12px 30px rgb(15 23 42 / 0.08)",
  },
} as const;

export const gssTypographyScale = {
  body: rem(14),
  caption: rem(12),
  cardTitle: rem(16),
  pageTitle: rem(30),
  sectionTitle: rem(20),
} as const;

export const gssTheme = createTheme({
  black: "#172033",
  colors: {
    gss: gssBlue,
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
    },
    Card: {
      defaultProps: {
        padding: "md",
        radius: "md",
        withBorder: true,
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
