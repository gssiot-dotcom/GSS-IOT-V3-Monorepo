import { createTheme, type MantineColorsTuple } from "@mantine/core";

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

export const gssTheme = createTheme({
  colors: {
    gss: gssBlue,
  },
  defaultRadius: "md",
  primaryColor: "gss",
});
