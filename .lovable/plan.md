

# UX Polish & Refinements Plan

## Overview
Refine the freelancer time tracking app across 7 files to make it more practical, polished, and production-ready. No new database changes needed.

## Changes

### 1. Enhanced Sticky Timer (`StickyTimer.tsx`)
- Make it larger, more prominent, and always visible when a timer runs
- Show project name and client name alongside the running clock
- Add description to the timer context so it displays in the sticky bar
- Position it as a top banner (not small bottom-right corner)

### 2. Freelancer Dashboard (`_authenticated.dashboard.tsx`)
Major rework:
- **Hours target indicators**: Add visual progress bars for today (target: 8h) and this week (target: 40h) showing how close the user is
- **"Continue last project" quick action**: Show the most recent completed entry with a one-click "Continue" button prominently at the top
- **"Forgot to track?" quick action**: A clearly visible button that opens the manual entry form pre-filled with today's date
- **Recent projects quick-start**: Show last 3 unique project/client combos as quick-start buttons (one click to start timer)
- **Simplify timer start**: Reduce clicks — show recent projects as clickable chips instead of requiring two dropdown selections
- **Cleaner recent entries list**: Better spacing, clearer status badges, more scannable

### 3. Weekly Timesheet View (`_authenticated.weekly.tsx`)
- **Missing hours highlighting**: Color cells red/orange when a weekday has <8h logged, making gaps easy to spot
- **Click any cell to add/edit**: Currently only footer has add buttons — make each cell clickable
- **Show weekly target**: Display "32h / 40h target" progress at the top
- **Better mobile layout**: Stack into a day-by-day view on small screens instead of a wide table

### 4. Timesheet Page (`_authenticated.timesheet.tsx`)
- **Cleaner table styling**: Better row spacing, alternating subtle backgrounds, larger touch targets
- **Inline status badges**: More compact, professional pill badges
- **Summary cards at top**: Show total hours, draft count, submitted count as small cards above the table
- **Select all drafts**: Add a "select all" checkbox for batch submit

### 5. Admin Reports (`_authenticated.admin.reports.tsx`)
- **Summary cards at top**: Total hours, total entries, average hours/day as cards above the table
- **Cleaner filter bar**: Better labels, reset filters button
- **Better grouped table**: Add percentage column, visual bar indicators

### 6. Admin Entries (`_authenticated.admin.entries.tsx`)
- **Summary row**: Total entries, pending count, total hours at top
- **Bulk approve**: Select multiple submitted entries and approve at once
- **Better status badges**: Color-coded consistently

### 7. Timer Hook (`use-timer.tsx`)
- Expose `activeEntry`'s project/client names by joining on fetch so the sticky timer can display them

### 8. Mobile Responsiveness (`AppSidebar.tsx` + layouts)
- Ensure the sticky timer works well on mobile (full-width banner)
- Better mobile sidebar transitions
- Stack filter grids to single column on mobile

## Technical details

Files modified:
- `src/components/StickyTimer.tsx` — top banner with project info
- `src/hooks/use-timer.tsx` — fetch with joins for project/client names
- `src/routes/_authenticated.dashboard.tsx` — quick actions, targets, recent projects
- `src/routes/_authenticated.weekly.tsx` — cell clicking, missing hours highlight, target bar
- `src/routes/_authenticated.timesheet.tsx` — summary cards, select all, cleaner table
- `src/routes/_authenticated.admin.reports.tsx` — summary cards, reset filters, bars
- `src/routes/_authenticated.admin.entries.tsx` — bulk approve, summary stats
- `src/routes/_authenticated.tsx` — adjust layout for top-banner timer

No database migrations needed. No new dependencies needed.

