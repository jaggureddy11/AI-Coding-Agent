# JAGGU VS Code Extension — Marketplace Release Checklist

This pre-flight checklist outlines the required steps for releasing `jaggu-vscode` to the Visual Studio Marketplace and Open VSX Registry.

---

## 1. Technical Pre-Flight Verification

- [x] **Standalone Bundling**: Extension is bundled with `esbuild` to CommonJS (`dist/extension.js`), with `@jaggu/core` inlined.
- [x] **Dynamic Ripgrep**: Dynamic resolution implemented with fallback to memory scanner if binary is not present.
- [x] **No Monorepo Dependencies**: Zero runtime dependencies on root or monorepo workspace packages.
- [x] **Package Size Optimization**: VSIX archive is ~440 KB, strictly filtered by `.vscodeignore`.
- [x] **Automated Tests**: 100% pass (31/31 suites, 189/189 tests).
- [x] **TypeScript Typecheck**: Zero errors across all workspaces (`tsc --noEmit`).
- [x] **Lint Quality**: Zero errors, zero warnings (`eslint`).
- [x] **Clean Installation**: Successfully installed via `code --install-extension` in a clean environment.
- [x] **Packaged Runtime Validation**: Clean-room harness verified all 12 operational checkpoints.
- [x] **Security Review**: No hardcoded API keys; all secrets stored in VS Code `SecretStorage`.

---

## 2. Extension Metadata & Manifest Audit

- [x] **Publisher Name**: `"publisher": "jaggu"`
- [x] **Display Name**: `"displayName": "JAGGU — Developer-Controlled AI Coding Agent"`
- [x] **Description**: Concise, accurate value proposition without inflated claims.
- [x] **Categories**: `["Programming Languages", "Machine Learning", "Other"]`
- [x] **Keywords**: Relevant search tags included (`ai`, `coding-agent`, `code-review`, `developer-tools`, `diff-preview`, `git-checkpoints`).
- [x] **Icon**: 128x128 PNG image (`media/icon.png`) with crisp branding.
- [x] **License**: MIT License in root and package (`LICENSE.txt`).
- [x] **Repository Links**: Correct GitHub repository, issue tracker, and homepage specified.
- [x] **Command Parity**: All 8 contributed commands match registration in `src/extension.ts`.

---

## 3. Marketplace Submission Steps (Manual)

### Step 3.1: Verify Marketplace Publisher
1. Visit [Visual Studio Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. Sign in with your Microsoft / Azure DevOps account.
3. If you have not created the publisher `jaggu`, create it now or rename the `"publisher"` field in `packages/jaggu-vscode/package.json` to match your registered publisher ID.

### Step 3.2: Generate Azure DevOps Personal Access Token (PAT)
1. Go to [Azure DevOps Personal Access Tokens](https://dev.azure.com/).
2. Select **New Token**.
3. Set Organization to **All accessible organizations**.
4. In Scopes, select **Custom defined**, scroll to **Marketplace**, and select **Acquisition** and **Publish**.
5. Copy the generated token securely.

### Step 3.3: Option A — Publish via CLI
Run the following command in terminal:
```bash
npx @vscode/vsce publish \
  --packagePath packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix \
  --pat <YOUR_PERSONAL_ACCESS_TOKEN>
```

### Step 3.4: Option B — Publish via Web Portal (Recommended for First Release)
1. Open [Visual Studio Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. Click **+ New extension** > **Visual Studio Code**.
3. Drag and drop `packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix`.
4. Wait for automated verification (usually takes 2-5 minutes).
5. Verify the extension page renders formatting, icon, and badges correctly.

---

## 4. Open VSX Registry (Optional / Supplementary)

To make JAGGU available to VSCodium, Gitpod, and Eclipse Theia users:
1. Create an account at [Open VSX](https://open-vsx.org/).
2. Generate an Access Token in your Open VSX settings.
3. Publish using `ovsx`:
```bash
npx ovsx publish packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix -p <OPEN_VSX_ACCESS_TOKEN>
```

---

## 5. Post-Release Verification

- [ ] Install from Marketplace search inside VS Code: `ext install jaggu.jaggu-vscode`.
- [ ] Verify Webview renders with chat UI.
- [ ] Connect Ollama / OpenAI / Hugging Face model and run a test coding task.
- [ ] Confirm plan approval, file diff inspection, and test execution work as expected.
