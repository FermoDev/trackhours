## Goal
Reset Sami's time entries and seed 10 weekly entries on HachiAI / Project Management.

## Steps

1. **Find IDs** (read-only):
   - Sami's user_id: `887c435e-d96f-4104-8104-c0873d1ae0b1`
   - Look up HachiAI client_id and "Project Management" project_id under that client. If the project doesn't exist, create it (billable_default=true, created_by=Sami).
   - Ensure project_assignment exists for Sami on that project.

2. **Clear Sami's existing entries**: `DELETE FROM time_entries WHERE user_id = '<sami>'`. (Confirmed: wipe ALL of Sami's entries across every client/project, not just HachiAI.)

3. **Insert 10 entries** — each 2.5h (150 min), billable=true, status=approved, entry_mode=manual, description = `"Total of meetings attended and follow ups internally and with the HachiAI team (weekly)"`. Dates (Fridays, with last one clipped to Thu Jun 25 per the cutoff):

   ```text
   2026-04-24, 2026-05-01, 2026-05-08, 2026-05-15, 2026-05-22,
   2026-05-29, 2026-06-05, 2026-06-12, 2026-06-19, 2026-06-25
   ```

   Total = 25h.

4. **Verify**: `SELECT count(*), sum(duration_minutes)/60.0 FROM time_entries WHERE user_id='<sami>'` → expect 10 and 25.

## Open question
Step 2 deletes every Sami time entry in the database. Confirm that's what you want (vs. only deleting Sami's HachiAI entries).
