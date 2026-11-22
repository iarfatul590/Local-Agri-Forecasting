import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { env, isAllowedWebOrigin } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.js";
import buyersRouter from "./routes/buyers.js";
import collectionRouter from "./routes/collection.js";
import cropsRouter from "./routes/crops.js";
import demandsRouter from "./routes/demands.js";
import farmersRouter from "./routes/farmers.js";
import upazilasRouter from "./routes/upazilas.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedWebOrigin(origin)),
  }
});

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedWebOrigin(origin)),
}));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "agri-link-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/farmers", farmersRouter);
app.use("/api/crops", cropsRouter);
app.use("/api/buyers", buyersRouter);
app.use("/api/demands", demandsRouter);
app.use("/api/collection", collectionRouter);
app.use("/api/upazilas", upazilasRouter);
app.use(notFoundHandler);
app.use(errorHandler);

io.on("connection", (socket) => {
  socket.emit("connection:ready", { connected: true });
});

httpServer.listen(env.PORT, () => {
  console.info(`Agri Link API listening on port ${env.PORT}`);
});

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    httpServer.close((error) => {
      if (error) {
        console.error("Failed to close the HTTP server cleanly", error);
        process.exitCode = 1;
      }
      io.close();
      void prisma.$disconnect().catch((disconnectError: unknown) => {
        console.error("Failed to disconnect Prisma cleanly", disconnectError);
        process.exitCode = 1;
      });
    });
  });
}
