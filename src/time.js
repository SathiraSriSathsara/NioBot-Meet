import { DateTime } from "luxon";

// Incoming from client: "YYYY-MM-DD HH:mm:ss" in Sri Lanka time
export function colomboStringToUtcMySqlDatetime(s) {
  // Parse as Asia/Colombo, then convert to UTC
  const dt = DateTime.fromFormat(s, "yyyy-MM-dd HH:mm:ss", {
    zone: "Asia/Colombo",
  });

  if (!dt.isValid) {
    throw new Error(`Invalid scheduled_at format. Use "YYYY-MM-DD HH:mm:ss". Got: ${s}`);
  }

  // Return MySQL-friendly UTC DATETIME string (no timezone info)
  return dt.toUTC().toFormat("yyyy-MM-dd HH:mm:ss");
}