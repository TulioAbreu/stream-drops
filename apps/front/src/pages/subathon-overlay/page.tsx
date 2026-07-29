import { useEffect } from "react";
import { SubathonOverlayView } from "./subathon-overlay-view";
import "./overlay.css";

export function SubathonOverlayPage() {
  useEffect(() => {
    document.documentElement.classList.add("subathon-overlay-route");

    return () => {
      document.documentElement.classList.remove("subathon-overlay-route");
    };
  }, []);

  return <SubathonOverlayView />;
}
