# Marketplace Release Checklist — Version 2.0.0

- [x] Extension metadata complete in `package.json` (name, displayName, description, publisher, version 2.0.0, categories, keywords, icons, license).
- [x] All commands defined in `package.json` have corresponding handlers in `extension.ts`.
- [x] Safe configuration defaults established (`jaggu.modelMode = "auto"`, `jaggu.allowPaidFallbackInAuto = false`).
- [x] Antigravity-style floating input bar, clean model selector, dragging responsiveness, and live voice typing verified.
- [x] Zero-slop streaming with preamble cleanup, native "Insert at Cursor" action, and multi-session isolated histories verified.
- [x] Zero hardcoded secrets in repository (all secrets managed via VS Code SecretStorage / environment).
- [x] Typecheck (`npm run typecheck`) passes with 0 errors across all 5 monorepo workspaces.
- [x] Linter (`npm run lint`) passes with 0 errors and 0 warnings.
- [x] Test suite (`npm test`) passes 100% across all workspaces.
- [x] VSIX package generated with `vsce package` containing strictly runtime assets (`jaggu-vscode-2.0.0.vsix`).
- [x] User-facing documentation, README, and CHANGELOG updated for v2.0.0.
- [x] Clean runtime installation validated.
