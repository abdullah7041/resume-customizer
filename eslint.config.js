// eslint.config.js
import js from "@eslint/js";
import parserTs from "@typescript-eslint/parser";
import pluginTs from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  { ignores: ["node_modules/**", "dist/**", "build/**", "public/**", ".netlify/**", ".claude/worktrees/**", "**/*.d.ts", "tailwind.config.*", "USAGE_EXAMPLES.tsx"] },

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
      "no-unused-vars": ["warn", { "args": "none", "varsIgnorePattern": "^_" }],
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

  // Theming guardrail: block *neutral* inline dark: colors and arbitrary hex.
  // Use semantic token utilities instead (bg-surface, text-ink, text-ink-muted,
  // border-line, bg-ink/10) - see .claude/skills/fix-light-dark-mode.
  // Scoped to already-migrated files; widen this glob as more files move to tokens.
  {
    files: [
      "src/components/analysis/Vision2030Score.tsx",
      "src/components/compliance/UserDataRights.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/dark:[a-z:-]*(bg|text|border|ring|from|via|to|divide|placeholder|shadow|outline|fill|stroke)-(white|black|gray|slate|zinc|neutral|stone)/]",
          message:
            "Neutral inline dark: color. Use a semantic token utility (bg-surface, text-ink, text-ink-muted, border-line, bg-ink/10) - see .claude/skills/fix-light-dark-mode.",
        },
        {
          selector: "Literal[value=/dark:[a-z:-]*\\[#/]",
          message:
            "Arbitrary hex under dark:. Use a semantic token utility (bg-surface, text-ink, border-line) - see .claude/skills/fix-light-dark-mode.",
        },
        {
          selector:
            "TemplateElement[value.cooked=/dark:[a-z:-]*(bg|text|border|ring|from|via|to|divide|placeholder|shadow|outline|fill|stroke)-(white|black|gray|slate|zinc|neutral|stone)/]",
          message:
            "Neutral inline dark: color. Use a semantic token utility (bg-surface, text-ink, text-ink-muted, border-line, bg-ink/10) - see .claude/skills/fix-light-dark-mode.",
        },
        {
          selector: "TemplateElement[value.cooked=/dark:[a-z:-]*\\[#/]",
          message:
            "Arbitrary hex under dark:. Use a semantic token utility (bg-surface, text-ink, border-line) - see .claude/skills/fix-light-dark-mode.",
        },
      ],
    },
  },
];
