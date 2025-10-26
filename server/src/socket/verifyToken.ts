// server/socket/verifyToken.ts
import jwt from "jsonwebtoken";
import Users from "../models/Users"; // adjust path if your Users model lives elsewhere

type VerifiedUser = { id: string; name?: string } | null;

/**
 * parseCookie - tiny cookie parser to read a cookie by name from `cookie` header string
 */
function parseCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const c of cookies) {
    const [k, ...v] = c.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * verifyToken
 * - Accepts a token string (JWT) or null.
 * - Verifies jwt using process.env.JWT_SECRET and returns { id, name } or null.
 * - If no token provided, callers can call this after extracting cookie.
 */
export default async function verifyToken(
  token?: string | null,
  cookieHeader?: string | undefined,
): Promise<VerifiedUser> {
  try {
    // prefer explicit token
    let t = token ?? null;

    // fallback: if no token passed, try cookie header named 'wsToken'
    if (!t && cookieHeader) {
      const cookieToken = parseCookie(cookieHeader, "wsToken");
      if (cookieToken) t = cookieToken;
    }

    if (!t) return null;

    const secret = process.env.JWT_SECRET ?? "";
    if (!secret) {
      console.warn("[verifyToken] JWT_SECRET not set");
      return null;
    }

    // jwt.verify throws if invalid/expired
    const payload = jwt.verify(t, secret) as any;
    const userId = payload._id || payload.id || payload.sub;
    if (!userId) return null;

    // fetch user from DB to ensure user still exists; select minimal fields
    const user = await Users.findById(userId)
      .select("_id displayName emailId")
      .lean();
    if (!user) return null;

    const name =
      (user as any).displayName ||
      (user as any).emailId ||
      `Player-${String(user._id).slice(-6)}`;
    return { id: String(user._id), name };
  } catch (err) {
    // invalid / expired / DB error -> treat as unauthenticated
    return null;
  }
}
