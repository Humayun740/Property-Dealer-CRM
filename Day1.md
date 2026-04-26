# Day 1 Detailed Implementation Document

## Project Context
This document explains what was implemented on Day 1 for the Property Dealer CRM assignment, why each part was built, and how the code works.

The Day 1 focus was:
- Set up the full-stack Next.js app
- Add MongoDB integration with Mongoose
- Build authentication and authorization (RBAC)
- Implement lead management basics (CRUD + scoring)
- Build initial dashboards and pages
- Add activity logging and follow-up basics
- Add rate limiting and WhatsApp click-to-chat

---

## 1) Setup and Dependencies

### What was done
A new Next.js App Router project was created and backend dependencies were installed:
- mongoose
- bcryptjs
- jose
- zod

### Why these packages
- mongoose: schema-driven access to MongoDB
- bcryptjs: hash and verify passwords
- jose: sign and verify JWT securely
- zod: input validation for API safety

### Environment variables
Two required env values were defined:
- MONGODB_URI
- JWT_SECRET

Reference file:
- [.env.example](.env.example)

Important runtime note:
- Next.js loads environment values from .env.local (and .env), not from .env.example.

---

## 2) High-Level Architecture

### Application layers
1. UI Layer (pages + components)
2. API Layer (App Router route handlers)
3. Service/Utility Layer (auth, db, validation, scoring)
4. Data Layer (Mongoose models)

### Main directories used
- [src/app](src/app)
- [src/app/api](src/app/api)
- [src/lib](src/lib)
- [src/models](src/models)
- [src/components](src/components)

### Request flow example (Create Lead)
1. Admin submits lead form in UI
2. UI sends POST request to /api/leads
3. API validates input with Zod
4. API checks auth and role
5. API writes lead to MongoDB via Mongoose
6. Lead model auto-calculates priority and score
7. API writes activity log
8. API returns created lead to UI
9. UI updates list

---

## 3) Database Design (Day 1)

### User model
File:
- [src/models/User.ts](src/models/User.ts)

Fields:
- name
- email (unique)
- password (hashed)
- role (admin or agent)
- timestamps

### Lead model
File:
- [src/models/Lead.ts](src/models/Lead.ts)

Fields implemented (matching rubric core + practical additions):
- name
- email
- phone
- source
- propertyInterest
- budget
- status
- notes
- assignedTo
- createdBy
- score
- priority
- followUpDate
- lastActivityAt
- createdAt / updatedAt

### ActivityLog model
File:
- [src/models/ActivityLog.ts](src/models/ActivityLog.ts)

Fields:
- leadId
- actorId
- action
- message
- meta
- timestamps

Purpose:
- Save timeline/audit events for lead actions

---

## 4) Authentication and Session Flow

### Core utility files
- [src/lib/auth.ts](src/lib/auth.ts)
- [src/lib/jwt.ts](src/lib/jwt.ts)
- [src/lib/constants.ts](src/lib/constants.ts)

### How signup works
Endpoint:
- [src/app/api/auth/signup/route.ts](src/app/api/auth/signup/route.ts)

Flow:
1. Parse request body
2. Validate with signupSchema
3. Connect DB
4. Check duplicate email
5. Count existing users
6. Assign role:
   - first user becomes admin
   - next users become agent
7. Hash password with bcrypt
8. Save user
9. Return success response

Code example:

    const userCount = await User.countDocuments();
    const role = userCount === 0 ? "admin" : "agent";

    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      password: await hashPassword(parsed.data.password),
      role,
    });

### How login works
Endpoint:
- [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts)

Flow:
1. Rate-limit by IP
2. Validate body
3. Find user by email
4. Compare password hash
5. Sign JWT
6. Store JWT in secure httpOnly cookie

Code example:

    const token = await signAuthToken({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

### Current-user check and logout
- [src/app/api/auth/me/route.ts](src/app/api/auth/me/route.ts)
- [src/app/api/auth/logout/route.ts](src/app/api/auth/logout/route.ts)

---

## 5) RBAC (Role-Based Access Control)

### Role checks
Role helper:
- [src/lib/auth.ts](src/lib/auth.ts)

Code example:

    export function hasRole(role: UserRole, allowedRoles: UserRole[]) {
      return allowedRoles.includes(role);
    }

### Route-level authorization behavior
- Admin only:
  - Create lead
  - Delete lead
  - Assign/reassign lead
  - List all agents
- Agent:
  - Can only see assigned leads
  - Can update only assigned lead records

Primary API files:
- [src/app/api/leads/route.ts](src/app/api/leads/route.ts)
- [src/app/api/leads/[id]/route.ts](src/app/api/leads/[id]/route.ts)
- [src/app/api/leads/[id]/assign/route.ts](src/app/api/leads/[id]/assign/route.ts)
- [src/app/api/users/agents/route.ts](src/app/api/users/agents/route.ts)

---

## 6) Validation Middleware Pattern (Zod)

Validation schemas are centralized in:
- [src/lib/validators.ts](src/lib/validators.ts)

Implemented schemas:
- signupSchema
- loginSchema
- createLeadSchema
- updateLeadSchema
- assignLeadSchema

Why this helps:
- Prevent invalid data from entering DB
- Return clear error messages
- Keep route handlers clean and consistent

Code example:

    const parsed = createLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid lead data" },
        { status: 400 },
      );
    }

---

## 7) Lead Scoring Logic

Scoring utility:
- [src/lib/scoring.ts](src/lib/scoring.ts)

Rules implemented:
- budget > 20,000,000 => High, score 90
- budget >= 10,000,000 => Medium, score 60
- budget < 10,000,000 => Low, score 30

Model middleware auto-applies score/priority:
- [src/models/Lead.ts](src/models/Lead.ts)

Code example:

    leadSchema.pre("validate", function preValidate() {
      if (typeof this.budget === "number") {
        const { priority, score } = getLeadPriorityAndScore(this.budget);
        this.priority = priority;
        this.score = score;
      }

      this.lastActivityAt = new Date();
    });

This ensures scoring happens on backend and cannot be spoofed by client.

---

## 8) Lead CRUD and Filtering

Main route:
- [src/app/api/leads/route.ts](src/app/api/leads/route.ts)

### GET /api/leads
Implemented features:
- Auth required
- Rate limit applied
- Agent sees only assigned leads
- Optional filtering by:
  - status
  - priority
  - search query (name/email/propertyInterest)

### POST /api/leads
Implemented features:
- Admin only
- Validates payload
- Creates lead with creator ID
- Optional assignment at creation
- Logs activity

### PATCH/DELETE /api/leads/[id]
File:
- [src/app/api/leads/[id]/route.ts](src/app/api/leads/[id]/route.ts)

Implemented features:
- PATCH:
  - Admin can update all allowed fields
  - Agent can update only if assigned
  - Agent cannot reassign lead
- DELETE:
  - Admin only

### Assign/Reassign route
- [src/app/api/leads/[id]/assign/route.ts](src/app/api/leads/[id]/assign/route.ts)

PATCH route implemented for admin assignment.

---

## 9) Activity Logging (Audit Trail Foundation)

Utility:
- [src/lib/activity.ts](src/lib/activity.ts)

Model:
- [src/models/ActivityLog.ts](src/models/ActivityLog.ts)

Events currently logged:
- lead.created
- lead.updated
- lead.assigned
- lead.deleted

Example call:

    await logActivity({
      leadId: String(lead._id),
      actorId: user.userId,
      action: "lead.created",
      message: `Lead created with ${lead.priority} priority`,
      meta: { score: lead.score, priority: lead.priority },
    });

This sets up the timeline backend needed for Day 2 UI timeline display.

---

## 10) Rate Limiting

File:
- [src/lib/rate-limit.ts](src/lib/rate-limit.ts)

Current implementation:
- In-memory bucket map
- Window-based limit check
- Agent limit is stricter on lead APIs (50/min)
- Admin limit is relaxed (500/min)

Note:
- This is sufficient for assignment/demo level in single-instance dev.
- For production/multi-instance deployment, use Redis or shared storage.

---

## 11) UI Work Done

### Home page
- [src/app/page.tsx](src/app/page.tsx)

Updated from starter template to project landing page.

### Auth pages
- [src/app/(auth)/signup/page.tsx](src/app/(auth)/signup/page.tsx)
- [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx)

Features:
- Form state and submission handling
- Error/success messages
- Redirect after successful actions

### Dashboard shell and pages
- [src/app/(dashboard)/dashboard/layout.tsx](src/app/(dashboard)/dashboard/layout.tsx)
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)
- [src/app/(dashboard)/dashboard/leads/page.tsx](src/app/(dashboard)/dashboard/leads/page.tsx)

Features:
- Protected layout (redirect to login if no session)
- Admin analytics cards and status/priority aggregation
- Lead management page

### Lead manager component
- [src/components/LeadManager.tsx](src/components/LeadManager.tsx)

Implemented UI behavior:
- Admin lead creation form
- Filter controls
- Lead status update
- Follow-up date editing
- Notes update on blur
- Assignment dropdown (admin)
- Delete action (admin)
- WhatsApp click-to-chat link using sanitized number
- Overdue follow-up count

### Logout button
- [src/components/LogoutButton.tsx](src/components/LogoutButton.tsx)

---

## 12) Analytics Implemented on Day 1

Dashboard data now includes:
- Total leads
- Priority distribution (High, Medium, Low)
- Status distribution
- Agent performance (count by assigned agent)

File:
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)

Aggregation style used:

    const statusAgg = await Lead.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

---

## 13) WhatsApp Integration

Implemented in lead UI by generating:
- https://wa.me/<number>

Sanitization used:

    href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}

This strips non-digits before creating the link.

---

## 14) Build, Lint, and Debugging Work

### Build/lint fixes completed
- Fixed TypeScript issue in DB connector by ensuring Mongo URI is required at runtime
- Fixed Mongoose pre-hook typing issue by using promise-style middleware
- Fixed hook purity and state-in-effect lint warnings in LeadManager
- Final status: lint passed, production build passed

### Signup 500 debugging status
A runtime 500 occurred during signup testing. Two important findings:
1. Environment values were initially edited in .env.example, but runtime needs .env.local
2. There was a local Next dev server/process conflict and Windows file-lock around .next in logs

Applied improvements:
- Added .env.local with required values
- Added explicit console error logging in signup catch block

Relevant files:
- [src/app/api/auth/signup/route.ts](src/app/api/auth/signup/route.ts)
- [dev.err.log](dev.err.log)
- [dev.out.log](dev.out.log)

---

## 15) API Summary (Day 1)

Auth:
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

Users:
- GET /api/users/agents (admin)

Leads:
- GET /api/leads
- POST /api/leads (admin)
- PATCH /api/leads/:id
- DELETE /api/leads/:id (admin)
- PATCH /api/leads/:id/assign (admin)

---

## 16) Example API Calls for Understanding

### Signup

    POST /api/auth/signup
    {
      "name": "Ali Khan",
      "email": "ali@example.com",
      "password": "password123"
    }

### Login

    POST /api/auth/login
    {
      "email": "ali@example.com",
      "password": "password123"
    }

### Create lead (admin)

    POST /api/leads
    {
      "name": "Client A",
      "email": "clienta@example.com",
      "phone": "923001112233",
      "source": "Facebook Ads",
      "propertyInterest": "5 Marla Plot",
      "budget": 25000000,
      "notes": "Interested in DHA",
      "assignedTo": "<agent-id>"
    }

### Update lead status

    PATCH /api/leads/<lead-id>
    {
      "status": "Contacted"
    }

### Assign lead

    PATCH /api/leads/<lead-id>/assign
    {
      "assignedTo": "<agent-id>"
    }

---

## 17) What Was Achieved Against Rubric (Day 1)

Covered now:
- Authentication core
- RBAC core
- Lead CRUD core
- Lead scoring backend logic
- Assignment system core
- Dashboard analytics baseline
- WhatsApp integration
- Activity log backend foundation
- Follow-up baseline
- Validation and auth checks in routes
- Rate limiting baseline

Partially left for next days:
- Real-time updates via Socket.io or polling
- Email notifications (new lead, assignment)
- Full activity timeline page UI
- More advanced analytics charts and polish
- Optional bonus exports/AI suggestions

---

## 18) What to Explain in Your Demo

If asked in viva/demo, explain in this sequence:
1. Architecture layers and folder structure
2. Auth flow from signup/login to cookie session
3. RBAC decision points in API routes
4. Why scoring is in backend/model middleware
5. How lead CRUD and assignment are protected
6. How activity logging enables audit timeline
7. How dashboard numbers are aggregated with MongoDB
8. Current limitations and Day 2/Day 3 roadmap

---

## 19) Quick Run Checklist

1. Ensure MongoDB server is running
2. Confirm .env.local has MONGODB_URI and JWT_SECRET
3. Start one dev server only
4. Open app and create first user (becomes admin)
5. Create another user (agent)
6. Login as admin and create/assign leads
7. Login as agent and verify restricted visibility

---

## 20) Final Day 1 Conclusion
Day 1 successfully established a working full-stack CRM foundation aligned with the assignment rubric. The project now has secure authentication, role-based access, database-backed lead workflows, backend scoring logic, initial analytics, and an extendable architecture for Day 2 and Day 3 features.
