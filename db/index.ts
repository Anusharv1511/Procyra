import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One pool per server instance; Neon/Vercel friendly (pooled connection string).
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
export const db = drizzle(pool, { schema });
export * as t from "./schema";
