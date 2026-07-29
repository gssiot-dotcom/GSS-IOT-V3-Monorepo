import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "./styles/global.css";

import { MantineProvider } from "@mantine/core";
import { gssTheme } from "@gss-iot/ui";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto" theme={gssTheme}>
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
