import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getRequestUser, hasRole } from "@/lib/auth";
import { assignLeadSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity";
import Lead from "@/models/Lead";

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

  const lead = await Lead.findByIdAndUpdate(
    id,
    { assignedTo: new Types.ObjectId(parsed.data.assignedTo) },
    { new: true },
  ).populate("assignedTo", "name email");

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await logActivity({
    leadId: id,
    actorId: user.userId,
    action: "lead.assigned",
    message: `Lead assigned to ${lead.assignedTo ? "agent" : "no one"}`,
    meta: { assignedTo: parsed.data.assignedTo },
  });

  return NextResponse.json({ lead });
}
