import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='location'][callee.property.name='reload']",
          message: "Use router.refresh() from next/navigation instead of location.reload().",
        },
        {
          selector: "CallExpression[callee.object.property.name='location'][callee.property.name='reload']",
          message: "Use router.refresh() from next/navigation instead of window.location.reload().",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/prisma/**",
    "tmp/**",
  ]),
]);

export default eslintConfig;
