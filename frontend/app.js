/* ── 상태 ───────────────────────────────────────────────────────── */
const state = {
  category: "",
  keyword:  "",
  days:     1,
};

const API = "http://localhost:8000/api";

/* ── 초기화 ─────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupKeyword();
  loadStatus();
  loadArticles();
  // 5분마다 상태 갱신
  setInterval(loadStatus, 5 * 60 * 1000);
});

/* ── 탭 이벤트 ──────────────────────────────────────────────────── */
function setupTabs() {
  // 카테고리 탭
  document.querySelectorAll("#category-tabs .tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#category-tabs .tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.category = btn.dataset.cat;
      loadArticles();
    });
  });

  // 날짜 탭
  document.querySelectorAll("#date-tabs .date-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#date-tabs .date-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.days = parseInt(btn.dataset.days);
      loadArticles();
    });
  });
}

function setupKeyword() {
  const input = document.getElementById("keyword-input");
  input.addEventListener("keydown", e => { if (e.key === "Enter") applyFilter(); });
}

function applyFilter() {
  state.keyword = document.getElementById("keyword-input").value.trim();
  loadArticles();
}

/* ── API 호출 ───────────────────────────────────────────────────── */
async function loadArticles() {
  const grid = document.getElementById("news-grid");
  grid.innerHTML = '<div class="loading">뉴스를 불러오는 중...</div>';
  document.getElementById("empty-state").style.display = "none";

  const params = new URLSearchParams({ days: state.days, limit: 200 });
  if (state.category) params.append("category", state.category);
  if (state.keyword)  params.append("keyword",  state.keyword);

  try {
    const res  = await fetch(`${API}/articles?${params}`);
    const data = await res.json();
    renderArticles(data.articles);
  } catch (e) {
    grid.innerHTML = `<div class="loading" style="color:#f85149">
      ⚠ 서버에 연결할 수 없습니다.<br>
      <small>백엔드가 실행 중인지 확인해주세요 (python main.py)</small>
    </div>`;
  }
}

async function loadStatus() {
  try {
    const res  = await fetch(`${API}/status`);
    const data = await res.json();

    document.getElementById("today-count").textContent = data.today_count ?? "—";

    if (data.last_scraped_at) {
      const d = new Date(data.last_scraped_at);
      document.getElementById("last-updated").textContent =
        "마지막 업데이트: " + formatTime(d);
    }
  } catch (_) {
    // 서버 미연결 시 무시
  }
}

async function manualScrape() {
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
  const grid   = document.getElementById("news-grid");
  const empty  = document.getElementById("empty-state");

  if (!articles || articles.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  grid.innerHTML = articles.map(a => `
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

/* ── 유틸 ───────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(date) {
  if (isNaN(date)) return "";
  const now  = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60)   return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;

  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
