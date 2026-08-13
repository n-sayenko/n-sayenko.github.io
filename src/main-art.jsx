import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Shell from "./components/Shell";
import Art from "./pages/Art";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Shell>
      <Art />
    </Shell>
  </StrictMode>,
);
