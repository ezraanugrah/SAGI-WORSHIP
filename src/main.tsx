import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import ProjectorApp from "./projector/ProjectorApp";
import "./style.css";
// Lyric fonts bundled for offline use (see presentation/fonts.ts).
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-ext-400.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-ext-700.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-ext-400.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-ext-700.css";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/bebas-neue/latin-ext-400.css";
const updateSW = registerSW({
  onOfflineReady() {
    window.dispatchEvent(new Event("sagi-offline-ready"));
  },
  onNeedRefresh() {
    // detail: activates the waiting version and reloads this window.
    window.dispatchEvent(
      new CustomEvent("sagi-update-ready", { detail: () => updateSW(true) }),
    );
  },
  onRegisteredSW(_url, registration) {
    // Operators keep SAGI open for hours: look for a new version every hour.
    if (registration)
      setInterval(
        () => {
          if (navigator.onLine) void registration.update().catch(() => {});
        },
        60 * 60 * 1000,
      );
  },
  onRegisterError() {
    window.dispatchEvent(new Event("sagi-offline-error"));
  },
});
// A newer version took control of this page (it keeps running the old code
// until it is reloaded): offer a reload instead of reloading by itself.
if ("serviceWorker" in navigator) {
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled)
      window.dispatchEvent(
        new CustomEvent("sagi-update-ready", {
          detail: async () => location.reload(),
        }),
      );
    controlled = true;
  });
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.hash.startsWith("#/projector") ? <ProjectorApp /> : <App />}
  </React.StrictMode>,
);
