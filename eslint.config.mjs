import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/",
      "**/out/",
      "**/node_modules/",
      "coverage/",
      "*.config.ts",
      "**/*.config.mjs",
      "example-extension.ts",
      // Obsidian plugin build artifact (gitignored but present locally after build)
      "packages/obsidian-plugin/main.js",
      // Claude Code session files
      ".claude/",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
