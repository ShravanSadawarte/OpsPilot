import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    // Migrations and seed use the direct (non-pooled) connection when available.
    // The runtime application keeps using DATABASE_URL (pooled) via src/lib/db.ts.
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL,
  },
});
