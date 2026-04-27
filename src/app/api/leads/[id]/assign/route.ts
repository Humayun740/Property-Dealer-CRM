import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getRequestUser, hasRole } from "@/lib/auth";
import { assignLeadSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity";
import { buildLeadAssignedEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import Lead from "@/models/Lead";
import User from "@/models/User";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user.role, ["admin"])) {
    return NextResponse.json({ error: "Only admin can assign leads" }, { status: 403 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = assignLeadSchema.safeParse(body);

  if (!parsed.success || !Types.ObjectId.isValid(parsed.data.assignedTo)) {
    return NextResponse.json({ error: "Invalid assigned user id" }, { status: 400 });
  }

  await connectDB();

  const previousLead = await Lead.findById(id).select("assignedTo name budget propertyInterest priority");

  if (!previousLead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const lead = await Lead.findByIdAndUpdate(
    id,
    { assignedTo: new Types.ObjectId(parsed.data.assignedTo) },
    { new: true },
  ).populate("assignedTo", "name email");

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const assignedAgent = await User.findById(parsed.data.assignedTo).select("name email");
  const action = previousLead.assignedTo ? "lead.reassigned" : "lead.assigned";
  const message = assignedAgent?.name
    ? `Lead ${previousLead.assignedTo ? "reassigned" : "assigned"} to ${assignedAgent.name}`
    : "Lead assignment updated";

  await logActivity({
    leadId: id,
    actorId: user.userId,
    action,
    message,
    meta: { assignedTo: parsed.data.assignedTo },
  });

  if (assignedAgent?.email) {
    const assignmentEmail = buildLeadAssignedEmail({
      agentName: assignedAgent.name,
      leadName: previousLead.name,
      propertyInterest: previousLead.propertyInterest,
      budget: previousLead.budget,
      priority: previousLead.priority,
    });

    await sendEmail({
      to: assignedAgent.email,
      subject: assignmentEmail.subject,
      html: assignmentEmail.html,
      text: assignmentEmail.text,
    });
  }

  return NextResponse.json({ lead });
}
