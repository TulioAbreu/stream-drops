import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "./src/index.css";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});
