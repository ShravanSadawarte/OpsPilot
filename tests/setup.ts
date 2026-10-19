// Test setup file. Runs before each test file.
import { beforeAll, afterAll, vi } from "vitest";

// Suppress console noise during tests unless a test asserts on it.
const origError = console.error;
const origWarn = console.warn;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (String(args[0]).includes("Warning: ReactDOM.render is deprecated")) return;
    origError.apply(console, args);
  };
  console.warn = (...args: any[]) => {
    origWarn.apply(console, args);
  };
});
afterAll(() => {
  console.error = origError;
  console.warn = origWarn;
});
