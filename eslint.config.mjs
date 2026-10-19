import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // TypeScript strict mode + tsc --noEmit is the type-safety gate.
      // `any` at API/data boundaries is unavoidable without exhaustive types.
      "@typescript-eslint/no-explicit-any": "warn",
      // Data-fetching-on-mount is a standard React pattern; flagged as warning.
      "react-hooks/set-state-in-effect": "warn",
      // Empty interfaces used as type aliases are intentional in this codebase.
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
]);

export default eslintConfig;
