import { prisma } from "@/lib/prisma";
import { fail, getErrorMessage, ok } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { setSessionCookie, signSessionToken, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const credentials = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { username: credentials.username }
    });

    if (!user) {
      return fail("用户名或密码错误", 401);
    }

    const passwordMatches = await verifyPassword(credentials.password, user.passwordHash);

    if (!passwordMatches) {
      return fail("用户名或密码错误", 401);
    }

    const token = signSessionToken({
      id: user.id,
      username: user.username,
      role: user.role
    });

    await setSessionCookie(token);

    return ok({
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    return fail(getErrorMessage(error));
  }
}
