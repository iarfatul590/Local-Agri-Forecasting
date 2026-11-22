import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  public readonly status: number;

  constructor(
    status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function prismaCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = error.code;
  return typeof code === "string" ? code : undefined;
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, "Route not found."));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Request validation failed.",
      details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  const code = prismaCode(error);
  if (code === "P2002") {
    response.status(409).json({ error: "A record with the same unique value already exists." });
    return;
  }
  if (code === "P2025") {
    response.status(404).json({ error: "The requested record was not found." });
    return;
  }
  if (code === "P2003") {
    response.status(400).json({ error: "A referenced record does not exist or cannot be changed." });
    return;
  }

  if (error && typeof error === "object" && "type" in error && error.type === "entity.parse.failed") {
    response.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }

  console.error("Unhandled API error", error);
  response.status(500).json({ error: "An unexpected server error occurred." });
};
