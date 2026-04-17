/* ── 환경 감지 ─────────────────────────────────────────────────────
   로컬(localhost)  → Express API (localhost:8000/api/*)
   GitHub Pages     → 정적 JSON 파일 (/data/articles.json)
──────────────────────────────────────────────────────────────── */
const IS_LOCAL = window.location.hostname === "localhost" ||
                 window.location.hostname === "127.0.0.1";
const API      = IS_LOCAL ? "http://localhost:8000/api" : null;
const JSON_URL = IS_LOCAL ? null : "./data/articles.json";

/* ── 상태 ─────────────────────────────────────────────────────── */
const state = { category: "", keyword: "", days: 1 };

// GitHub Pages에서 쓰는 전체 기사 캐시
let _cachedData = null;

/* ── 초기화 ─────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupKeyword();
  loadStatus();
  loadArticles();
  setInterval(loadStatus, 5 * 60 * 1000);
});

/* ── 탭 이벤트 ──────────────────────────────────────────────────── */
function setupTabs() {
  document.querySelectorAll("#category-tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#category-tabs .tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.category = btn.dataset.cat;
      loadArticles();
    });
  });
  document.querySelectorAll("#date-tabs .date-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#date-tabs .date-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.days = parseInt(btn.dataset.days);
      loadArticles();
    });
  });
}

function setupKeyword() {
  document.getElementById("keyword-input")
    .addEventListener("keydown", (e) => { if (e.key === "Enter") applyFilter(); });
}

function applyFilter() {
  state.keyword = document.getElementById("keyword-input").value.trim();
  loadArticles();
}

/* ── 데이터 로드 ─────────────────────────────────────────────────── */
async function getRawData() {
  if (IS_LOCAL) return null; // 로컬은 API 직접 호출

  // GitHub Pages: JSON 파일 1회 캐시
  if (!_cachedData) {
    const res  = await fetch(JSON_URL + "?t=" + Date.now());
    _cachedData = await res.json();
  }
  return _cachedData;
}

function filterArticles(all, { category, keyword, days }) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return all.filter((a) => {
    if ((a.scraped_at || "") < since) return false;
    if (category && a.category !== category) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      if (!a.title.toLowerCase().includes(kw) &&
          !(a.summary || "").toLowerCase().includes(kw)) return false;
    }
    return true;
  }).slice(0, 200);
}

async function loadArticles() {
  const grid = document.getElementById("news-grid");
  grid.innerHTML = '<div class="loading">뉴스를 불러오는 중...</div>';
  document.getElementById("empty-state").style.display = "none";

  try {
    let articles;
    if (IS_LOCAL) {
      const params = new URLSearchParams({ days: state.days, limit: 200 });
      if (state.category) params.append("category", state.category);
      if (state.keyword)  params.append("keyword",  state.keyword);
      const res  = await fetch(`${API}/articles?${params}`);
      const data = await res.json();
      articles = data.articles;
    } else {
      const data = await getRawData();
      articles   = filterArticles(data.articles || [], state);
    }
    renderArticles(articles);
  } catch (e) {
    grid.innerHTML = `<div class="loading" style="color:#f85149">
      ⚠ 데이터를 불러올 수 없습니다.<br>
      <small>${IS_LOCAL ? "백엔드 서버 확인 (node server.js)" : "잠시 후 다시 시도해주세요"}</small>
    </div>`;
  }
}

async function loadStatus() {
  try {
    if (IS_LOCAL) {
      const res  = await fetch(`${API}/status`);
      const data = await res.json();
      document.getElementById("today-count").textContent = data.today_count ?? "—";
      if (data.last_scraped_at) {
        document.getElementById("last-updated").textContent =
          "마지막 업데이트: " + formatTime(new Date(data.last_scraped_at));
      }
    } else {
      // GitHub Pages: JSON에서 읽기
      _cachedData = null; // 상태 조회 시 캐시 초기화
      const data  = await getRawData();
      const today = filterArticles(data.articles || [], { days: 1 });
      document.getElementById("today-count").textContent = today.length;
      if (data.updated_at) {
        document.getElementById("last-updated").textContent =
          "마지막 업데이트: " + formatTime(new Date(data.updated_at));
      }
    }
  } catch (_) {}
}

async function manualScrape() {
  if (!IS_LOCAL) {
    showToast("☁ 클라우드 모드에서는 GitHub Actions가 2시간마다 자동 업데이트합니다.");
    return;
  }
  const btn = document.getElementById("btn-refresh");
  btn.disabled = true;
  btn.textContent = "⟳ 스크랩 중...";
  showToast("뉴스를 수집하고 있습니다...");
  try {
    const res  = await fetch(`${API}/scrape`, { method: "POST" });
    const data = await res.json();
    showToast(`✅ 완료 — 신규 ${data.total_new}건 수집`);
    await loadStatus();
    await loadArticles();
  } catch (e) {
    showToast("⚠ 스크랩 실패. 서버 상태를 확인해주세요.");
  } finally {
    btn.disabled = false;
    btn.textContent = "⟳ 새로고침";
  }
}

/* ── 렌더링 ─────────────────────────────────────────────────────── */
function renderArticles(articles) {
  const grid  = document.getElementById("news-grid");
  const empty = document.getElementById("empty-state");

  if (!articles || articles.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  grid.innerHTML = articles.map((a) => `
    <article class="news-card">
      <div class="card-meta">
        <span class="card-source">${escHtml(a.source_name)}</span>
        <span class="card-category">${escHtml(a.category)}</span>
        <span class="card-time">${formatTime(new Date(a.scraped_at))}</span>
      </div>
      <div class="card-title">
        <a href="${escHtml(a.url)}" target="_blank" rel="noopener">${escHtml(a.title)}</a>
      </div>
      ${a.summary ? `<p class="card-summary">${escHtml(a.summary)}</p>` : ""}
    </article>
  `).join("");
}

/* ── 유틸 ──────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatTime(date) {
  if (isNaN(date)) return "";
  const diff = Math.floor((new Date() - date) / 1000);
  if (diff < 60)    return "방금 전";
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

let _toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
