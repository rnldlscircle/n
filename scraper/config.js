module.exports = {
  DATA_FILE: "../docs/data/articles.json",
  DATA_RETENTION_DAYS: 7,

  NEWS_SOURCES: [
    {
      id: "hankyung",
      name: "한국경제",
      category: "거시경제·금리·환율",
      rssUrl: "https://www.hankyung.com/feed/economy",
    },
    {
      id: "mk",
      name: "매일경제",
      category: "산업·기업 이슈",
      rssUrl: "https://www.mk.co.kr/rss/30200030/",
    },
    {
      id: "yonhap",
      name: "연합뉴스",
      category: "국내 주식·증시",
      rssUrl: "https://www.yna.co.kr/rss/economy.xml",
    },
    {
      id: "bloomberg",
      name: "Bloomberg",
      category: "글로벌 시장",
      rssUrl: "https://feeds.bloomberg.com/markets/news.rss",
    },
    {
      id: "naver_finance",
      name: "네이버 금융",
      category: "국내 주식·증시",
      rssUrl: null,   // HTML 파싱
    },
  ],
};
