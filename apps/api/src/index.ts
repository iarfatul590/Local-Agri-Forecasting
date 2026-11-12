import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createServer } from "node:http";
import { Server } from "socket.io";

const port = Number(process.env.PORT ?? 4000);
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_ORIGIN?.split(",") ?? "http://localhost:8081"
  }
});

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN?.split(",") ?? "http://localhost:8081" }));
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "agri-link-api" });
});

io.on("connection", (socket) => {
  socket.emit("connection:ready", { connected: true });
});

httpServer.listen(port, () => {
  console.info(`Agri Link API listening on port ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    httpServer.close((error) => {
      if (error) {
        console.error("Failed to close the HTTP server cleanly", error);
        process.exitCode = 1;
      }
      io.close();
    });
  });
}
