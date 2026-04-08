# Sandpack-Embedded Demo Pages

## Context

The tw-squircle plugin needs demo pages showing different ways to use it: different plugin options, integration methods (CSS-only vs JS plugin), and frameworks (React, Vue, Svelte, vanilla). These demos must:

- Live in this monorepo (no external code maintenance)
- Be editable by visitors in-browser
- Work cross-browser (Chrome, Firefox, Safari)
- Deploy to GitHub Pages alongside the existing site
- Use the latest published `@klinking/tw-squircle` from npm

After evaluating 7 approaches (iframes, StackBlitz, Shadow DOM, Astro multi-CSS, Storybook, monorepo sub-builds, Astro Islands), **Sandpack** (by CodeSandbox) was chosen because it requires no special HTTP headers, works cross-browser, and provides live editing — all on GitHub Pages.

## Architecture

### Overview

```
website/
  examples/                      # Example projects (inside website for Vite fs access)
    react-basic/
      App.tsx
      index.html
      styles.css
      package.json               # @klinking/tw-squircle@latest
  src/
    components/
      DemoEmbed.tsx              # Sandpack wrapper component
      Layout.astro               # Shared site shell
    pages/
      index.astro                # Existing main page
      demos/
        index.astro              # Demo listing page
        react-basic.astro        # First demo page
```

Examples live inside `website/` to stay within Vite's project root, avoiding `server.fs.allow` issues.

Each demo page is an Astro page that:
1. Renders inside the unified site shell (shared header/nav)
2. Embeds a `<Sandpack>` React component with `client:load`
3. Loads example files from `website/examples/{name}/` at build time via Vite's `?raw` import

### File Loading

Example files are imported at build time using Vite's `?raw` suffix, then passed to Sandpack's `files` prop:

```tsx
// website/src/components/DemoEmbed.tsx
import { Sandpack } from "@codesandbox/sandpack-react";

interface DemoEmbedProps {
  files: Record<string, string>;
  dependencies: Record<string, string>;
  activeFile?: string;   // e.g. "/App.tsx" — which tab is open by default
  template: "react-ts" | "vue-ts" | "vanilla-ts" | "svelte";
}

export default function DemoEmbed({ files, dependencies, activeFile, template }: DemoEmbedProps) {
  return (
    <Sandpack
      template={template}
      files={files}
      customSetup={{ dependencies }}
      options={{
        showNavigator: false,
        showTabs: true,
        showOpenInCodeSandbox: true,
        editorHeight: 500,
        activeFile,
      }}
      theme="dark"
    />
  );
}
```

In the Astro page:

```astro
---
import appCode from "../../examples/react-basic/App.tsx?raw";
import stylesCode from "../../examples/react-basic/styles.css?raw";
import pkg from "../../examples/react-basic/package.json";
import DemoEmbed from "../../components/DemoEmbed";
---

<DemoEmbed
  client:load
  files={{
    "/App.tsx": appCode,
    "/styles.css": stylesCode,
  }}
  dependencies={pkg.dependencies}
  activeFile="/App.tsx"
  template="react-ts"
/>
```

### Example Project Structure (react-basic)

The first demo: React app using the CSS-only integration method (`squircle.css` import).

```
website/examples/react-basic/
  App.tsx          # Simple React component showing squircle utilities
  styles.css       # @import "@klinking/tw-squircle/squircle.css" + Tailwind
  package.json     # { "dependencies": { "@klinking/tw-squircle": "latest", "react": "^19", "react-dom": "^19", "tailwindcss": "^4" } }
```

The `package.json` is imported at build time (Vite handles JSON imports natively) to extract the `dependencies` map for Sandpack's `customSetup.dependencies`.

### "Open in CodeSandbox" Escape Hatch

Enabled via `showOpenInCodeSandbox: true` in Sandpack options. This adds a button in the Sandpack toolbar that opens the current sandbox state (including any user edits) in CodeSandbox's full IDE.

### Page Layout

Each demo page follows this structure:

```
+--------------------------------------------------+
| @klinking/tw-squircle        [Home] [Demos] [GH] |  <- shared nav
+--------------------------------------------------+
| Demo: React + CSS-only Integration                |
|                                                   |
| Brief description of what this demo shows and     |
| which integration method it uses.                 |
|                                                   |
| +-----------------------------------------------+ |
| | [App.tsx] [styles.css]          [Open in CSB]  | |
| |-----------------------------------------------|  |
| |  Editor (left)    |    Preview (right)        | |
| |                   |                           | |
| |                   |                           | |
| |                   |                           | |
| +-----------------------------------------------+ |
|                                                   |
| <- Back to demos                                  |
+--------------------------------------------------+
```

### Shared Navigation

Extract the current header from `index.astro` into a reusable `Layout.astro` component. Both the main page and demo pages use this layout. The nav adds a "Demos" link.

### Dependencies to Add

- `@codesandbox/sandpack-react@^2` in `website/package.json`

### Runtime Requirements

- Sandpack fetches npm packages from external CodeSandbox infrastructure at runtime:
  - `sandpack-cdn-v2.codesandbox.io` (npm module resolution)
  - `*.csb.app` (sandbox preview iframe)
  - `codesandbox.io` (Open in CodeSandbox feature)
- No special HTTP headers (COEP/COOP) needed on the host
- Works on GitHub Pages as-is

### Error Handling

Wrap `DemoEmbed` usage in a client-side error boundary. If Sandpack fails to load (network error, CDN down), show a fallback message with a link to the example source on GitHub.

### GitHub Pages Base Path

If the site deploys to `https://<user>.github.io/tw-squircle/`, `astro.config.mjs` needs `base: '/tw-squircle/'`. Demo page links should use relative paths or respect the configured base. This may already be handled; verify during implementation.

## Scope: First Demo Only

Start with a single demo (`react-basic`) to validate the pattern:
- React + CSS-only integration (importing `squircle.css`)
- Shows basic squircle utilities in use
- Editable in browser

Future demos (added incrementally):
- `react-plugin` — JS plugin registration method
- `vue-basic` — Vue integration
- `vanilla` — Plain HTML + Tailwind CDN
- `custom-options` — Custom prefix, CSS variable names
- `tailwind-merge` — Using `squircleMergeConfig`

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `website/examples/react-basic/App.tsx` |
| Create | `website/examples/react-basic/styles.css` |
| Create | `website/examples/react-basic/package.json` |
| Create | `website/src/components/DemoEmbed.tsx` |
| Create | `website/src/components/Layout.astro` |
| Create | `website/src/pages/demos/index.astro` |
| Create | `website/src/pages/demos/react-basic.astro` |
| Modify | `website/src/pages/index.astro` — use Layout.astro |
| Modify | `website/package.json` — add `@codesandbox/sandpack-react@^2` |

## Verification

1. `pnpm install` in website — sandpack dependency resolves
2. `pnpm run dev` in website — site starts, navigate to `/demos/react-basic`
3. Sandpack embed loads, shows editor + preview
4. Edit code in editor — preview updates live
5. "Open in CodeSandbox" button works
6. Navigation between main page and demos works
7. `pnpm run build` succeeds — static output includes demo pages
8. Cross-browser: test in Chrome and Firefox at minimum
