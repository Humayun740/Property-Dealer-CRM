import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getRequestUser, hasRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { updateLeadSchema } from "@/lib/validators";
import { logActivity } from "@/lib/activity";
import Lead from "@/models/Lead";

type Params = {
  params: Promise<{ id: string }>;
};

function getRateKey(userId: string, role: string) {
  const limit = role === "agent" ? 50 : 500;
  return { key: `leads:${userId}`, limit };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateInfo = getRateKey(user.userId, user.role);
  const rate = checkRateLimit(rateInfo.key, rateInfo.limit, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updateLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid data" },
      { status: 400 },
    );
  }

  await connectDB();
  const lead = await Lead.findById(id);

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const isAdmin = hasRole(user.role, ["admin"]);
  const isAssignedAgent = String(lead.assignedTo) === user.userId;

  if (!isAdmin && !isAssignedAgent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updateData = { ...parsed.data };
  const previousPriority = lead.priority;
  const previousStatus = lead.status;

  if (!isAdmin) {
    delete updateData.assignedTo;
  }

  if (updateData.assignedTo) {
    updateData.assignedTo = new Types.ObjectId(updateData.assignedTo) as never;
  }

  const updatedLead = await Lead.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate("assignedTo", "name email");

  await logActivity({
    leadId: id,
    actorId: user.userId,
    action: "lead.updated",
    message: "Lead details updated",
    meta: parsed.data,
  });

  if (updatedLead && previousPriority !== updatedLead.priority) {
    await logActivity({
      leadId: id,
      actorId: user.userId,
      action: "lead.priority_changed",
      message: `Lead priority changed from ${previousPriority} to ${updatedLead.priority}`,
      meta: {
        from: previousPriority,
        to: updatedLead.priority,
      },
    });
  }

  if (updatedLead && previousStatus !== updatedLead.status) {
    await logActivity({
      leadId: id,
      actorId: user.userId,
      action: "lead.status_changed",
      message: `Lead status changed from ${previousStatus} to ${updatedLead.status}`,
      meta: {
        from: previousStatus,
        to: updatedLead.status,
      },
    });
  }

  return NextResponse.json({ lead: updatedLead });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user.role, ["admin"])) {
    return NextResponse.json({ error: "Only admin can delete leads" }, { status: 403 });
  }

  const rateInfo = getRateKey(user.userId, user.role);
  const rate = checkRateLimit(rateInfo.key, rateInfo.limit, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  await connectDB();
  const deleted = await Lead.findByIdAndDelete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await logActivity({
    leadId: id,
    actorId: user.userId,
    action: "lead.deleted",
    message: "Lead deleted",
  });

  return NextResponse.json({ message: "Lead deleted" });
}
