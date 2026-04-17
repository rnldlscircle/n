const express = require("express");
const cors    = require("cors");
const cron    = require("node-cron");
const path    = require("path");

const { initDb, getArticles, getArticlesByDate, getAvailableDates, getStatus } = require("./database");
const { runScrapeAll } = require("./scraper");
const { sendAlert }    = require("./emailAlert");
const { SCRAPE_INTERVAL_HOURS } = require("./config");

const app = express();
app.use(cors());
app.use(express.json());

// ── API ───────────────────────────────────────────────────────────────────────

app.get("/api/articles", (req, res) => {
  const { category, keyword, days = "1", limit = "100" } = req.query;
  const articles = getArticles({
    category: category || null,
    keyword:  keyword  || null,
    days:     parseInt(days),
    limit:    parseInt(limit),
  });
  res.json({ articles, count: articles.length });
});

app.get("/api/articles/dates", (_req, res) => {
  res.json({ dates: getAvailableDates() });
});

app.get("/api/articles/date/:date", (req, res) => {
  const articles = getArticlesByDate(req.params.date);
  res.json({ articles, count: articles.length, date: req.params.date });
});

app.post("/api/scrape", async (_req, res) => {
  try {
    const result = await runScrapeAll();
    if (result.total_new > 0) {
      const recent = getArticles({ days: 1, limit: 50 });
      await sendAlert(result.total_new, recent).catch(() => {});
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/status", (_req, res) => {
  res.json(getStatus());
});

// ── 정적 파일 (프론트엔드) ───────────────────────────────────────────────────
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ── 스케줄러 ─────────────────────────────────────────────────────────────────
function startScheduler() {
  // node-cron은 분 단위 → 2시간마다 = 0 */2 * * *
  const cronExp = `0 */${SCRAPE_INTERVAL_HOURS} * * *`;
  cron.schedule(cronExp, async () => {
    console.log(`[Cron] ${SCRAPE_INTERVAL_HOURS}시간 자동 스크랩 시작`);
    const result = await runScrapeAll();
    if (result.total_new > 0) {
      const recent = getArticles({ days: 1, limit: 50 });
      await sendAlert(result.total_new, recent).catch(() => {});
    }
  }, { timezone: "Asia/Seoul" });

  // 매일 00:30 오래된 데이터 정리
  cron.schedule("30 0 * * *", () => {
    const { purgeOldArticles } = require("./database");
    purgeOldArticles();
  }, { timezone: "Asia/Seoul" });

  console.log(`[Cron] 스케줄러 등록 완료 (${cronExp})`);
}

// ── 서버 시작 ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;

(async () => {
  initDb();

  console.log("[시작] 초기 스크랩 진행 중...");
  try {
    await runScrapeAll();
  } catch (e) {
    console.error("[시작] 초기 스크랩 오류:", e.message);
  }

  startScheduler();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n========================================`);
    console.log(`  📈 경제 뉴스 대시보드 실행 중`);
    console.log(`  PC:     http://localhost:${PORT}`);
    console.log(`  종료:   Ctrl+C`);
    console.log(`========================================\n`);
  });
})();
