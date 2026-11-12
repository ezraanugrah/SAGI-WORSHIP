import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import ProjectorApp from "./projector/ProjectorApp";
import "./style.css";
// Lyric fonts bundled for offline use (see presentation/fonts.ts).
// Lyrics are always extra bold (800); Bebas Neue has a single weight.
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-ext-800.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/poppins/latin-ext-800.css";
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
    // Operators keep SAGI open for hours: look for a new version every few
    // minutes and when the window comes back to the front, so every laptop
    // gets it soon (it installs itself when nothing is LIVE, see App).
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) void registration.update().catch(() => {});
    };
    setInterval(check, 5 * 60 * 1000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
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
