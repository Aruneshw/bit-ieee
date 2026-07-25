# IEEE Hub Web - Project Structure Checklist

## Current Architecture

```
src/
├── app/                    # Next.js App Router (Pages & API Routes)
│   ├── admin/              # Admin dashboard pages (14 pages)
│   ├── api/                # API routes (13 endpoints)
│   ├── auth/               # Auth callback
│   ├── leadership/         # Leadership portal (9 pages)
│   ├── member/             # Member portal (12 pages)
│   ├── rep/                # Representative portal (6 pages)
│   ├── quiz/               # Quiz/Circuit pages
│   └── ...                 # Root pages (login, dashboard, etc.)
├── core/                   # Core utilities & database
│   ├── database/           # DB connections (Supabase, TiDB, Redis)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── modules/                # Feature modules
│   ├── admin/              # Admin services
│   ├── auth/               # Auth components & hooks
│   ├── events/             # Event components & activity
│   ├── quiz/               # Quiz & Arduino components
│   ├── society/            # Society feed & panels
│   └── tasks/              # Task components
├── shared/                 # Shared components
│   └── components/         # Layout (sidebar, navbar, theme)
├── proxy.ts                # Proxy configuration
├── instrumentation-client.ts
└── instrumentation.ts
```

---

## Checklist

### 1. Project Structure ✅
- [x] `src/app/` - Next.js App Router with role-based routing
- [x] `src/core/` - Database, types, utils separated
- [x] `src/modules/` - Feature-based module organization
- [x] `src/shared/` - Shared layout components
- [x] `supabase/migrations/` - SQL migrations organized

### 2. Module Organization ✅
| Module | Components | Services | Hooks |
|--------|-----------|----------|-------|
| admin | - | admin.actions.ts | - |
| auth | RoleGuard, SessionProfileProvider | - | use-role |
| events | about-ieee, calendar-view, event-detail-editor, activity/* | - | - |
| quiz | arduino/* (5 files) | circuit-grader | - |
| society | admin-panel, post-card, post-creator, sidebar, trending | - | - |
| tasks | admin-tasks-components, coding-editor | - | - |

### 3. Core Infrastructure ✅
- [x] Database: Supabase (client, server, middleware)
- [x] Database: TiDB connection
- [x] Database: Redis client
- [x] Database: Rate limiter
- [x] Types: Centralized type definitions
- [x] Utils: Shared utility functions

### 4. Shared Components ✅
- [x] Layout: sidebar, top-navbar, role-layout
- [x] Theme: ThemeInitScript, theme-toggle
- [x] QR: qr-scan-modal

### 5. API Routes ✅
- [x] `/api/admin/bulk-create-users` - User management
- [x] `/api/arduino/compile` - Arduino compilation
- [x] `/api/circuit/*` - Circuit quiz (start, submit, grade, results, cleanup)
- [x] `/api/compile/c` - C compilation
- [x] `/api/quiz/*` - Quiz system (questions, start, verify)
- [x] `/api/send-email` - Email service
- [x] `/api/sync-ieee-events` - Event sync
- [x] `/api/tidb/*` - TiDB proxy

### 6. Uncommitted Changes Status
- [ ] **Modified Files**: 67 files
- [ ] **Deleted Files**: 27 files (old locations)
- [ ] **New Files**: 13 files (new locations in modules/core/shared)
- [ ] **SQL Migrations**: 7 files moved to `supabase/migrations/`

---

## Pending Actions

### Before Commit
- [ ] Review all modified files for import correctness
- [ ] Verify no broken imports after file moves
- [ ] Run `npm run build` to check for TypeScript errors
- [ ] Run `npm run lint` to check for linting issues
- [ ] Test key pages: login, dashboard, admin

### Import Path Updates Needed
The following files were moved and imports need verification:

| Old Location | New Location |
|-------------|--------------|
| `src/components/sidebar.tsx` | `src/shared/components/layout/sidebar.tsx` |
| `src/components/top-navbar.tsx` | `src/shared/components/layout/top-navbar.tsx` |
| `src/components/role-layout.tsx` | `src/shared/components/layout/role-layout.tsx` |
| `src/components/theme-toggle.tsx` | `src/shared/components/layout/theme-toggle.tsx` |
| `src/components/theme-init-script.tsx` | `src/shared/components/layout/ThemeInitScript.tsx` |
| `src/components/role-guard.tsx` | `src/modules/auth/components/RoleGuard.tsx` |
| `src/components/session-profile-provider.tsx` | `src/modules/auth/components/session-profile-provider.tsx` |
| `src/components/qr-scan-modal.tsx` | `src/shared/components/qr-scan-modal.tsx` |
| `src/lib/db.ts` | `src/core/database/db.ts` |
| `src/lib/tidb.ts` | `src/core/database/tidb.ts` |
| `src/lib/redis.ts` | `src/core/database/redis.ts` |
| `src/lib/supabase/*` | `src/core/database/supabase/*` |
| `src/lib/types.ts` | `src/core/types/index.ts` |
| `src/lib/utils.ts` | `src/core/utils/index.ts` |
| `src/lib/rate-limiter.ts` | `src/core/utils/rate-limiter.ts` |
| `src/hooks/use-role.ts` | `src/modules/auth/hooks/use-role.ts` |
| `src/hooks/use-tidb.ts` | `src/core/database/hooks/use-tidb.ts` |
| `src/components/about-ieee.tsx` | `src/modules/events/components/about-ieee.tsx` |
| `src/components/calendar-view.tsx` | `src/modules/events/components/calendar-view.tsx` |
| `src/components/admin/event-detail-editor.tsx` | `src/modules/events/components/event-detail-editor.tsx` |
| `src/components/member/*` | `src/modules/events/components/activity/*` |
| `src/components/member/arduino/*` | `src/modules/quiz/components/arduino/*` |
| `src/components/member/society/*` | `src/modules/society/components/*` |
| `src/app/admin/tasks/components.tsx` | `src/modules/tasks/components/admin-tasks-components.tsx` |
| `src/app/member/task/coding-editor.tsx` | `src/modules/tasks/components/coding-editor.tsx` |

---

## File Counts

| Directory | Files | Purpose |
|-----------|-------|---------|
| `src/app/` | 78 | Pages & API routes |
| `src/core/` | 10 | Database, types, utils |
| `src/modules/` | 31 | Feature modules |
| `src/shared/` | 6 | Shared components |
| `src/` (root) | 3 | Config files |
| **Total** | **128** | - |

---

## Recommendations

1. **Commit Current Changes** - The restructuring looks complete
2. **Run Build Verification** - Ensure no TypeScript errors
3. **Test Critical Flows** - Login, dashboard, admin panel
4. **Consider Adding**:
   - `src/modules/events/services/` for event-related API logic
   - `src/modules/quiz/services/` for quiz API logic
   - Barrel exports (`index.ts`) in each module for cleaner imports
