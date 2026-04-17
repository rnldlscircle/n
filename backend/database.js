const { DatabaseSync } = require("node:sqlite");
const { DB_PATH, DATA_RETENTION_DAYS } = require("./config");

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
  }
  return db;
}

function initDb() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id   TEXT NOT NULL,
      source_name TEXT NOT NULL,
      category    TEXT NOT NULL,
      title       TEXT NOT NULL,
      url         TEXT UNIQUE NOT NULL,
      summary     TEXT DEFAULT '',
      published   TEXT DEFAULT '',
      scraped_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scrape_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      scraped_at TEXT NOT NULL,
      source_id  TEXT NOT NULL,
      count      INTEGER NOT NULL,
      status     TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scraped_at ON articles(scraped_at);
    CREATE INDEX IF NOT EXISTS idx_category   ON articles(category);
  `);
  console.log("[DB] 초기화 완료:", DB_PATH);
}

function saveArticles(articles) {
  const d = getDb();
  const now  = new Date().toISOString();
  const stmt = d.prepare(`
    INSERT OR IGNORE INTO articles
      (source_id, source_name, category, title, url, summary, published, scraped_at)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  let saved = 0;
  for (const a of articles) {
    const info = stmt.run(
      a.source_id, a.source_name, a.category,
      a.title, a.url, a.summary || "", a.published || "", now
    );
    saved += info.changes;
  }
  return saved;
}

function logScrape(sourceId, count, status) {
  getDb().prepare(
    "INSERT INTO scrape_log (scraped_at, source_id, count, status) VALUES (?,?,?,?)"
  ).run(new Date().toISOString(), sourceId, count, status);
}

function getArticles({ category, keyword, days = 1, limit = 100 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  let q = "SELECT * FROM articles WHERE scraped_at >= ?";
  const params = [since];

  if (category) { q += " AND category = ?"; params.push(category); }
  if (keyword)  {
    q += " AND (title LIKE ? OR summary LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  q += " ORDER BY scraped_at DESC LIMIT ?";
  params.push(limit);

  return getDb().prepare(q).all(...params);
}

function getArticlesByDate(dateStr) {
  return getDb().prepare(
    "SELECT * FROM articles WHERE scraped_at LIKE ? ORDER BY scraped_at DESC"
  ).all(`${dateStr}%`);
}

function purgeOldArticles() {
  const cutoff = new Date(Date.now() - DATA_RETENTION_DAYS * 86400000).toISOString();
  const info   = getDb().prepare("DELETE FROM articles WHERE scraped_at < ?").run(cutoff);
  console.log(`[DB] 오래된 기사 ${info.changes}건 삭제`);
}

function getAvailableDates() {
  return getDb().prepare(
    "SELECT DISTINCT substr(scraped_at,1,10) as d FROM articles ORDER BY d DESC LIMIT 7"
  ).all().map((r) => r.d);
}

function getLastScrapeTime() {
  const row = getDb().prepare(
    "SELECT scraped_at FROM scrape_log ORDER BY scraped_at DESC LIMIT 1"
  ).get();
  return row ? row.scraped_at : null;
}

function getStatus() {
  const today = getArticles({ days: 1, limit: 9999 });
  const week  = getArticles({ days: 7, limit: 9999 });
  const byCat = {};
  for (const a of today) byCat[a.category] = (byCat[a.category] || 0) + 1;
  return {
    last_scraped_at: getLastScrapeTime(),
    total_7d:        week.length,
    today_count:     today.length,
    by_category:     byCat,
  };
}

module.exports = {
  initDb, saveArticles, logScrape,
  getArticles, getArticlesByDate,
  purgeOldArticles, getAvailableDates,
  getLastScrapeTime, getStatus,
};
