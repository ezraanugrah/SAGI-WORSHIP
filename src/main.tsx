import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import ProjectorApp from "./projector/ProjectorApp";
import "./style.css";
registerSW({
  onOfflineReady() {
    window.dispatchEvent(new Event("sagi-offline-ready"));
  },
  onNeedRefresh() {
    window.dispatchEvent(new Event("sagi-update-ready"));
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
