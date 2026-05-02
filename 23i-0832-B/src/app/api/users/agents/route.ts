import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getRequestUser, hasRole } from "@/lib/auth";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user.role, ["admin"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const agents = await User.find({ role: "agent" }).select("name email");
  return NextResponse.json({ agents });
}
