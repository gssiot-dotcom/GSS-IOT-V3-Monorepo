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
  warning: "#d18a00",
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
