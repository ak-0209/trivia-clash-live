// middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { Jwt, JwtPayload, verify } from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const rootEnv = path.resolve(process.cwd(), ".env");
const serverEnv = path.resolve(process.cwd(), "server/.env");
const envPath = fs.existsSync(serverEnv) ? serverEnv : rootEnv;

dotenv.config({ path: envPath });

// 🆕 Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: Jwt & JwtPayload;
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "JWT secret not configured" });
  }

  try {
    const decoded = verify(token, secret) as Jwt & JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// 🆕 OPTIONAL: Create host-only middleware
export const requireHost = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Check if user has host privileges (you might need to adjust this based on your JWT structure)
  const isHost = (req.user as any).isHost || (req.user as any).role === "host";

  if (!isHost) {
    return res.status(403).json({ error: "Host access required" });
  }

  next();
};
