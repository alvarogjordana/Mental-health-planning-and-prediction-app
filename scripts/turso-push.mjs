/**
 * Applies the Prisma schema to Turso by:
 * 1. Generating full DDL via `prisma migrate diff --from-empty`
 * 2. Splitting into statements and executing each against Turso's HTTP API
 *    using IF NOT EXISTS so it's safe to run repeatedly.
 */

import { execSync } from "child_process";
import https from "https";

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url || !token) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.");
  process.exit(1);
}

// Extract hostname from libsql://host or https://host
const hostname = url.replace(/^[a-z+]+:\/\//, "");

// Generate DDL from Prisma schema (no DB connection needed)
console.log("Generating schema DDL...");
const sql = execSync(
  "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
  { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
);

// Split into individual statements, strip comment lines, make idempotent
const statements = sql
  .split(";")
  .map((s) =>
    // Remove comment lines, then trim
    s
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter((s) => s.length > 0)
  .map((s) =>
    s
      .replace(/^CREATE TABLE "/i, 'CREATE TABLE IF NOT EXISTS "')
      .replace(/^CREATE INDEX "/i, 'CREATE INDEX IF NOT EXISTS "')
      .replace(/^CREATE UNIQUE INDEX "/i, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
  );

console.log(`Applying ${statements.length} statements to Turso...`);

const body = JSON.stringify({
  requests: [
    ...statements.map((s) => ({ type: "execute", stmt: { sql: s } })),
    { type: "close" },
  ],
});

await new Promise((resolve, reject) => {
  const req = https.request(
    {
      hostname,
      path: "/v2/pipeline",
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.error("HTTP", res.statusCode, data);
          reject(new Error("Request failed"));
          return;
        }
        const parsed = JSON.parse(data);
        let ok = true;
        parsed.results?.forEach((r, i) => {
          if (r.type === "error") {
            console.error(`Statement ${i} failed:`, r.error?.message ?? r.error);
            ok = false;
          }
        });
        if (ok) {
          console.log("✓ Schema pushed to Turso successfully.");
          resolve();
        } else {
          reject(new Error("One or more statements failed."));
        }
      });
    }
  );
  req.on("error", reject);
  req.write(body);
  req.end();
});
