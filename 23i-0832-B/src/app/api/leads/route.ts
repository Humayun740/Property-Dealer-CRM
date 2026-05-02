import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getRequestUser, hasRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLeadSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity";
import { buildLeadAssignedEmail, buildNewLeadEmail } from "@/lib/email-templates";
import { sendBulkEmail, sendEmail } from "@/lib/email";
import Lead from "@/models/Lead";
import User from "@/models/User";

function getRateKey(userId: string, role: string) {
  const limit = role === "agent" ? 50 : 500;
  return { key: `leads:${userId}`, limit };
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateInfo = getRateKey(user.userId, user.role);
  const rate = checkRateLimit(rateInfo.key, rateInfo.limit, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  await connectDB();

  const status = request.nextUrl.searchParams.get("status");
  const priority = request.nextUrl.searchParams.get("priority");
  const query = request.nextUrl.searchParams.get("q");

  const filter: Record<string, unknown> = {};

  if (user.role !== "admin") {
    filter.assignedTo = new Types.ObjectId(user.userId);
  }

  if (status) {
    filter.status = status;
  }

  if (priority) {
    filter.priority = priority;
  }

  if (query) {
    filter.$or = [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
      { propertyInterest: { $regex: query, $options: "i" } },
    ];
  }

  const leads = await Lead.find(filter)
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 });

  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user.role, ["admin"])) {
    return NextResponse.json({ error: "Only admin can create leads" }, { status: 403 });
  }

  const rateInfo = getRateKey(user.userId, user.role);
  const rate = checkRateLimit(rateInfo.key, rateInfo.limit, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid lead data" },
      { status: 400 },
    );
  }

  await connectDB();

  const lead = await Lead.create({
    ...parsed.data,
    assignedTo: parsed.data.assignedTo
      ? new Types.ObjectId(parsed.data.assignedTo)
      : null,
    createdBy: new Types.ObjectId(user.userId),
  });

  await logActivity({
    leadId: String(lead._id),
    actorId: user.userId,
    action: "lead.created",
    message: `Lead created with ${lead.priority} priority`,
    meta: { score: lead.score, priority: lead.priority },
  });

  const leadWithAssignee = await Lead.findById(lead._id).populate(
    "assignedTo",
    "name email",
  );

  const adminUsers = await User.find({ role: "admin" }).select("email");
  const adminEmails = adminUsers.map((item) => item.email).filter(Boolean);

  const newLeadEmail = buildNewLeadEmail({
    leadName: lead.name,
    propertyInterest: lead.propertyInterest,
    budget: lead.budget,
    priority: lead.priority,
    source: lead.source,
  });

  await sendBulkEmail(adminEmails, newLeadEmail);

  if (parsed.data.assignedTo) {
    const assignedUser = await User.findById(parsed.data.assignedTo).select("name email");

    if (assignedUser?.email) {
      const assignmentEmail = buildLeadAssignedEmail({
        agentName: assignedUser.name,
        leadName: lead.name,
        propertyInterest: lead.propertyInterest,
        budget: lead.budget,
        priority: lead.priority,
      });

      await sendEmail({
        to: assignedUser.email,
        subject: assignmentEmail.subject,
        html: assignmentEmail.html,
        text: assignmentEmail.text,
      });
    }
  }

  return NextResponse.json({ lead: leadWithAssignee }, { status: 201 });
}
