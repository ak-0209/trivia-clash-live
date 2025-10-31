import express from "express";
import cors from "cors";
import http from "http";
import mongoose from "mongoose";
import TriviaSocket from "./socket/triviaSocket";

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import lobbyRoutes from "./routes/lobby";
import questionRoutes from "./routes/questionRoutes";

const rootEnv = path.resolve(process.cwd(), ".env"); // repo root .env
const serverEnv = path.resolve(process.cwd(), "server/.env"); // server/.env if you keep it there

// Prefer server/.env if it exists, otherwise use root .env
const envPath = fs.existsSync(serverEnv) ? serverEnv : rootEnv;

console.log("Loading env from:", envPath);
dotenv.config({ path: envPath });

// OPTIONAL debug (remove before production): show whether JWT is loaded
console.log("JWT_SECRET present:", Boolean(process.env.JWT_SECRET));

const app = express();

// Configure CORS properly for credentials
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 🆕 ADD THESE ROUTE IMPORTS

// 🆕 MOUNT THE ROUTES
app.use("/api/lobbies", lobbyRoutes);
app.use("/api/questions", questionRoutes);

app.get("/api/health", (_req: express.Request, res: express.Response) =>
  res.json({ status: "ok" }),
);

const PORT = process.env.PORT || 3000;

// MongoDB connection function
const connectDB = async () => {
  try {
    // Use MONGO_URI from your .env file
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/liveTrivia";

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as mongoose.ConnectOptions);

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Start server function
const startServer = async () => {
  try {
    // Connect to database first
    console.log("JWT_SECRET:", process.env.JWT_SECRET);
    await connectDB();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket server AFTER database connection
    console.log("Initializing WebSocket server...");
    new TriviaSocket(server);

    server.listen(PORT, () => {
      console.log(`✅ HTTP & WebSocket Server listening on ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
