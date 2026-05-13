## Plan to fix Add Project

I’ll keep this tightly scoped to the dashboard Add Project workflow.

### 1. Remove the wrong description fields
- Remove the description textarea from **Add Project**.
- Remove the description textarea from **Add Client** too, since that was also not requested.
- Do **not** touch the timer/manual-entry description fields (`What are you working on?` / `Description`) — those stay required.

### 2. Fix the Add Project success behavior
- After a project is created or joined:
  - close the modal,
  - refresh clients/projects,
  - set the selected client,
  - set the selected project to the newly created/joined project,
  - open the timer form so the user can actually see the selected project immediately.
- Also make Add Client success open the timer form with the new client selected, so the next expected action is clear.

### 3. Make the dropdown arrow look active
- Update the shared Select chevron styling from dim/disabled-looking opacity to normal muted foreground styling.

### 4. Keep server validation compatible
- Make client/project `description` optional without requiring non-empty text server-side, so the create calls work without sending a description.
- No database migration needed.

### 5. Test before marking done
I’ll test the browser flow myself:
- open dashboard,
- click **New project**,
- select a client,
- enter a project name,
- click **Add**,
- confirm the modal closes,
- confirm the timer form opens,
- confirm the new project appears selected,
- confirm no console/server errors show for the create call.