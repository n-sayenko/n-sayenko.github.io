import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Shell from "./components/Shell";
import Projects from "./pages/Projects";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Shell>
      <Projects />
    </Shell>
  </StrictMode>,
);
