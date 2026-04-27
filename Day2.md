# Day 2 Detailed Implementation Document

## Day 2 Goal
Day 2 focused on the remaining major rubric features after Day 1:
- Real-time updates using polling fallback
- Email notifications for lead creation and assignment
- Activity timeline (audit trail UI + API)
- Smart follow-up improvements (overdue + stale detection)
- Analytics dashboard enhancement with follow-up insights

This document explains what was implemented, how it works, and why each change was made.

---

## 1) What Was Added on Day 2

### New backend files
- [src/lib/email.ts](src/lib/email.ts)
- [src/lib/email-templates.ts](src/lib/email-templates.ts)
- [src/app/api/leads/[id]/activities/route.ts](src/app/api/leads/[id]/activities/route.ts)

### Updated backend files
- [src/app/api/leads/route.ts](src/app/api/leads/route.ts)
- [src/app/api/leads/[id]/route.ts](src/app/api/leads/[id]/route.ts)
- [src/app/api/leads/[id]/assign/route.ts](src/app/api/leads/[id]/assign/route.ts)
- [.env.example](.env.example)

### Updated frontend files
- [src/components/LeadManager.tsx](src/components/LeadManager.tsx)
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)

### Dependency updates
- nodemailer
- @types/nodemailer

---

## 2) Real-Time Updates (Polling Fallback)

Because WebSocket setup in assignment-level Next.js can add complexity, Day 2 implemented the rubric-allowed polling fallback cleanly.

### Where implemented
- [src/components/LeadManager.tsx](src/components/LeadManager.tsx)

### How it works
1. The component polls leads every 8 seconds.
2. It stores a snapshot of previous lead state (priority, assignedTo, updatedAt).
3. On each poll, it compares old and new snapshots.
4. It detects and notifies about:
   - new leads
   - assignment changes
   - priority changes

### Key code idea

    const poller = window.setInterval(() => {
      void loadLeads({ silent: true, compareLive: true });
    }, 8000);

Snapshot comparison logic tracks update types and shows live status message such as:
- "Live updates: 1 new lead | 1 assignment update"

### Why this satisfies rubric
The rubric accepts polling when WebSocket is not used. UI updates happen without manual refresh, which is the main requirement.

---

## 3) Email Notification System

Day 2 introduced email sending with templates for the two required actions.

### Environment support
Added optional SMTP configuration in:
- [.env.example](.env.example)

Variables:
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- SMTP_SECURE
- SMTP_FROM

### Email service
- [src/lib/email.ts](src/lib/email.ts)

Features:
- `sendEmail(...)` for single recipient
- `sendBulkEmail(...)` for multiple recipients
- If SMTP is not configured, it logs "EMAIL SKIPPED" instead of crashing

This keeps student development smooth while still demonstrating complete integration.

### Templates
- [src/lib/email-templates.ts](src/lib/email-templates.ts)

Added:
- `buildNewLeadEmail(...)`
- `buildLeadAssignedEmail(...)`

Both generate:
- subject
- plain text body
- HTML body

### Trigger points
1. On new lead creation:
- [src/app/api/leads/route.ts](src/app/api/leads/route.ts)
- Sends "new lead" email to admins
- Sends assignment email to agent if lead is assigned at creation

2. On assignment/reassignment:
- [src/app/api/leads/[id]/assign/route.ts](src/app/api/leads/[id]/assign/route.ts)
- Sends assignment email to selected agent

### Example flow snippet

    const newLeadEmail = buildNewLeadEmail({ ... });
    await sendBulkEmail(adminEmails, newLeadEmail);

    const assignmentEmail = buildLeadAssignedEmail({ ... });
    await sendEmail({
      to: assignedAgent.email,
      subject: assignmentEmail.subject,
      html: assignmentEmail.html,
      text: assignmentEmail.text,
    });

---

## 4) Activity Timeline (Audit Trail UI + API)

Day 1 already saved activity logs. Day 2 made this visible to users.

### New API endpoint
- [src/app/api/leads/[id]/activities/route.ts](src/app/api/leads/[id]/activities/route.ts)

### Endpoint behavior
- Auth required
- Access control:
  - Admin can view any lead timeline
  - Agent can view only timeline of assigned lead
- Returns chronological activity list (old to new)
- Populates actor details (name/email)

### Security checks implemented
- Valid ObjectId check
- Lead existence check
- RBAC check before timeline read

### UI integration
- [src/components/LeadManager.tsx](src/components/LeadManager.tsx)

Each lead card now has:
- "View Timeline" button
- Lazy fetch when opened
- Timeline list showing:
  - action message
  - actor
  - timestamp

### Why this matters
This directly satisfies audit trail/timeline rubric expectations and improves demo quality.

---

## 5) Smart Follow-up System Improvements

Day 1 had a simple overdue count. Day 2 made it practical.

### Improvements in lead list
- [src/components/LeadManager.tsx](src/components/LeadManager.tsx)

Implemented:
1. Overdue detection:
- followUpDate < now
- status not Closed/Lost

2. Stale lead detection:
- no activity for 3+ days
- status not Closed/Lost

3. Visual highlighting:
- overdue leads have red-tinted card style
- stale leads have amber-tinted card style

4. Stats shown above list:
- overdue follow-ups count
- stale leads count

### Time updates
A separate timer updates current time every minute so stale/overdue status remains accurate while page stays open.

---

## 6) Dashboard Analytics Enhancements

File:
- [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)

### Added Day 2 analytics cards
- Overdue Follow-ups
- Stale Leads (3+ days)

### Query logic
Counts are filtered by current user scope:
- Admin sees full system counts
- Agent sees only assigned lead counts

Example query shape:

    const overdueCount = await Lead.countDocuments({
      ...baseFilter,
      followUpDate: { $lt: now },
      status: { $nin: ["Closed", "Lost"] },
    });

This keeps analytics role-aware and consistent with RBAC.

---

## 7) Backend Event Quality Improvements

### Update route improvements
- [src/app/api/leads/[id]/route.ts](src/app/api/leads/[id]/route.ts)

In addition to generic `lead.updated`, Day 2 logs specific events when detected:
- `lead.priority_changed`
- `lead.status_changed`

This makes timeline entries more meaningful and supports better reporting in future days.

### Assignment route improvements
- [src/app/api/leads/[id]/assign/route.ts](src/app/api/leads/[id]/assign/route.ts)

Now detects:
- first assignment vs reassignment

Logs either:
- `lead.assigned`
- `lead.reassigned`

This improves audit history clarity.

---

## 8) API Contract Added/Changed on Day 2

### New
- GET /api/leads/:id/activities

### Existing endpoints enhanced
- POST /api/leads
  - now triggers notification emails
- PATCH /api/leads/:id
  - now logs status/priority-specific activity events
- PATCH /api/leads/:id/assign
  - now logs assign vs reassign and sends email

---

## 9) Validation, Stability, and Build Status

### Build validation completed
Both commands passed after Day 2 implementation:
- `npm run lint`
- `npm run build`

### Fixes made during validation
1. Added nodemailer TypeScript typings (`@types/nodemailer`)
2. Removed linter-flagged `Date.now()` usage in dashboard render path and replaced with `now.getTime()` pattern

---

## 10) How to Configure Email for Actual Sending

If you want real emails (instead of skip logs), set SMTP values in your local env.

Example keys (do not use fake values in real deployment):

    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your_email@example.com
    SMTP_PASS=your_app_password
    SMTP_SECURE=false
    SMTP_FROM=Property Dealer CRM <your_email@example.com>

If SMTP is not set:
- API still works
- Emails are safely skipped
- Console logs show what would have been sent

---

## 11) Demo Explanation Script (Day 2)

Use this order when explaining Day 2 in viva/demo:
1. Polling real-time logic and snapshot comparison
2. Timeline API authorization and chronological activity feed
3. Email service architecture and templates
4. Trigger points for new lead and assignment emails
5. Smart follow-up logic (overdue + stale)
6. Dashboard analytics enhancement

This sequence shows clear mapping from business requirement to implementation.

---

## 12) Rubric Coverage After Day 2

Now covered strongly:
- Real-time updates (polling fallback)
- WhatsApp + Email integration
- Lead activity timeline
- Smart follow-up system
- Improved analytics dashboard

Still best for Day 3:
- Optional Socket.io version (bonus upgrade over polling)
- Export to Excel/PDF
- UI polish for report screenshots and deployment/demo package
- Final documentation and commit structuring

---

## 13) Final Day 2 Summary

Day 2 completed all major remaining functional requirements in a student-friendly but industry-structured way: real-time responsiveness through polling, complete email workflow hooks, timeline visibility, and practical follow-up intelligence. The codebase is now much closer to final submission quality and ready for Day 3 polish/bonus work.
