import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "bus_lines.json");

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/lines", (req, res) => {
    try {
      const activeOnly = req.query.active === "true";
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      let lines = JSON.parse(data);
      if (activeOnly) {
        lines = lines.filter((l: any) => l.isActive);
      }
      res.json(lines);
    } catch (error) {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.post("/api/lines", (req, res) => {
    try {
      const newLine = req.body;
      if (!newLine.routeId) return res.status(400).json({ error: "routeId is required" });
      
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      let lines = JSON.parse(data);
      
      // Check if exists, update if so, else push
      const index = lines.findIndex((l: any) => l.routeId === newLine.routeId);
      if (index !== -1) {
        lines[index] = { ...lines[index], ...newLine };
      } else {
        lines.push(newLine);
      }
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(lines, null, 2));
      res.status(201).json(newLine);
    } catch (error) {
      res.status(500).json({ error: "Failed to save data" });
    }
  });

  app.post("/api/lines/bulk", (req, res) => {
    try {
      const newLines = req.body;
      if (!Array.isArray(newLines)) return res.status(400).json({ error: "Expected array" });
      
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      let lines = JSON.parse(data);
      
      newLines.forEach(newLine => {
        const index = lines.findIndex((l: any) => l.routeId === newLine.routeId);
        if (index !== -1) {
          // Update existing, but keep price and isActive if not provided in bulk
          lines[index] = { ...lines[index], ...newLine };
        } else {
          lines.push({
            price: 4.30,
            isActive: false,
            ...newLine
          });
        }
      });
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(lines, null, 2));
      res.status(201).json({ count: newLines.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to save bulk data" });
    }
  });

  app.delete("/api/lines/:routeId", (req, res) => {
    try {
      const routeId = req.params.routeId;
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      let lines = JSON.parse(data);
      lines = lines.filter((l: any) => l.routeId !== routeId);
      fs.writeFileSync(DATA_FILE, JSON.stringify(lines, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
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
