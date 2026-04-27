import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getRequestUser, hasRole } from "@/lib/auth";
import Lead from "@/models/Lead";
import ActivityLog from "@/models/ActivityLog";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  await connectDB();
  const lead = await Lead.findById(id).select("assignedTo");

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const isAdmin = hasRole(user.role, ["admin"]);
  const isAssignedAgent = String(lead.assignedTo) === user.userId;

  if (!isAdmin && !isAssignedAgent) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activities = await ActivityLog.find({ leadId: id })
    .populate("actorId", "name email role")
    .sort({ createdAt: 1 })
    .limit(200);

  return NextResponse.json({ activities });
}
