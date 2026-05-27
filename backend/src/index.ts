import "dotenv/config";
import express from "express";
import cors from "cors";
import { createAuthRouter } from "./routes/auth";
import { createBrandsRouter } from "./routes/brands";
import { createProductsRouter } from "./routes/products";
import { createVariantsRouter } from "./routes/variants";
import { createMovementsRouter } from "./routes/movements";
import { createDashboardRouter } from "./routes/dashboard";
import { createUploadRouter } from "./routes/upload";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables",
  );
  process.exit(1);
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes — pasamos URL y key para que cada request cree su cliente autenticado
app.use("/api/auth", createAuthRouter());
app.use("/api/brands", createBrandsRouter());
app.use("/api/products", createProductsRouter());
app.use("/api", createVariantsRouter());
app.use("/api/movements", createMovementsRouter());
app.use("/api/dashboard", createDashboardRouter());
app.use("/api/upload", createUploadRouter());

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  },
);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export default app;
