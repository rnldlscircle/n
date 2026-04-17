const path = require("path");

module.exports = {
  DB_PATH: path.join(__dirname, "news.db"),
  SCRAPE_INTERVAL_HOURS: 2,
  DATA_RETENTION_DAYS: 7,

  // 이메일 설정 (.env 파일 또는 환경변수로 주입)
  EMAIL_ENABLED:    process.env.EMAIL_ENABLED === "true",
  SMTP_HOST:        process.env.SMTP_HOST        || "smtp.gmail.com",
  SMTP_PORT:        parseInt(process.env.SMTP_PORT || "587"),
  SMTP_USER:        process.env.SMTP_USER         || "",
  SMTP_PASSWORD:    process.env.SMTP_PASSWORD     || "",
  ALERT_RECIPIENTS: process.env.ALERT_RECIPIENTS  || "",

  NEWS_SOURCES: [
    {
      id: "naver_finance",
      name: "네이버 금융",
      category: "국내 주식·증시",
      rssUrl: null,
      useRss: false,
    },
    {
      id: "hankyung",
      name: "한국경제",
      category: "거시경제·금리·환율",
      rssUrl: "https://www.hankyung.com/feed/economy",
      useRss: true,
    },
    {
      id: "mk",
      name: "매일경제",
      category: "산업·기업 이슈",
      rssUrl: "https://www.mk.co.kr/rss/30200030/",
      useRss: true,
    },
    {
      id: "yonhap",
      name: "연합뉴스",
      category: "국내 주식·증시",
      rssUrl: "https://www.yna.co.kr/rss/economy.xml",
      useRss: true,
    },
    {
      id: "reuters",
      name: "Reuters",
      category: "글로벌 시장",
      rssUrl: "https://feeds.reuters.com/reuters/businessNews",
      useRss: true,
    },
    {
      id: "bloomberg",
      name: "Bloomberg",
      category: "글로벌 시장",
      rssUrl: "https://feeds.bloomberg.com/markets/news.rss",
      useRss: true,
    },
  ],
};
