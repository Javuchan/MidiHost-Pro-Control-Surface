import express from "express";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = process.env.PORT || 3000;
  const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT !== undefined;

  console.log(`Starting server in ${isProduction ? 'production' : 'development'} mode...`);
  console.log(`Port: ${PORT}`);
  console.log(`CWD: ${process.cwd()}`);

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    const distPath = path.join(process.cwd(), "dist");
    const indexExists = fs.existsSync(path.join(distPath, "index.html"));
    res.json({
      status: "ok",
      env: isProduction ? 'production' : 'development',
      railway: !!process.env.RAILWAY_ENVIRONMENT,
      port: PORT,
      cwd: process.cwd(),
      distExists: fs.existsSync(distPath),
      indexExists: indexExists,
      timestamp: new Date().toISOString()
    });
  });

  // Socket.IO logic
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-room", (roomCode) => {
      socket.join(roomCode);
      console.log(`Socket ${socket.id} joined room ${roomCode}`);
    });

    socket.on("host-state-update", (data) => {
      // Broadcast state to all clients in the room except the host
      socket.to(data.roomCode).emit("remote-state-update", data.state);
    });

    socket.on("request-state", (roomCode) => {
      socket.to(roomCode).emit("state-requested");
    });

    socket.on("remote-control-change", (data) => {
      // Send control changes from remote to host
      socket.to(data.roomCode).emit("host-control-change", data.change);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (!isProduction) {
    console.log("Loading Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found. Please ensure "npm run build" has completed.');
      }
    });
  }

  try {
    server.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server successfully started and listening on 0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer().catch(err => {
  console.error("Async startServer failed:", err);
  process.exit(1);
});
