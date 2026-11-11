<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- The app is a phone-first prototype: every screen renders inside `PhoneShell` (root layout), and overlays/sheets are absolutely positioned inside the frame instead of Radix portals, so they stay within the device on desktop.
- App state (user profile, current ride stage, ride history) lives in the small `useSyncExternalStore` store in `src/lib/move-store.ts`, persisted to localStorage; there is no backend yet, so keep selectors returning existing references to avoid render loops.
- The ride flow on `/home` is driven by `ride.stage` (idle → choose → finding → arriving → here → started → tracking → arrived), not separate routes, so the map and sheet stay mounted between steps.
- Fares, vehicles, bus stops and drivers are static data in `src/lib/move-data.ts`; fare math (`tripTotal`, `offerLabel`) is covered by `src/test/fares.test.ts`.
