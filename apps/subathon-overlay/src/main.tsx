import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SubathonOverlayView } from "../../front/src/pages/subathon-overlay/subathon-overlay-view";
import "../../front/src/pages/subathon-overlay/overlay.css";
import "./index.css";

document.documentElement.classList.add("subathon-overlay-route");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SubathonOverlayView />
  </StrictMode>,
);
