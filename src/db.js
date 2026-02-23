import mysql from "mysql2/promise";
import "dotenv/config";

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z", // treat dates as UTC when reading/writing
});

// Ensure MySQL session uses UTC as well
db.on?.("connection", async (conn) => {
  try {
    await conn.query("SET time_zone = '+00:00'");
  } catch {
    // ignore if not supported by driver version
  }
});