import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
// @ts-ignore
import xss from "xss-clean";

import authRoutes from "./src/server/routes/auth";
import repositoryRoutes from "./src/server/routes/repositories";
import { initQdrant } from "./src/server/services/qdrant.service";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust reverse proxy for rate limiting properly
  app.set('trust proxy', 1);

  // Security Middleware Layer
  app.use(helmet({
    contentSecurityPolicy: false, // disabled for Vite HMR and dev environment
    crossOriginEmbedderPolicy: false
  }));

  // Limit request from same API
  const limiter = rateLimit({
    max: 500,
    windowMs: 15 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in 15 minutes!',
    validate: { xForwardedForHeader: false, default: true }
  });
  app.use('/api', limiter);

  // Body parser with size limits
  app.use(express.json({ limit: '10mb' }));

  // Data sanitization against NoSQL query injection
  app.use(mongoSanitize());

  // Data sanitization against XSS
  app.use(xss());

  // Init Vector DB
  await initQdrant();

  // Connect to MongoDB
  const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/repolens";
  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(MONGO_URI);
      console.log("Connected to MongoDB");
    } else {
      console.log("MONGO_URI not provided. Please provide it to connect to MongoDB.");
    }
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }

  // API routes FIRST
  app.use("/api/auth", authRoutes);
  app.use("/api/repositories", repositoryRoutes);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Catch non-existent API routes so they don't fall through to Vite SPA
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API Route Not Found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = Object.keys(process.versions).includes('node') ? path.join(process.cwd(), 'dist') : '';
    if(distPath) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
