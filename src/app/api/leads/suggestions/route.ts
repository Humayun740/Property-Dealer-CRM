import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getRequestUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { buildLeadSuggestion } from "@/lib/ai-suggestions";
import Lead from "@/models/Lead";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const idsParam = request.nextUrl.searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").filter((id) => Types.ObjectId.isValid(id))
    : [];

  const filter: Record<string, unknown> = {};

  if (user.role !== "admin") {
    filter.assignedTo = new Types.ObjectId(user.userId);
  }

  if (ids.length > 0) {
    filter._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
  }

  const leads = await Lead.find(filter).select(
    "name status priority budget followUpDate lastActivityAt",
  );

  const suggestions = leads.reduce<Record<string, ReturnType<typeof buildLeadSuggestion>>>(
    (acc, lead) => {
      acc[String(lead._id)] = buildLeadSuggestion({
        name: lead.name,
        status: lead.status,
        priority: lead.priority,
        budget: lead.budget,
        followUpDate: lead.followUpDate,
        lastActivityAt: lead.lastActivityAt,
      });

      return acc;
    },
    {},
  );

  return NextResponse.json({ suggestions });
}
