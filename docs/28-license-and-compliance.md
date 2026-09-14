# 28 — License, Compliance & Intellectual Property Review

## 1. Legal Review Disclaimer

*This document provides technical analysis of open-source software licenses and ecosystem guidelines for engineering planning purposes. It does not constitute formal legal counsel. Prior to commercial public distribution or trademark registration, formal legal review by qualified IP counsel is recommended.*

---

## 2. VS Code Source Code Licensing (`Code - OSS`)

### 2.1 Upstream Source Code: The MIT License
The open-source repository of Visual Studio Code (`microsoft/vscode`) is licensed under the permissive **MIT License**:
```
The MIT License (MIT)
Copyright (c) 2015 - present Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```
- **Permissions**: Commercial use, modification, distribution, sublicensing, private use.
- **Conditions**: The original copyright notice and MIT permission notice must be preserved in all copies or substantial portions of the Software.

### 2.2 Microsoft Proprietary Product Distinctions & Trademarks
A critical legal and brand distinction exists between the **Code - OSS** open-source repository and the **Microsoft Visual Studio Code** branded product:
1. **Trademarks**: The name *"Visual Studio"*, *"Visual Studio Code"*, the VS Code logo (ribbon icon), and related brand marks are protected trademarks of Microsoft Corporation.
   - **Compliance Rule**: JAGGU shall NEVER use Microsoft trademarks, official VS Code ribbon logos, or imply official Microsoft affiliation or endorsement.
2. **Proprietary Marketplace Restrictions**: Microsoft's official Visual Studio Marketplace terms restrict access exclusively to official Microsoft products.
   - **Compliance Rule**: If JAGGU distributes a custom editor binary (Ring 1), it must configure Open VSX (`open-vsx.org`) rather than Microsoft's proprietary marketplace endpoints (`marketplace.visualstudio.com`), following the precedent of VSCodium and Eclipse Theia.

---

## 3. Dependency & Third-Party Package Auditing

All dependencies introduced into JAGGU must adhere to permissive open-source licenses:

| Package / Tool | Upstream License | Commercial Use | Compliance Requirement |
|---|---|---|---|
| **VS Code Extension API (`@types/vscode`)** | MIT | Permitted | Standard MIT attribution. |
| **Ripgrep (`@vscode/ripgrep`)** | MIT / Unlicense | Permitted | Include BurntSushi / Ripgrep copyright notices. |
| **React 18 & React DOM** | MIT | Permitted | Standard MIT attribution. |
| **Tailwind CSS** | MIT | Permitted | Standard MIT attribution. |
| **Zod Schema Validator** | MIT | Permitted | Standard MIT attribution. |
| **Node PTY (`node-pty`)** | MIT | Permitted | Standard MIT attribution. |
| **Anthropic / OpenAI / Gemini SDKs** | MIT / Apache 2.0 | Permitted | Standard notice preservation. |

**Strictly Banned Licenses**:
- **GPL v3 / AGPL v3**: Strictly prohibited from inclusion in core packages to prevent copyleft viral licensing encumbrance.
- **SSPL (Server Side Public License)**: Prohibited.

---

## 4. Third-Party AI Model Provider Compliance & Terms of Service

JAGGU connects to third-party model providers via user-supplied API keys (BYOK). Compliance with provider Terms of Service (ToS) must be maintained:
1. **Anthropic Commercial Terms**: Enterprise API inputs/outputs are not used for model training. Prompts must conform to usage policies (no malware generation, no unauthorized offensive exploitation).
2. **OpenAI API Terms**: Code submitted via standard API endpoints is not used to train models (unlike consumer ChatGPT).
3. **Google Gemini API Terms**: Paid tier Gemini API guarantees confidentiality and excludes user data from foundational training.
4. **Data Privacy Disclosure**: JAGGU must provide a clear in-product privacy disclosure informing the user:
   *"JAGGU transmits code snippets strictly to your chosen AI provider (Anthropic, OpenAI, Google, or local Ollama) to fulfill your requests. JAGGU operates zero intermediate proxy servers."*
