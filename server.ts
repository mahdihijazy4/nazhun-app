import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || 'development' });
  });

  // Cache-Control for CDN Media Delivery Layer
  app.use("/uploads", (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(uploadsDir, {
    maxAge: '24h', // Aggressive caching, 24 hours
    immutable: true // Zero repeated downloads for identical media
  }));

  // Auto-Deletion System for ephemeral files
  // Periodically deletes files older than 24 hours
  setInterval(() => {
    fs.readdir(uploadsDir, (err, files) => {
      if (err) return console.error("Auto-delete read dir error:", err);
      const now = Date.now();
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          // Delete files older than 24 hours (86400000 ms)
          if (now - stats.mtimeMs > 86400000) {
            fs.unlink(filePath, err => {
              if (err) console.error("Failed to delete expired file:", filePath);
              else console.log("Auto-deleted expired media:", filePath);
            });
          }
        });
      });
    });
  }, 1000 * 60 * 60); // Run check every hour

  // Upload endpoint
  app.post("/api/upload", (req, res, next) => {
    console.log("--- UPLOAD ATTEMPT ---");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    upload.single("file")(req, res, (err) => {
      if (err) {
        console.error("Multer error detail:", err);
        return res.status(500).json({ error: err.message || "Multer upload failed" });
      }
      console.log("File uploaded successfully to memory/temp:", req.file?.filename);
      next();
    });
  }, (req, res) => {
    if (!req.file) {
      console.error("No file in request after multer");
      return res.status(400).json({ error: "No file context found in request" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    console.log("Returning URL:", fileUrl);
    res.json({ url: fileUrl });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Server Error:", err);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ error: err.message || "Internal Server Error" });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
