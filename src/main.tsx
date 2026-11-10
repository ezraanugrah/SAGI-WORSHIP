import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import ProjectorApp from "./projector/ProjectorApp";
import "./style.css";
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
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.hash.startsWith("#/projector") ? <ProjectorApp /> : <App />}
  </React.StrictMode>,
);
