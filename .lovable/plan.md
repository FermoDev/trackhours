

## Add date picker to manual entries + pause/resume for timer

### 1. Manual entry: add date picker

Currently the manual entry form hardcodes `entry_date` to today. Add a date picker field so users can log time for past dates.

**File: `src/routes/_authenticated.dashboard.tsx`**
- Add state: `const [manualDate, setManualDate] = useState<Date>(new Date())`
- In `handleManualEntry`, use `format(manualDate, "yyyy-MM-dd")` instead of `new Date().toISOString().slice(0, 10)`
- Add a date picker (Popover + Calendar from shadcn) in the manual entry form, between the client/project selects and the duration/description inputs
- Reset `manualDate` to today when the form closes

### 2. Timer: add pause/resume

Add pause functionality so users can take breaks without stopping the timer entirely. This needs state tracking in the timer context.

**File: `src/hooks/use-timer.tsx`**
- Add `isPaused` state (boolean, default false)
- Add `pausedElapsed` state (number) to store accumulated seconds when paused
- Add `pauseTimer` function: sets `isPaused = true`, stores current `elapsed` in `pausedElapsed`, and stops the interval (no DB write needed -- pause is client-side only)
- Add `resumeTimer` function: sets `isPaused = false`, updates `activeEntry.start_time` conceptually by adjusting the elapsed calculation to account for paused time
- Modify the elapsed calculation `useEffect`: when paused, don't run the interval; when resumed, offset the calculation by `pausedElapsed`
- Modify `stopTimer`: use `pausedElapsed + live elapsed` for total duration calculation
- Export `isPaused`, `pauseTimer`, `resumeTimer` from context

**File: `src/components/StickyTimer.tsx`**
- Import `Pause`, `Play` icons from lucide-react
- Add a Pause button next to Stop (when running) that calls `pauseTimer`
- When paused, show a Resume button (Play icon) instead of Pause
- Optionally dim the timer display or show "Paused" label when paused

**File: `src/routes/_authenticated.dashboard.tsx`**
- In the active timer card, add the same Pause/Resume button alongside Stop
- Show paused state visually (e.g. "Paused" badge, stop the pulse animation)

### Summary

| Feature | What changes |
|---|---|
| Date on manual entry | Date picker added to form, date sent to DB |
| Pause/Resume timer | Client-side pause tracking in TimerProvider, UI buttons in sticky bar + dashboard |

No database changes needed -- `entry_date` already exists, and pause is tracked client-side until stop writes the final duration.

