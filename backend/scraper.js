const Parser  = require("rss-parser");
const cheerio = require("cheerio");
const { NEWS_SOURCES } = require("./config");
const { saveArticles, logScrape } = require("./database");

const rssParser = new Parser({ timeout: 10000 });

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

// ── RSS 파싱 ─────────────────────────────────────────────────────────────────
async function scrapeRss(source) {
  const feed = await rssParser.parseURL(source.rssUrl);
  const articles = [];

  for (const entry of (feed.items || []).slice(0, 30)) {
    const title   = (entry.title || "").trim();
    const url     = (entry.link  || "").trim();
    const rawSummary = entry.contentSnippet || entry.summary || "";
    const summary = rawSummary.replace(/<[^>]+>/g, "").slice(0, 300);
    const published = entry.pubDate || entry.isoDate || "";

    if (!title || !url) continue;
    articles.push({
      source_id:   source.id,
      source_name: source.name,
      category:    source.category,
      title, url, summary, published,
    });
  }
  return articles;
}

// ── 네이버 금융 HTML 파싱 ────────────────────────────────────────────────────
async function scrapeNaverFinance(source) {
  const urls = [
    "https://finance.naver.com/news/news_list.naver?mode=LSECN&section_id=101&section_id2=258",
    "https://finance.naver.com/news/news_list.naver?mode=LSECN&section_id=101&section_id2=259",
  ];
  const articles = [];

  for (const url of urls) {
    try {
      const res  = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      const html = await res.text();
      const $    = cheerio.load(html);

      $("dl.newsList dd.articleSubject a").slice(0, 15).each((_, el) => {
        const title = $(el).text().trim();
        let   href  = $(el).attr("href") || "";
        if (href.startsWith("/")) href = "https://finance.naver.com" + href;
        if (!title || !href) return;

        articles.push({
          source_id:   source.id,
          source_name: source.name,
          category:    source.category,
          title, url: href,
          summary:   "",
          published: new Date().toISOString(),
        });
      });
    } catch (e) {
      console.error("[naver_finance] 파싱 오류:", e.message);
    }
  }
  return articles;
}

// ── 통합 실행 ────────────────────────────────────────────────────────────────
async function runScrapeAll() {
  const results  = {};
  let   totalNew = 0;

  for (const source of NEWS_SOURCES) {
    try {
      const articles = source.useRss
        ? await scrapeRss(source)
        : await scrapeNaverFinance(source);

      const newCount = saveArticles(articles);
      logScrape(source.id, newCount, "ok");
      results[source.id] = { count: articles.length, new: newCount };
      totalNew += newCount;
      console.log(`[${source.id}] ${articles.length}건 수집, ${newCount}건 신규`);
    } catch (e) {
      logScrape(source.id, 0, `error: ${e.message}`);
      results[source.id] = { count: 0, new: 0, error: e.message };
      console.error(`[${source.id}] 스크랩 실패:`, e.message);
    }
  }

  return { sources: results, total_new: totalNew, scraped_at: new Date().toISOString() };
}

module.exports = { runScrapeAll };
