import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register Service Worker for auto-updates
registerSW({ immediate: true });

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found. Check index.html.");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
