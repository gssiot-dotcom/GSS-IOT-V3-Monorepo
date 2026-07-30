import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "./styles/global.css";

import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { LocaleProvider, useI18n } from "./app/i18n";

function LocalizedApplication() {
  // Subscribing at the application boundary refreshes legacy typed `t()` consumers without
  // remounting the router, authentication provider, route or Mantine color-scheme state.
  useI18n();
  return (
    <MantineProvider defaultColorScheme="auto" theme={gssTheme}>
      <App />
    </MantineProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LocaleProvider>
      <LocalizedApplication />
    </LocaleProvider>
  </React.StrictMode>,
);
