import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver para jsdom
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock as any;

// Polyfill requestAnimationFrame
global.requestAnimationFrame = (cb: FrameRequestCallback) =>
  setTimeout(cb, 0) as unknown as number;
global.cancelAnimationFrame = (id: number) => clearTimeout(id);
