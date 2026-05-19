## Goal
Replace the blue primary accent (`oklch(0.45 0.18 260)` and its dark-mode variant `oklch(0.6 0.2 260)`) with green `#00ba6a` across the app.

## Approach
All blue UI comes from a small set of semantic tokens in `src/styles.css`. Update those tokens — every button, link, ring, chart-1 bar, sidebar accent, and focus state will pick it up automatically. No component files need to change.

## Token conversion
`#00ba6a` in OKLCH ≈ `oklch(0.68 0.17 155)`.
- Light mode primary: `oklch(0.62 0.17 155)` (slightly deeper so white text stays readable on buttons)
- Dark mode primary: `oklch(0.72 0.17 155)` (brighter to pop against dark bg)

## Changes (single file: `src/styles.css`)

**`:root` (light mode) — update these tokens to the green hue (155):**
- `--primary`
- `--ring`
- `--chart-1`
- `--sidebar-primary`
- `--sidebar-ring`

**`.dark` — same set, using the dark-mode green:**
- `--primary`
- `--ring`
- `--chart-1`
- `--sidebar-primary`
- `--sidebar-ring`

**Leave untouched:**
- `--timer` / `--success` (already green — independent semantic meaning)
- `--destructive`, `--warning`, neutrals, other chart colors
- `--primary-foreground` (stays near-white; contrast remains AA on the new green)

## Out of scope
No component-level edits. No logo/image asset changes. If any hardcoded blue hex exists in a component (none expected based on the design-system rule), that would be a follow-up.
