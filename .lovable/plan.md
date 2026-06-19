## Plan: Replace sidebar logo "T" with clock icon

### What we will change
- Update the `AppSidebar` logo badge so the "T" text is replaced by a `Clock` icon.
- Keep the same rounded `h-7 w-7` container, primary/15 background, and primary text color so the visual identity remains consistent.
- Keep the "TimeTrack" text label unchanged.
- No other sidebar behavior (collapse, groups, active states, mobile drawer) changes.

### File to edit
- `src/components/AppSidebar.tsx`

### Implementation detail
- The file already imports `Clock` from `lucide-react` (used in the Admin "All Entries" nav item).
- In the header area, replace the inner `<div>…T…</div>` badge with a container that renders `<Clock className="h-4 w-4" />`.
- Ensure the icon remains centered and keeps the existing font-size/weight styling when the sidebar is expanded.
- No new dependencies or design tokens needed.

### Out of scope
- No changes to other routes, settings layout, or backend.
- No new assets, fonts, or colors.