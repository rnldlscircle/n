/**
 * GitHub Actions용 스크래퍼
 * - RSS / HTML에서 기사 수집
 * - docs/data/articles.json 에 누적 저장 (7일 보관)
 * - 중복 URL 자동 제거
 */
const fs      = require("fs");
const path    = require("path");
const Parser  = require("rss-parser");
const cheerio = require("cheerio");
const { DATA_FILE, DATA_RETENTION_DAYS, NEWS_SOURCES } = require("./config");

const rssParser = new Parser({ timeout: 15000 });
const HEADERS   = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

// ── 기존 데이터 로드 ──────────────────────────────────────────────
function loadExisting() {
  const filePath = path.resolve(__dirname, DATA_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (_) {}
  return { updated_at: "", articles: [] };
}

// ── 데이터 저장 ──────────────────────────────────────────────────
function saveData(articles) {
  const filePath = path.resolve(__dirname, DATA_FILE);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const data = { updated_at: new Date().toISOString(), articles };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`[저장] ${filePath} — ${articles.length}건`);
}

// ── RSS 스크랩 ────────────────────────────────────────────────────
async function scrapeRss(source) {
  const feed     = await rssParser.parseURL(source.rssUrl);
  const articles = [];
  for (const entry of (feed.items || []).slice(0, 30)) {
    const title   = (entry.title || "").trim();
    const url     = (entry.link  || "").trim();
    const summary = (entry.contentSnippet || entry.summary || "")
      .replace(/<[^>]+>/g, "")
      .slice(0, 300);
    const published = entry.pubDate || entry.isoDate || "";
    if (!title || !url) continue;
    articles.push({ source_id: source.id, source_name: source.name,
      category: source.category, title, url, summary, published });
  }
  return articles;
}

// ── 네이버 금융 HTML 파싱 ─────────────────────────────────────────
async function scrapeNaver(source) {
  const pageUrls = [
    "https://finance.naver.com/news/news_list.naver?mode=LSECN&section_id=101&section_id2=258",
    "https://finance.naver.com/news/news_list.naver?mode=LSECN&section_id=101&section_id2=259",
  ];
  const articles = [];
  for (const url of pageUrls) {
    try {
      const res  = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      const html = await res.text();
      const $    = cheerio.load(html);
      $("dl.newsList dd.articleSubject a").slice(0, 15).each((_, el) => {
        const title = $(el).text().trim();
        let   href  = $(el).attr("href") || "";
        if (href.startsWith("/")) href = "https://finance.naver.com" + href;
        if (!title || !href) return;
        articles.push({ source_id: source.id, source_name: source.name,
          category: source.category, title, url: href,
          summary: "", published: new Date().toISOString() });
      });
    } catch (e) {
      console.error("[네이버] 오류:", e.message);
    }
  }
  return articles;
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  const existing   = loadExisting();
  const urlSet     = new Set(existing.articles.map((a) => a.url));
  const allNew     = [];

  for (const source of NEWS_SOURCES) {
    try {
      const scraped = source.rssUrl
        ? await scrapeRss(source)
        : await scrapeNaver(source);

      let newCount = 0;
      for (const a of scraped) {
        if (!urlSet.has(a.url)) {
          a.scraped_at = new Date().toISOString();
          allNew.push(a);
          urlSet.add(a.url);
          newCount++;
        }
      }
      console.log(`[${source.id}] ${scraped.length}건 수집, ${newCount}건 신규`);
    } catch (e) {
      console.error(`[${source.id}] 실패:`, e.message);
    }
  }

  // 새 기사를 앞에 추가 + 7일 이전 기사 제거
  const cutoff  = new Date(Date.now() - DATA_RETENTION_DAYS * 86400000).toISOString();
  const merged  = [...allNew, ...existing.articles]
    .filter((a) => (a.scraped_at || "") >= cutoff);

  saveData(merged);
  console.log(`\n✅ 완료 — 신규 ${allNew.length}건 / 총 ${merged.length}건`);
}

main().catch((e) => { console.error(e); process.exit(1); });
