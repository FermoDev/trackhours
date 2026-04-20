

## Add client linkage to Projects page

The Projects tab already stores `client_id` on each project, but the UI treats projects as a flat list. I'll make the relationship to clients explicit and navigable.

### Changes to `src/routes/_authenticated.admin.projects.tsx`

1. **Filter by client** — add a client `<Select>` filter above the table ("All clients" + each active client). Filters the project list in place.

2. **Make the Client column clickable** — in each row, the client name becomes a `<Link to="/admin/clients">` (with the client name highlighted as a link). Clicking takes the admin to the Clients tab.

3. **Group/sort by client** — order projects by client name, then project name, so projects belonging to the same client cluster together visually.

4. **Empty-state hint** — if there are zero active clients when the user opens "Add Project", show inline text in the dialog: "No active clients yet — add a client first" with a link to `/admin/clients`.

5. **Project count on Clients page** (`src/routes/_authenticated.admin.clients.tsx`) — add a "Projects" column showing how many projects each client has. The count itself is a link to `/admin/projects?client=<id>` so admins can jump straight from a client to its projects.

6. **Read `?client=` query param** on the Projects page — if present, pre-set the client filter on mount so the cross-link from Clients lands on a filtered view.

### Technical notes

- Use `useSearch` from `@tanstack/react-router` to read the `client` query param; declare it via `validateSearch` on the route.
- Project counts on the Clients page: single query — `supabase.from("projects").select("client_id")` then tally client-side (small dataset, no extra round trips per row).
- No DB or schema changes. No new components.

