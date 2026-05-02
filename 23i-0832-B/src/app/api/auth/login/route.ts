import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { comparePassword } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/lib/constants";
import { signAuthToken } from "@/lib/jwt";
import { loginSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import User from "@/models/User";

function getIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const ip = getIp(request);
    const rate = checkRateLimit(`login:${ip}`, 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid credentials" },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const firstAdmin = await User.findOne({ role: "admin" }).sort({ createdAt: 1 });
    if (
      user.role === "admin" &&
      firstAdmin &&
      String(firstAdmin._id) !== String(user._id)
    ) {
      user.role = "agent";
      await user.save();
    }

    const isPasswordCorrect = await comparePassword(parsed.data.password, user.password);
    if (!isPasswordCorrect) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signAuthToken({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
