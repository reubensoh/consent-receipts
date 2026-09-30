import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "./lib/wallets.js";
import App from "./App.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
);
