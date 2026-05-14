// ═══════════════════════════════════════════════════════════════════════════
// time.js — Helpers temporels partagés
// ═══════════════════════════════════════════════════════════════════════════
// Utilisé par : travel.js (getDailyRouteCost), et de nombreux consommateurs
// externes (Production, Market, AdminPage...).
//
// Format : "YYYY-MM-DD" (ISO, UTC). NE PAS le passer en local-time, le cron
// quotidien à 06:00 UTC s'appuie sur ce format.

export function getTodayDateStr() {
  return new Date().toISOString().split("T")[0];
}
