import React from "react";
import { createRoot } from "react-dom/client";
import App from "./src/app/App";
import "./src/styles/app.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
