// eslint.config.js
import js from "@eslint/js";
import parserTs from "@typescript-eslint/parser";
import pluginTs from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import vitest from "eslint-plugin-vitest";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  { ignores: ["node_modules/**","dist/**","build/**","public/**",".netlify/**","**/*.d.ts","tailwind.config.*"] },

  js.configs.recommended,

  {
    files: ["**/*.{js,jsx,ts,tsx,mjs}"],
    languageOptions: {
      parser: parserTs,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "@typescript-eslint": pluginTs,
      "react-hooks": reactHooks,
      vitest,
    },
    rules: {
      "no-unused-vars": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-empty": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.test.{js,jsx,ts,tsx}"],
    languageOptions: { globals: vitest.environments.env.globals },
  },
];
