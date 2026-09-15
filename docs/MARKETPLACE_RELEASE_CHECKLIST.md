# Marketplace Release Checklist

- [x] Extension metadata complete in `package.json` (name, displayName, description, publisher, version 0.1.0, categories, keywords, icons, license).
- [x] All commands defined in `package.json` have corresponding handlers in `extension.ts`.
- [x] Safe configuration defaults established (`jaggu.model = "auto"`, `jaggu.allowPaidFallbackInAuto = false`).
- [x] Zero hardcoded secrets in repository.
- [x] Typecheck (`npm run typecheck`) passes with 0 errors across all 4 monorepo workspaces.
- [x] Linter (`npm run lint`) passes with 0 errors and 0 warnings.
- [x] Test suite (`npm test`) passes 100% (34 suites, 233 tests).
- [x] VSIX package generated with `vsce package` containing strictly runtime assets (536.5 KB, 12 files).
- [x] User-facing documentation and README updated.
- [x] Clean installation validated.
