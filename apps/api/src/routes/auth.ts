import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getAuthUser, requireAuth } from "../middleware/requireAuth.js";

const router = Router();
const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
const allowedRegistrationRoles = ["FARMER", "BUYER"] as const;
const maxOtpAttempts = 5;

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many OTP requests. Try again later." },
});

const phoneSchema = z.string().trim()
  .regex(/^(?:\+?8801[3-9]\d{8}|01[3-9]\d{8})$/, "Enter a valid Bangladesh mobile number.")
  .transform((value) => {
    const digits = value.replace(/^\+/, "");
    return digits.startsWith("880") ? `+${digits}` : `+880${digits.slice(1)}`;
  });

const requestOtpSchema = z.object({ phone: phoneSchema }).strict();
const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "OTP must contain 6 digits."),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(allowedRegistrationRoles).optional(),
}).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", env.JWT_ACCESS_SECRET).update(`otp:${phone}:${code}`).digest("hex");
}

function matchesHash(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createAccessToken(user: { id: string; role: string }): Promise<string> {
  return new SignJWT({ role: user.role, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.JWT_ACCESS_TTL_SECONDS)
    .sign(accessKey);
}

async function createRefreshToken(user: { id: string; role: string }): Promise<string> {
  const token = await new SignJWT({ role: user.role, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.JWT_REFRESH_TTL_SECONDS)
    .sign(refreshKey);

  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
    },
  });
  return token;
}

async function issueTokens(user: { id: string; role: string; name: string; phone: string }) {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(user),
    createRefreshToken(user),
  ]);
  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    user,
  };
}

router.post("/otp/request", otpLimiter, async (request, response) => {
  const { phone } = requestOtpSchema.parse(request.body);
  if (env.OTP_PROVIDER !== "console" || process.env.NODE_ENV === "production") {
    throw new HttpError(503, "OTP delivery is not configured. Console delivery is development-only.");
  }

  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);
  const existingUser = await prisma.user.findUnique({ where: { phone }, select: { id: true, isActive: true } });
  if (existingUser && !existingUser.isActive) throw new HttpError(403, "This account is inactive.");

  await prisma.$transaction([
    prisma.phoneOtpChallenge.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.phoneOtpChallenge.create({
      data: {
        phone,
        userId: existingUser?.id,
        codeHash: hashOtp(phone, code),
        expiresAt,
      },
    }),
  ]);

  console.info(`Development OTP for ${phone}: ${code}`);
  response.status(202).json({
    message: "If the number can sign in, an OTP has been issued.",
    expiresIn: env.OTP_TTL_SECONDS,
  });
});

router.post("/otp/verify", otpLimiter, async (request, response) => {
  const input = verifyOtpSchema.parse(request.body);
  const now = new Date();
  const result = await prisma.$transaction(async (transaction) => {
    const challenge = await transaction.phoneOtpChallenge.findFirst({
      where: { phone: input.phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge || challenge.expiresAt <= now) {
      return { error: { status: 401, message: "The OTP is invalid or expired." } } as const;
    }
    if (challenge.attempts >= maxOtpAttempts) {
      return { error: { status: 429, message: "Too many incorrect OTP attempts. Request a new code." } } as const;
    }
    if (!matchesHash(hashOtp(input.phone, input.code), challenge.codeHash)) {
      const updated = await transaction.phoneOtpChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, attempts: { lt: maxOtpAttempts } },
        data: { attempts: { increment: 1 } },
      });
      return {
        error: updated.count
          ? { status: 401, message: "The OTP is invalid or expired." }
          : { status: 429, message: "Too many incorrect OTP attempts. Request a new code." },
      } as const;
    }

    const existingUser = await transaction.user.findUnique({ where: { phone: input.phone } });
    if (existingUser && !existingUser.isActive) {
      return { error: { status: 403, message: "This account is inactive." } } as const;
    }
    if (!existingUser && (!input.name || !input.role)) {
      return { error: { status: 400, message: "Name and role are required for first-time registration." } } as const;
    }

    const consumed = await transaction.phoneOtpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) {
      return { error: { status: 401, message: "The OTP has already been used or expired." } } as const;
    }

    const user = existingUser
      ? await transaction.user.update({
        where: { id: existingUser.id },
        data: { phoneVerifiedAt: now },
        select: { id: true, role: true, name: true, phone: true },
      })
      : await transaction.user.create({
        data: {
          phone: input.phone,
          name: input.name!,
          role: input.role!,
          phoneVerifiedAt: now,
        },
        select: { id: true, role: true, name: true, phone: true },
      });

    await transaction.phoneOtpChallenge.update({
      where: { id: challenge.id },
      data: { userId: user.id },
    });
    return { user } as const;
  });

  const verifiedUser = "user" in result ? result.user : undefined;
  if (!verifiedUser) {
    if ("error" in result && result.error) {
      throw new HttpError(result.error.status, result.error.message);
    }
    throw new Error("OTP verification completed without a user result.");
  }
  response.status(200).json(await issueTokens(verifiedUser));
});

router.post("/refresh", async (request, response) => {
  const { refreshToken } = refreshSchema.parse(request.body);
  let payload;
  try {
    ({ payload } = await jwtVerify(refreshToken, refreshKey, { algorithms: ["HS256"] }));
  } catch {
    throw new HttpError(401, "The refresh token is invalid or expired.");
  }
  if (payload.typ !== "refresh" || typeof payload.sub !== "string") {
    throw new HttpError(401, "The refresh token is invalid.");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, isActive: true, name: true, phone: true },
  });
  if (!user || !user.isActive) throw new HttpError(401, "The account is inactive or no longer exists.");

  const replacement = await new SignJWT({ role: user.role, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + env.JWT_REFRESH_TTL_SECONDS)
    .sign(refreshKey);
  const now = new Date();
  const rotated = await prisma.$transaction(async (transaction) => {
    const revoked = await transaction.authSession.updateMany({
      where: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });
    if (revoked.count !== 1) return false;
    await transaction.authSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(replacement),
        expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000),
      },
    });
    return true;
  });
  if (!rotated) throw new HttpError(401, "The refresh token has already been used or revoked.");

  response.status(200).json({
    accessToken: await createAccessToken(user),
    refreshToken: replacement,
    tokenType: "Bearer",
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
    user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
  });
});

router.post("/logout", async (request, response) => {
  const { refreshToken } = refreshSchema.parse(request.body);
  let payload;
  try {
    ({ payload } = await jwtVerify(refreshToken, refreshKey, { algorithms: ["HS256"] }));
  } catch {
    throw new HttpError(401, "The refresh token is invalid or expired.");
  }
  if (payload.typ !== "refresh" || typeof payload.sub !== "string") {
    throw new HttpError(401, "The refresh token is invalid.");
  }

  await prisma.authSession.updateMany({
    where: { userId: payload.sub, tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  response.status(204).end();
});

router.get("/me", requireAuth, async (request, response) => {
  const { id } = getAuthUser(request);
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, role: true },
  });
  if (!user) throw new HttpError(401, "The account no longer exists.");
  response.json(user);
});

export default router;
