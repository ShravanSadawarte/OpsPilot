import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    // Prisma CLI (migrate/seed) prefers the direct, non-pooled connection.
    // The runtime application keeps using DATABASE_URL (pooled) via src/lib/db.ts.
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL,
  },
});
