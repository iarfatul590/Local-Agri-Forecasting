import { jwtVerify } from "jose";
import type { Request, RequestHandler } from "express";
import type { UserRole } from "../generated/prisma/enums.js";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { HttpError } from "./errorHandler.js";

export type AuthUser = {
  id: string;
  role: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function getAuthUser(request: Request): AuthUser {
  if (!request.user) throw new HttpError(401, "Authentication is required.");
  return request.user;
}

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const authorization = request.header("authorization");
    const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) throw new HttpError(401, "A bearer access token is required.");

    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_ACCESS_SECRET), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string") throw new HttpError(401, "The access token is invalid.");

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new HttpError(401, "The account is inactive or no longer exists.");

    request.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "The access token is invalid or expired."));
  }
};

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    try {
      const user = getAuthUser(request);
      if (!roles.includes(user.role)) throw new HttpError(403, "You do not have permission to perform this action.");
      next();
    } catch (error) {
      next(error);
    }
  };
}
