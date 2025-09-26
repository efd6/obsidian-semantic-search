// eslint.config.js - ESLint 9+ Flat Config
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import promise from "eslint-plugin-promise";
import importPlugin from "eslint-plugin-import";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import nodePlugin from "eslint-plugin-n";

export default tseslint.config(
  // Ignore patterns
  {
    ignores: ["*.js", "*.d.ts", "build/**", "dist/**", "node_modules/**"],
  },

  // Base JavaScript rules
  js.configs.recommended,

  // TypeScript configuration
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Core configuration with plugins
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      unicorn,
      promise,
      import: importPlugin,
      "eslint-comments": eslintComments,
      n: nodePlugin,
    },
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      // Unicorn rules (modern JS practices)
      ...unicorn.configs.recommended.rules,
      "unicorn/filename-case": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/prefer-module": "off",
      "unicorn/no-null": "off", // Allow null for Obsidian API compatibility
      "unicorn/expiring-todo-comments": "off", // Disabled due to ESLint 9+ compatibility issue

      // Promise rules
      ...promise.configs.recommended.rules,
      "promise/prefer-await-to-then": "error",
      "promise/prefer-await-to-callbacks": "error",

      // Import rules
      ...importPlugin.configs.recommended.rules,
      ...importPlugin.configs.typescript.rules,
      "import/no-unresolved": "error",
      "import/no-extraneous-dependencies": [
        "error",
        { devDependencies: ["**/*.test.*", "**/test/**", "**/*.config.*"] },
      ],

      // ESLint comments rules (basic setup)
      "eslint-comments/disable-enable-pair": "error",
      "eslint-comments/no-duplicate-disable": "error",
      "eslint-comments/no-unused-disable": "error",
      "eslint-comments/require-description": "error",

      // Node rules (turn off browser-incompatible rules)
      "n/no-missing-import": "off",
      "n/no-unsupported-features/es-syntax": "off",
      "n/no-unsupported-features/node-builtins": "off",

      // Strengthen async / exception hygiene
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      // Additional strict TypeScript rules (user requested)
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",

      // Code style
      "max-len": ["error", { "code": 120, "ignoreUrls": true, "ignoreStrings": true }],
    },
  },

  // JavaScript files configuration
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },

  // Test files configuration
  {
    files: ["**/*.test.ts", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // Allow any in tests for mocking
      "unicorn/no-null": "off", // Allow null in tests
    },
  },
);