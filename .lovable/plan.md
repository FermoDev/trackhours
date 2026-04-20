

## Fix dialog/alert-dialog open/close animation jank

The buggy "drift" you're seeing on every modal (Add Project, Add Client, Assign User, etc.) comes from the shadcn defaults in `dialog.tsx` and `alert-dialog.tsx`. Both files combine **centering via `translate-x/y-[-50%]`** with **slide-in/out animations that also translate** (`slide-in-from-left-1/2`, `slide-out-to-top-[48%]`). The two translates fight each other, so the modal jumps sideways/upward as it appears or closes.

### Changes

**`src/components/ui/dialog.tsx` — `DialogContent`**
- Remove the conflicting slide classes: `data-[state=closed]:slide-out-to-left-1/2`, `data-[state=closed]:slide-out-to-top-[48%]`, `data-[state=open]:slide-in-from-left-1/2`, `data-[state=open]:slide-in-from-top-[48%]`.
- Keep `fade-in-0` / `fade-out-0` and `zoom-in-95` / `zoom-out-95` (these don't conflict with the centering translate).
- Bump `duration-200` for a smoother feel.

**`src/components/ui/alert-dialog.tsx` — `AlertDialogContent`**
- Same fix: drop the four `slide-*-1/2` / `slide-*-top-[48%]` classes; keep fade + zoom.

**`src/components/ui/dialog.tsx` and `alert-dialog.tsx` — overlays**
- Add explicit `duration-200` to the overlay so the backdrop fade matches the content fade (currently it has no duration class and snaps).

**`src/components/ui/sheet.tsx`**
- No animation bug here (sheets slide from edges with no centering translate), but I'll verify the overlay duration matches the content (it currently uses `duration-300`/`duration-500` only on content, overlay snaps). Add `duration-300` to overlay for consistency.

**Console-noise cleanup (related)**
- The console shows `Missing Description or aria-describedby for {DialogContent}` warnings on the admin assignment + project dialogs. I'll add a `<DialogDescription className="sr-only">` (or visible where it helps) inside:
  - `src/routes/_authenticated.admin.assignments.tsx` (Assign dialog)
  - `src/routes/_authenticated.admin.projects.tsx` (Add Project dialog)
  - `src/routes/_authenticated.admin.clients.tsx` (Add Client dialog, if missing)
  - `src/routes/_authenticated.dashboard.tsx` (Manual entry dialog, if it uses Dialog)
  - `src/routes/_authenticated.timesheet.tsx` (any edit dialog)

This silences the a11y warning and also fixes a subtle Radix behavior where missing description can cause re-renders that visually compound the animation glitch.

### Out of scope

- No changes to colors, layout, or modal contents.
- No changes to Popover/Select/Tooltip/Context/DropdownMenu animations — those don't use a centering translate, so their slide animations are correct as-is.

