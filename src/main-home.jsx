import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Shell from "./components/Shell";
import Home from "./pages/Home";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Shell>
      <Home />
    </Shell>
  </StrictMode>,
);
