const updatedAtElement = document.querySelector("#updated-at");
const totalCountElement = document.querySelector("#total-count");
const resultCountElement = document.querySelector("#result-count");
const resultsElement = document.querySelector("#results");
const emptyStateElement = document.querySelector("#empty-state");
const threadFilter = document.querySelector("#thread-filter");
const upperFilter = document.querySelector("#upper-filter");
const lowerFilter = document.querySelector("#lower-filter");
const idFilter = document.querySelector("#id-filter");
const titleFilter = document.querySelector("#title-filter");
const rowTemplate = document.querySelector("#row-template");
const KYODEMO_BASE_URL = "https://www.kyodemo.net/sdemo/b/e_e_liveedge/";
const DATA_URL =
  "https://raw.githubusercontent.com/inkyaron/eddi-submeta/refs/heads/main/data/records.json";

let records = [];
const entityDecoder = document.createElement("textarea");

function decodeTitle(value) {
  const text = String(value ?? "");
  entityDecoder.innerHTML = text;
  return entityDecoder.value;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function formatUpdatedAt(value) {
  if (!value) {
    return "最終更新 不明";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `最終更新 ${value}`;
  }

  return `最終更新 ${date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;
}

function extractDateKey(value) {
  const match = String(value ?? "").match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (!match) {
    return "";
  }

  return `${match[1]}${match[2]}${match[3]}`;
}

function buildThreadUrl(record) {
  const date = extractDateKey(record.firstPostDateTime);
  if (!record.threadNumber || !date) {
    return "";
  }

  const params = new URLSearchParams({
    key: record.threadNumber,
    date,
  });
  return `${KYODEMO_BASE_URL}?${params.toString()}`;
}

function buildIdUrl(record) {
  const date = extractDateKey(record.firstPostDateTime);
  if (!record.threadNumber || !record.firstPostId || !date) {
    return "";
  }

  const params = new URLSearchParams({
    hi: record.firstPostId,
    key: record.threadNumber,
    date,
  });
  return `${KYODEMO_BASE_URL}?${params.toString()}`;
}

function renderRows(rows) {
  resultsElement.replaceChildren();

  for (const record of rows) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const threadCell = row.querySelector(".thread");
    const firstPostIdCell = row.querySelector(".first-post-id");
    const threadUrl = buildThreadUrl(record);
    const idUrl = buildIdUrl(record);

    if (threadUrl) {
      const link = document.createElement("a");
      link.href = threadUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = record.threadNumber;
      threadCell.replaceChildren(link);
    } else {
      threadCell.textContent = record.threadNumber;
    }

    row.querySelector(".upper").textContent = record.metadentUpper;
    row.querySelector(".lower").textContent = record.metadentLower;

    if (idUrl && record.firstPostId) {
      const link = document.createElement("a");
      link.href = idUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = record.firstPostId;
      firstPostIdCell.replaceChildren(link);
    } else {
      firstPostIdCell.textContent = record.firstPostId || "-";
    }

    row.querySelector(".first-post-datetime").textContent = record.firstPostDateTime || "-";
    row.querySelector(".thread-title").textContent = decodeTitle(record.threadTitle) || "-";

    row.children[0].dataset.label = "スレ番号";
    row.children[1].dataset.label = "meta-upper";
    row.children[2].dataset.label = "meta-lower";
    row.children[3].dataset.label = "レスID";
    row.children[4].dataset.label = "スレ立て日時";
    row.children[5].dataset.label = "スレタイ";

    resultsElement.appendChild(row);
  }

  resultCountElement.textContent = rows.length.toLocaleString("ja-JP");
  emptyStateElement.hidden = rows.length !== 0;
}

function applyFilters() {
  const thread = normalize(threadFilter.value);
  const upper = normalize(upperFilter.value);
  const lower = normalize(lowerFilter.value);
  const firstPostId = normalize(idFilter.value);
  const title = normalize(titleFilter.value);

  const hasActiveFilters = Boolean(thread || upper || lower || firstPostId || title);
  if (!hasActiveFilters) {
    resultCountElement.textContent = "0";
    resultsElement.replaceChildren();
    emptyStateElement.textContent = "検索条件を入力してください。";
    emptyStateElement.hidden = false;
    return;
  }

  const filtered = records.filter((record) => {
    const matchesThread = !thread || normalize(record.threadNumber).includes(thread);
    const matchesUpper = !upper || normalize(record.metadentUpper).includes(upper);
    const matchesLower = !lower || normalize(record.metadentLower).includes(lower);
    const matchesFirstPostId = !firstPostId || normalize(record.firstPostId).includes(firstPostId);
    const matchesTitle = !title || normalize(decodeTitle(record.threadTitle)).includes(title);

    return matchesThread && matchesUpper && matchesLower && matchesFirstPostId && matchesTitle;
  });

  emptyStateElement.textContent = "一致するデータはありません。";
  renderRows(filtered);
}

async function boot() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`データ読み込み失敗: ${response.status}`);
  }

  const payload = await response.json();
  records = Array.isArray(payload.records) ? payload.records : [];
  totalCountElement.textContent = records.length.toLocaleString("ja-JP");
  updatedAtElement.textContent = formatUpdatedAt(payload.updatedAt);
  applyFilters();
}

threadFilter.addEventListener("input", applyFilters);
upperFilter.addEventListener("input", applyFilters);
lowerFilter.addEventListener("input", applyFilters);
idFilter.addEventListener("input", applyFilters);
titleFilter.addEventListener("input", applyFilters);

boot().catch((error) => {
  console.error(error);
  updatedAtElement.textContent = "データを読み込めませんでした。";
});
