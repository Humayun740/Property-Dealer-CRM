import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { signupSchema } from "@/lib/validators";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }

    await connectDB();

    const existing = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const userCount = await User.countDocuments();
    const role = userCount === 0 ? "admin" : "agent";

    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      password: await hashPassword(parsed.data.password),
      role,
    });

    return NextResponse.json(
      {
        message:
          userCount === 0
            ? "Signup successful. First account created as Admin."
            : "Signup successful. Account created as Agent.",
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Signup route error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
