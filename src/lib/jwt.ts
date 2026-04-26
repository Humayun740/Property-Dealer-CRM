import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@/lib/constants";

export type AuthTokenPayload = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: AuthTokenPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());

  return {
    userId: String(payload.userId),
    name: String(payload.name),
    email: String(payload.email),
    role: payload.role as UserRole,
  } as AuthTokenPayload;
}
