import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import AppRouter from "./AppRouter.jsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import CleanupFailureToastListener from "./components/CleanupFailureToastListener.tsx";
import TinfoilModelSwitchToastListener from "./components/TinfoilModelSwitchToastListener.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { SettingsProvider } from "./hooks/useSettings";

import i18n from "./i18n";
// Self-hosted so it works offline and makes no network call. Schibsted Grotesk
// was commissioned for a news organisation to set text that reporters wrote —
// a face designed around other people's words, which is what Murmur produces.
// Its slightly narrow forms also hold up at the 11px the overlay needs.
import "@fontsource-variable/schibsted-grotesk";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <SettingsProvider>
          <ToastProvider>
            <TinfoilModelSwitchToastListener />
            <CleanupFailureToastListener />
            <AppRouter />
          </ToastProvider>
        </SettingsProvider>
      </I18nextProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

if (import.meta.hot) {
  import.meta.hot.accept();
}
