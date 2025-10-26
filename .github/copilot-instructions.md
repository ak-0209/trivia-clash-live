# Copilot Instructions for AI Agents

## Project Overview
- **Type:** Vite + React + TypeScript SPA
- **UI:** shadcn-ui, Tailwind CSS
- **Purpose:** Real-time trivia game ("Trivia Clash Live")

## Key Structure
- `src/pages/`: Top-level pages (e.g., `Game.tsx`, `Host.tsx`, `Lobby.tsx`, `LeaderboardPage.tsx`, `Index.tsx`, `NotFound.tsx`).
- `src/components/`: Shared React components. `ui/` contains shadcn-ui primitives (e.g., `button.tsx`, `dialog.tsx`).
- `src/hooks/`: Custom React hooks (e.g., `use-mobile.tsx`, `use-toast.ts`).
- `src/lib/`: Utility functions (e.g., `utils.ts`).
- `public/`: Static assets (images, favicon, etc.).

## Developer Workflows
- **Install dependencies:** `npm i`
- **Start dev server:** `npm run dev` (Vite, hot reload)
- **Build for production:** `npm run build`
- **Preview production build:** `npm run preview`
- **Lint:** `npm run lint` (uses `eslint.config.js`)
- **Tailwind config:** `tailwind.config.ts`, styles in `src/App.css`, `src/index.css`

## Project Conventions
- **Component structure:**
  - Page components in `src/pages/`.
  - Reusable UI in `src/components/` and `src/components/ui/`.
  - Use shadcn-ui primitives for consistent UI.
- **TypeScript:** Strict typing enforced. Use types/interfaces for props and state.
- **State management:** Local state via React hooks. No global state library detected.
- **Routing:** Likely handled in `src/main.tsx` or a top-level component (check for `react-router` or similar if present).
- **No backend code** in this repo; all logic is client-side.

## Integration & External Services
- **Lovable.dev:** Project is integrated with Lovable for cloud editing and deployment. See [Lovable Project](https://lovable.dev/projects/d47058c6-776c-4f8d-9416-7ded6b6d03d5).
- **Deployment:** Use Lovable's Share → Publish. Custom domains via Lovable settings.

## Examples
- To add a new page: create a file in `src/pages/`, export a React component, and add to the router.
- To add a new UI element: use or extend a component in `src/components/ui/`.
- To add a custom hook: place in `src/hooks/` and follow the naming pattern `use-*.tsx`.

## References
- See `README.md` for setup, editing, and deployment details.
- Tailwind and shadcn-ui usage: see `tailwind.config.ts` and `src/components/ui/`.

---

**For AI agents:**
- Follow the above structure and conventions for new code.
- Prefer using existing UI primitives and hooks.
- Keep all logic client-side; do not add server code.
- Reference the Lovable project for deployment and cloud editing.
