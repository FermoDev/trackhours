

# Freelancer Time Tracking App — Implementation Plan

## Overview
A full-stack time tracking app for freelancers with authentication, role-based access (Admin, Freelancer, Manager), a live timer, timesheets, reporting, and CSV export. Clean, minimal, professional UI.

## 1. Database Schema & Security

Set up Lovable Cloud with these tables:

- **profiles** — extends auth.users with full_name, status, hourly_rate, created_at
- **user_roles** — separate roles table (admin/freelancer/manager) per security best practices
- **clients** — name, code, status
- **projects** — client_id FK, name, description, status, billable_default
- **project_assignments** — user_id + project_id junction
- **time_entries** — user_id, client_id, project_id, entry_date, start_time, end_time, duration_minutes, description, entry_mode (timer/manual), billable, status (draft/submitted/approved), timestamps
- **activity_logs** — user_id, action, metadata, created_at

RLS policies:
- Freelancers: read/write own entries and assigned projects only
- Managers: read entries for assigned clients/projects
- Admins: full access via `has_role()` security definer function
- Auto-create profile on signup via trigger

## 2. Authentication

- Sign up, login, forgot password, reset password pages
- Auth context passed through router for route guards
- `_authenticated` layout route to protect all app pages
- `_authenticated/_admin` layout for admin-only pages
- Role-based redirects after login (admin → admin dashboard, freelancer → freelancer dashboard)

## 3. Landing Page

- Clean hero section explaining the app
- Feature highlights (timer, timesheets, reporting)
- Login and Sign Up CTAs
- Professional, minimal design with lots of white space

## 4. Freelancer Experience

**Dashboard** (`/dashboard`):
- Welcome message with user name
- Active timer card (hero position) with one-click Start/Stop
- Today's total hours, this week's total
- Recent entries list
- "Continue last project" quick action
- Quick manual entry button

**Timer Features**:
- Client + project selector → Start Timer
- Sticky floating timer bar visible across all pages
- Prevent multiple simultaneous timers (one active timer per user)
- Timer state persisted to database so it survives refresh
- "Start again" action from recent entries
- Before-unload warning if timer is running
- Idle reminder after configurable inactivity period

**Timesheet** (`/timesheet`):
- Table of time entries with filters (client, project, date range, status)
- Inline edit for draft entries
- Bulk submit action
- Daily/weekly/monthly total summaries

**Weekly View** (`/weekly`):
- Grid layout: days as columns, projects as rows
- Click cell to add/edit time
- Day totals at bottom, week total

## 5. Admin Experience

**Admin Dashboard** (`/admin`):
- KPI cards: hours today, this week, this month
- Hours by freelancer, client, project (charts)
- Pending submitted entries count with quick link
- Recent activity feed

**Management Pages**:
- `/admin/users` — list, create, edit, activate/deactivate users, set roles
- `/admin/clients` — CRUD clients, archive
- `/admin/projects` — CRUD projects, set billable default, archive
- `/admin/assignments` — assign freelancers to projects
- `/admin/entries` — all time entries with filters, approve submitted entries
- `/admin/reports` — summary reports by freelancer/project/client/date range, CSV export

## 6. Manager Role

- Same authenticated layout but restricted views
- Can only see entries and projects for their assigned clients
- No access to admin management pages (users, global settings)
- Filtered dashboard showing only their scope

## 7. Reporting & Export

- Filter by date range, freelancer, client, project
- Grouped summaries (by freelancer, by project, by client)
- Totals in hours and minutes
- CSV export via server function
- Database structure ready for future billing reports (hourly_rate on profiles, billable flag on entries)

## 8. Seed Data

Server function to populate realistic sample data:
- 3 freelancers, 1 admin, 1 manager
- 4 clients with 8 projects
- Project assignments
- ~50 time entries across the past 2 weeks in various statuses (draft, submitted, approved)

## 9. UI Design

- Neutral color palette (white/gray/slate) with a single accent color
- Soft borders, subtle shadows, rounded corners (radius-lg)
- Clean typography with clear hierarchy
- Cards for data grouping, clean tables for lists
- Large, obvious Start/Stop timer buttons
- Mobile responsive throughout
- Minimal navigation sidebar (collapsible on mobile)
- Professional and distraction-free

