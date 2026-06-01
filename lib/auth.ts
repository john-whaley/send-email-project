import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "session";
const ONE_WEEK = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: number;
  username: string;
  role: Role;
};

type SessionPayload = SessionUser & {
  iat: number;
  exp: number;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signSessionToken(user: SessionUser) {
  return jwt.sign(user, getJwtSecret(), { expiresIn: ONE_WEEK });
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as SessionPayload;
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK,
    path: "/"
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = verifySessionToken(token);

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, role: true }
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== Role.ADMIN) {
    redirect("/dashboard");
  }

  return user;
}

export function assertAdmin(user: SessionUser | null) {
  if (!user || user.role !== Role.ADMIN) {
    throw new Response("Forbidden", { status: 403 });
  }
}
