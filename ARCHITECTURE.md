# 🏗️ Ava-Abram — Scout Group Management System

> **Last updated:** 2026-09-05  
> **Status:** Production (Supabase FREE tier)  
> **Language:** Arabic UI, English codebase

---

## 1. Overview

Ava-Abram is a web application for managing a Scout group (فرقة كشافة). It provides:

- **Admin Dashboard** — full CRUD for members, products, books, news, exams, orders, attendance, badges, and user permissions
- **Member Portal** — browse store/catalog, take exams, read news, borrow books, view profile
- **Attendance System** — QR-code-based scan with auto-detection from URL parameters
- **Exam Engine** — timed exams with server-side scoring (correct answers never reach the client)
- **Badges & Achievements** — badge definitions with member application workflow, auto-grant rules, and admin review
- **Shopping Cart** — localStorage-persisted cart with atomic checkout (stock deduction with row locking)
- **Import/Export** — Excel import for bulk member creation, Excel export for orders

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6 + Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| State | React Context (single `StoreProvider`) |
| Routing | Custom hash-based router (`useHashRoute`) — no react-router |
| Excel | ExcelJS (import + export) |
| QR | `qrcode` npm package |
| Sanitization | DOMPurify |
| Build | Vite with manual chunk splitting (vendor-supabase, vendor-exceljs) |

### Environment

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

---

## 2. Project Structure

```
src/
├── App.jsx                          # Root component + hash-based router
├── index.css                        # Global styles (Tailwind)
├── main.jsx                         # React entry point
├── store.jsx                        # Global state (React Context + Supabase)
│
├── admin/                           # Admin-facing pages
│   ├── AdminDashboard.jsx           # Main admin dashboard (tabbed sections)
│   ├── AttendanceSection.jsx        # Attendance tracking + QR scan
│   ├── BadgesSection.jsx            # Badge CRUD + award review
│   ├── ExamsSection.jsx             # Exam CRUD (questions, correct answers visible)
│   ├── ImportMembers.jsx            # Bulk Excel import → member creation
│   ├── LibrarySection.jsx           # Book CRUD + file upload
│   ├── MembersSection.jsx           # Member CRUD + QR code generation + pagination
│   ├── NewsSection.jsx              # News CRUD + form builder
│   ├── OrdersSection.jsx            # Order management + Excel export
│   ├── StoreSection.jsx             # Product CRUD + image management
│   ├── SubmissionsSection.jsx       # News/exam submissions review
│   ├── UserManagement.jsx           # Admin/subadmin permission management
│   ├── ScanPage.jsx                 # Standalone QR scan page
│   ├── data.js                      # Seed data + constants
│   ├── badges-seed.js               # 20 official Rover-stage badges seed data
│   ├── icons.jsx                    # 33 SVG icon components
│   └── ui.jsx                       # Shared UI primitives (Badge, Card, Dialog, etc.)
│
├── components/                      # Shared components
│   ├── LoginForm.jsx                # Login form + rate limiting (5 attempts → 30s lockout)
│   └── SetPasswordPage.jsx          # First-time password setup (forced after auto-creation)
│
├── home/                            # Public-facing home
│   └── HomePage.jsx                 # Landing page with news highlights
│
├── hooks/                           # Custom React hooks
│   └── useDebounce.js               # Debounce hook (default 300ms)
│
├── lib/                             # Library initialization
│   └── supabaseClient.js            # Supabase client init + config validation
│
├── member/                          # Member-facing pages
│   ├── BadgesPage.jsx               # Badge catalog + application
│   ├── CartPage.jsx                 # Shopping cart + checkout
│   ├── ExamRunner.jsx               # Exam-taking interface (timer, question nav, auto-submit)
│   ├── ExamsPage.jsx                # Exam list + launch + server-side scoring
│   ├── LibraryPage.jsx              # Book browsing/borrowing
│   ├── MemberLayout.jsx             # Member nav shell (sidebar + header)
│   ├── NewsPage.jsx                 # News feed + form submission
│   ├── ProfilePage.jsx              # Member profile view
│   └── StorePage.jsx                # Product catalog + add-to-cart
│
└── utils/                           # Utility functions
    ├── generateScoutCode.js         # Scout code generator (#AE-YYYY-SS-NN.FF)
    ├── generateTempPassword.js      # Crypto-secure temp password (12 chars, unambiguous)
    ├── imageLinks.js                # Custom links:// protocol for multi-image handling
    └── sanitizeInput.js             # DOMPurify-based HTML sanitizer (strips all tags)

supabase/migrations/                 # SQL migrations
├── schema.sql                       # Base schema (tables, RLS, RPCs, triggers)
├── fix-8-exam-security.sql          # score_exam RPC + get_member_exams RPC
├── fix-10-order-sequence.sql        # order_seq sequence + updated place_order RPC
├── fix-12-fix-storage-drop.sql      # Private buckets + granular storage RLS
└── ...                              # Other migration patches
```

---

## 3. Routing

Custom hash-based router. `App.jsx` uses `useHashRoute()` on `window.location.hash`.

| Hash Route | Component | Auth |
|-----------|-----------|------|
| `#/home` | `HomePage` | Public |
| `#/login` | `LoginForm` | Public (redirects if logged in) |
| `#/admin` | `AdminDashboard` | **Admin/Subadmin** |
| `#/scan` | `ScanPage` | Public |
| `#/exams` | `ExamsPage` | Public |
| `#/news` | `NewsPage` | Public |
| `#/store` | `StorePage` | Public |
| `#/cart` | `CartPage` | **Logged-in** |
| `#/library` | `LibraryPage` | Public |
| `#/badges` | `BadgesPage` | **Logged-in** |
| `#/profile` | `ProfilePage` | **Logged-in** |
| `#contact` | Info placeholder | Public |
| `#privacy` | Info placeholder | Public |
| `#terms` | Info placeholder | Public |

**Auth guard flow:**
1. `isSupabaseConfigured` check → shows config screen if missing
2. `ErrorBoundary` wraps everything
3. `StoreProvider` provides global state
4. `passwordSet === false` → forced `SetPasswordPage`
5. Admin route + non-admin → `NotAuthorized`
6. Protected route + no user → `LoginRequired`

---

## 4. Database Schema

### Tables

#### `profiles` — User accounts (extends auth.users)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | → auth.users(id) CASCADE |
| full_name | text | |
| email | text | |
| role | text | CHECK ∈ {member, subadmin, admin, leader} |
| permissions | jsonb | Array of permission strings, e.g. ["store:write", "news:write"] |
| created_at | timestamptz | |

#### `members` — Scout member records
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| scout_code | text UNIQUE | Format: #AE-YYYY-SS-NN.FF |
| name | text NOT NULL | |
| father_name, mother_name | text | |
| birth_date | date | |
| scout_stage | text | |
| email | text | For login account |
| phone, father_phone, mother_phone | text | |
| address, college, governorate | text | |
| user_id | uuid FK | → profiles(id) — links to auth account |
| approved_badges | jsonb | |
| approved_certificates | jsonb | |
| created_at | timestamptz | |

#### `products` — Store products
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| sku | text | |
| category_id | text | |
| price | numeric(10,2) | CHECK ≥ 0 |
| stock | int | CHECK ≥ 0 |
| image_url | text | Single URL or "links://" + JSON array |
| created_at | timestamptz | |

#### `orders` — Purchase orders
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | → profiles(id) |
| order_id | text | Sequential: ORD-YYYYMMDD-000001 |
| customer | text | |
| items | text | Comma-separated product names |
| total | numeric(10,2) | |
| status | text | CHECK ∈ {Pending, Shipped, Delivered, Approved} |
| date | date | |

#### `exams` — Exams with questions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title | text | |
| exam_code | text | Short code to access exam |
| duration | int | Minutes |
| status | text | CHECK ∈ {Active, Draft, Closed} |
| submissions | int | Count |
| question_list | jsonb | Array of {question, choices[], correct} |
| results | jsonb | **DEPRECATED**: use exam_results table instead. Kept for backward compatibility. |

#### `exam_results` — Individual exam submissions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| exam_id | uuid FK | → exams(id) CASCADE |
| user_id | uuid FK | → profiles(id) |
| member_name | text | Name of the member who submitted |
| rank | text | Scout rank at time of submission |
| email | text | Email at time of submission |
| score | int | |
| total_questions | int | |
| submitted_at | timestamptz | |
| approved | boolean | false = under review (score hidden from member) |

#### `news` — News articles + forms
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title, body, category | text | |
| pinned | boolean | |
| form | jsonb | Form schema for submissions |
| submissions | jsonb | Array of submitted form data |
| image_url | text | "links://" protocol for multi-image |
| date | date | |

#### `books` — Library books
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| title, author, category, description | text | |
| cover_url | text | |
| file_url | text | PDF/file download |

#### `store_settings` — Singleton store config
| Column | Type | Notes |
|--------|------|-------|
| id | int PK CHECK=1 | Singleton row |
| title, description | text | |
| categories, price_ranges, availability | jsonb | |

#### `attendance` — Daily attendance records
Tracked via `get_attendance_by_date` and `scan_attendance` RPCs.

#### `badges` — Badge definitions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | Arabic name |
| name_en | text | English name |
| category | text | Badge category (e.g. Rover-stage) |
| description | text | Badge description / requirements summary |
| requirements | text | Detailed requirements text |
| level | int | Badge tier/level |
| points | int | Points awarded |
| icon_url | text | Badge icon image URL |
| status | text | CHECK ∈ {Active, Draft, Inactive} |
| required_exam_id | uuid FK | → exams(id) — exam that grants this badge |
| related_products | jsonb | Array of related product IDs |
| auto_grant_rule | text | Auto-grant rule name (e.g. attendance_80) |
| application_fields | jsonb | Admin-defined per-badge form field schema |
| created_at | timestamptz | |

#### `badge_awards` — Per-member badge tracking
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| badge_id | uuid FK | → badges(id) |
| member_id | uuid FK | → members(id) |
| user_id | uuid FK | → profiles(id) |
| member_name | text | Denormalized member name |
| rank | text | Scout rank at time of application |
| email | text | Email at time of application |
| status | text | CHECK ∈ {pending_start, in_progress, submitted, approved, revoked} |
| evidence | text | Supporting evidence / proof text |
| application_data | jsonb | Submitted field values matching badge application_fields |
| notes | text | Admin notes on review |
| awarded_by | uuid FK | → profiles(id) — admin who approved |
| awarded_at | timestamptz | Timestamp of approval |
| created_at | timestamptz | |

---

## 5. Supabase RPCs

### Helper Functions
| Function | Returns | Purpose |
|----------|---------|---------|
| `is_admin()` | boolean | Checks auth.uid() has role = 'admin' |
| `has_permission(perm)` | boolean | Admin OR subadmin with named permission (or '*') |
| `handle_new_user()` | trigger | Auto-creates profiles row on auth.users INSERT |

### Admin RPCs (all SECURITY DEFINER, all check permissions)
| Function | Purpose |
|----------|---------|
| `admin_create_user(email, password, name, role, perms)` | Create auth user + profile. Requires users:write. |
| `admin_delete_user(uid)` | Delete auth user. Requires users:write. |
| `admin_set_password(uid, password)` | Re-hash password. Requires users:write. |
| `admin_set_email(uid, email)` | Change email + auto-confirm. Requires users:write or members:write. |
| `admin_create_member_accounts(members jsonb)` | Bulk create/link auth accounts. Returns {created, linked, failed}. |
| `admin_delete_member(member_id)` | Delete member + linked account. Requires members:write. |
| `admin_delete_all_members()` | Wipe all members. Admin-only. |

### Business RPCs
| Function | Purpose |
|----------|---------|
| `place_order(items jsonb, customer text)` | Atomic checkout: FOR UPDATE lock, validate stock, deduct, create order. Sequential order ID via order_seq. |
| `score_exam(exam_id uuid, answers jsonb)` | Server-side scoring. Correct answers never returned to client. Returns {score, total}. |
| `get_member_exams()` | Returns active exams with 'correct' stripped from question_list. |
| `submit_news_form(news_id uuid, submission jsonb)` | Append form submission with row lock. |
| `scan_attendance(code text, date date)` | Record attendance by scout code. |
| `get_attendance_by_date(date date)` | Fetch attendance records for a date. |
| `check_attendance_badge(p_member_id)` | Auto-grant attendance badge when member attendance ≥ 80%. |
| `current_member_id()` | Resolve member ID from auth.uid(), bypassing nested RLS. |

---

## 6. RLS Policies (Row Level Security)

### Pattern: Public Read + Permission-Gated Write

| Table | Read | Write |
|-------|------|-------|
| profiles | Own row OR admin OR users:read | Own row (limited) OR admin OR users:write |
| members | Own member OR admin OR members:read | admin OR members:write |
| products | true (world-readable) | admin OR store:write |
| store_settings | true | admin OR store:write |
| orders | Own order OR admin OR orders:read | Own insert OR admin OR orders:write |
| exams | Active status OR admin OR exams:read | admin OR exams:write |
| exam_results | Own row OR admin OR exams:read | Own insert OR admin OR exams:write |
| news | true | admin OR news:write |
| books | true | admin OR library:write |
| badges | true (world-readable) | admin OR badges:write |
| badge_awards | Own row OR admin OR badges:read | Own insert OR admin OR badges:write |

### Storage RLS (after fix-12 migration)
| Bucket | Read | Write |
|--------|------|-------|
| product-images | true (anyone) | admin OR store:write |
| book-files | true (anyone) | admin OR library:write |
| news-images | true (anyone) | admin OR news:write |

All three buckets are **private** (public=false). Read access is via RLS SELECT policy on storage.objects.

### Permission Strings
| Permission | Grants |
|------------|--------|
| users:read / users:write | Read/write user accounts |
| members:read / members:write | Read/write member records + bulk ops |
| store:write | Write products, store settings, product images |
| library:write | Write books, book files |
| news:write | Write news, news images |
| exams:read / exams:write | Read drafts/results / write exams + approve results |
| orders:read / orders:write | Read/update orders |
| badges:read / badges:write | Read/approve badge awards / write badge definitions |
| * | Wildcard — all permissions (subadmin only) |

---

## 7. Global State (store.jsx)

Single React Context provider. All state lives in `StoreProvider`.

### State Shape
```
{
  // Auth
  currentUser, loading, login(), logout(), setOwnPassword(),
  
  // Permissions  
  isAdmin, isSubadmin, canRead(perm), canWrite(perm),
  
  // Data (fetched from Supabase on init)
  members, products, orders, books, news, exams, storeSettings,
  refreshData(),
  
  // CRUD
  onAdd(table, item), onUpdate(table, id, item), onDelete(table, id),
  
  // Members
  addMember(m), updateMember(id, m), deleteMember(id),
  createMemberAccounts(accounts), setUserPassword(uid, pwd), setUserEmail(uid, email),
  
  // Orders
  placeOrder(items, customer), updateOrderStatus(id, status),
  
  // Exams
  submitExamResult(examId, result),
  
  // News
  submitForm(newsId, data),
  
  // Cart (localStorage-persisted)
  cart, addToCart(product), removeFromCart(id), clearCart(),
  
  // Mapping helpers
  fmtDate, fmtMoney
}
```

### Data Loading
`refreshData()` runs 9 parallel Supabase queries on mount. No pagination (all records loaded). Snake_case columns mapped to camelCase via `map*` functions.

---

## 8. Custom Protocols & Patterns

### `links://` Image Protocol
Multi-image fields use a custom protocol: `"links://" + JSON.stringify(urlArray)`

- `parseLinks(imageUrl)` — parses and returns array, or null
- `buildLinksValue(links)` — builds the protocol string

Always use `slice(8)` — "links://" is 8 characters.

### Scout Code Format
`#AE-{birthYear}-{stageCode}-{nameCode}.{fatherCode}`

Generated by `generateScoutCode.js` from member profile data. Used as QR code content for attendance scanning.

### Temp Password Generation
`generateTempPassword(length=12)` — uses `crypto.getRandomValues()` with unambiguous characters (no 0/O, 1/l/I). Never uses scout codes as passwords.

### Input Sanitization
`sanitizeInput(value)` / `sanitizeObject(obj, excludeKeys)` — DOMPurify strips all HTML tags before saving to database. Applied in all admin form handlers.

### Badge Application Workflow
Status progression: `pending_start` → `in_progress` → `submitted` → `approved` / `revoked`

- **pending_start** — member expresses interest, badge appears on profile
- **in_progress** — member is working on requirements
- **submitted** — member submits evidence + application data for admin review
- **approved** — admin approves; badge is awarded (awarded_by, awarded_at set)
- **revoked** — admin revokes a previously approved badge

Custom application fields are defined per-badge via `application_fields` (jsonb) on the `badges` table. When a member applies, their responses are stored in `application_data` (jsonb) on `badge_awards`.

### Rate Limiting
`LoginForm.jsx` — 5 failed attempts → 30-second lockout with countdown. Server-side rate limiting should also be enabled in Supabase Dashboard.

---

## 9. Security Architecture

| Layer | Mechanism |
|-------|-----------|
| **Exam integrity** | `score_exam` RPC scores server-side; `get_member_exams` strips correct answers; client-side `safeExams` memo as defense-in-depth |
| **Auth** | Supabase Auth + client-side rate limiting + forced password change on first login |
| **Passwords** | Crypto-secure random generation; never uses scout codes |
| **XSS** | DOMPurify sanitization on all form inputs |
| **SQL injection** | Supabase client uses parameterized queries; RPCs use PL/pgSQL variables |
| **RLS** | Row-level security on all tables; permission-based access control |
| **Storage** | Private buckets + RLS policies; only authenticated admins/staff can write |
| **Stock race** | `SELECT ... FOR UPDATE` in place_order RPC prevents concurrent oversell |
| **Order IDs** | Sequential via `order_seq` — no random collision risk |

---

## 10. Build & Deployment

```bash
# Development
npm run dev          # Vite dev server

# Production build
npm run build        # Outputs to dist/

# Preview
npm run preview      # Serves dist/ locally
```

### Chunk Splitting
| Chunk | Contents | Loaded |
|-------|----------|--------|
| vendor-supabase | @supabase/supabase-js | Always |
| vendor-exceljs | exceljs | Only on import/export |
| index | App code | Always |

### Supabase Migrations (run in order)
1. `schema.sql` — base schema
2. `fix-8-exam-security.sql` — exam RPCs
3. `fix-10-order-sequence.sql` — order sequence + updated place_order
4. `fix-12-fix-storage-drop.sql` — private storage + RLS

---

## 11. Key Files by Responsibility

| Want to... | Edit this file |
|-----------|----------------|
| Add a new admin section | `AdminDashboard.jsx` (add tab) + new `src/admin/XxxSection.jsx` |
| Change member fields | `MembersSection.jsx` (form) + `members` table schema + `mapMember()` in `store.jsx` |
| Add a member-facing page | `App.jsx` (add route) + new `src/member/XxxPage.jsx` |
| Change exam scoring | `score_exam` RPC in SQL + `ExamsPage.jsx` (React) |
| Change cart behavior | `store.jsx` (cart state + localStorage) |
| Add a new permission | `profiles.permissions` + RLS policies + `UserManagement.jsx` |
| Change storage access | `fix-12-fix-storage-drop.sql` + bucket settings in Supabase Dashboard |
| Add a new RPC | SQL migration + `store.jsx` (call via `supabase.rpc()`) |
| Change navigation | `App.jsx` (routes) + `MemberLayout.jsx` (member nav) + `AdminDashboard.jsx` (admin tabs) |
| Change Excel import/export | `ImportMembers.jsx` (read) + `OrdersSection.jsx`/`SubmissionsSection.jsx` (write) |
| Manage badges & review awards | `BadgesSection.jsx` (admin CRUD + award review) |
| View/apply for badges | `BadgesPage.jsx` (member badge catalog + application) |
| Seed badge data | `badges-seed.js` (20 official Rover-stage badges) |

---

## 12. Known Limitations & Future Work

| Area | Current State | Improvement |
|------|--------------|-------------|
| State management | Single 1147-line Context provider | Split into focused hooks (useCart, useProducts, etc.) |
| Data loading | All data fetched upfront (9 parallel queries) | Cursor-based pagination + lazy loading |
| Database | 10 tables (including badges + badge_awards) | — |
| Router | Hash-based (#/path) | Consider react-router with clean URLs |
| TypeScript | No types | Incremental migration with JSDoc or .tsx |
| Tests | None | Add Vitest + React Testing Library |
| CI/CD | None | GitHub Actions + lint + test + deploy |
| Error boundaries | Single global | Per-section boundaries for isolation |
| Optimistic UI | None | Consider TanStack Query for cache + optimistic mutations |
| i18n | Arabic hardcoded strings | Extract to locale files if multi-language needed |
