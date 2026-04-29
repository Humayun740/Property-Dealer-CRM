import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, type UserRole } from "@/lib/constants";
import { verifyAuthToken } from "@/lib/jwt";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function getRequestUser(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAuthToken(token);
    await connectDB();
    const user = await User.findById(payload.userId).select("name email role");

    if (!user) {
      return null;
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

    return {
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function getServerUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAuthToken(token);
    await connectDB();
    const user = await User.findById(payload.userId).select("name email role");

    if (!user) {
      return null;
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

    return {
      userId: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
    };
  } catch {
    return null;
  }
}

export function hasRole(role: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(role);
}
