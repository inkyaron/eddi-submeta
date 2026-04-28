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
const searchForm = document.querySelector("#search-form");
const clearButton = document.querySelector("#clear-button");
const rowTemplate = document.querySelector("#row-template");
const KYODEMO_ID_BASE_URL = "https://www.kyodemo.net/sdemo/b/e_e_liveedge/";
const KYODEMO_THREAD_BASE_URL = "https://www.kyodemo.net/sdemo/r/e_e_liveedge/";
const DAT_BASE_URL = "https://bbs.eddibb.cc/liveedge/dat/";
const DATA_URL =
  "https://raw.githubusercontent.com/inkyaron/eddi-submeta/refs/heads/main/data/records.json";

let records = [];
const entityDecoder = document.createElement("textarea");

function getFilterValues() {
  return {
    thread: threadFilter.value.trim(),
    upper: upperFilter.value.trim(),
    lower: lowerFilter.value.trim(),
    firstPostId: idFilter.value.trim(),
    title: titleFilter.value.trim(),
  };
}

function hasActiveFilters(filters) {
  return Boolean(filters.thread || filters.upper || filters.lower || filters.firstPostId || filters.title);
}

function updateUrlFromFilters(filters) {
  const params = new URLSearchParams();
  if (filters.thread) {
    params.set("thread", filters.thread);
  }
  if (filters.upper) {
    params.set("upper", filters.upper);
  }
  if (filters.lower) {
    params.set("lower", filters.lower);
  }
  if (filters.firstPostId) {
    params.set("id", filters.firstPostId);
  }
  if (filters.title) {
    params.set("title", filters.title);
  }

  const query = params.toString();
  const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

function populateFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  threadFilter.value = params.get("thread") ?? "";
  upperFilter.value = params.get("upper") ?? "";
  lowerFilter.value = params.get("lower") ?? "";
  idFilter.value = params.get("id") ?? "";
  titleFilter.value = params.get("title") ?? "";
}

function decodeTitle(value) {
  const text = String(value ?? "");
  entityDecoder.innerHTML = text;
  return entityDecoder.value;
}

function hydrateRecords(payload) {
  const rows = Array.isArray(payload.records) ? payload.records : [];
  const columns = Array.isArray(payload.columns) ? payload.columns : null;

  if (!columns) {
    return rows;
  }

  return rows.map((row) => {
    if (!Array.isArray(row)) {
      return row;
    }

    return Object.fromEntries(columns.map((column, index) => [column, row[index] ?? ""]));
  });
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

function buildDatUrl(record) {
  if (!record.threadNumber) {
    return "";
  }

  return `${DAT_BASE_URL}${record.threadNumber}.dat`;
}

function buildThreadArchiveUrl(record) {
  if (!record.threadNumber) {
    return "";
  }

  return `${KYODEMO_THREAD_BASE_URL}${record.threadNumber}/`;
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
  return `${KYODEMO_ID_BASE_URL}?${params.toString()}`;
}

function renderRows(rows) {
  resultsElement.replaceChildren();

  for (const record of rows) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const threadCell = row.querySelector(".thread");
    const firstPostIdCell = row.querySelector(".first-post-id");
    const titleCell = row.querySelector(".thread-title");
    const datUrl = buildDatUrl(record);
    const threadUrl = buildThreadArchiveUrl(record);
    const idUrl = buildIdUrl(record);

    if (datUrl) {
      const link = document.createElement("a");
      link.href = datUrl;
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
    const decodedTitle = decodeTitle(record.threadTitle) || "-";
    if (threadUrl && record.threadTitle) {
      const link = document.createElement("a");
      link.href = threadUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = decodedTitle;
      titleCell.replaceChildren(link);
    } else {
      titleCell.textContent = decodedTitle;
    }

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

function runSearch() {
  const filters = getFilterValues();
  const normalized = {
    thread: normalize(filters.thread),
    upper: normalize(filters.upper),
    lower: normalize(filters.lower),
    firstPostId: normalize(filters.firstPostId),
    title: normalize(filters.title),
  };

  if (!hasActiveFilters(normalized)) {
    resultCountElement.textContent = "0";
    resultsElement.replaceChildren();
    emptyStateElement.textContent = "検索条件を入力してください。";
    emptyStateElement.hidden = false;
    updateUrlFromFilters(filters);
    return;
  }

  const filtered = records.filter((record) => {
    const matchesThread = !normalized.thread || normalize(record.threadNumber).includes(normalized.thread);
    const matchesUpper = !normalized.upper || normalize(record.metadentUpper).includes(normalized.upper);
    const matchesLower = !normalized.lower || normalize(record.metadentLower).includes(normalized.lower);
    const matchesFirstPostId =
      !normalized.firstPostId || normalize(record.firstPostId).includes(normalized.firstPostId);
    const matchesTitle =
      !normalized.title || normalize(decodeTitle(record.threadTitle)).includes(normalized.title);

    return matchesThread && matchesUpper && matchesLower && matchesFirstPostId && matchesTitle;
  });

  emptyStateElement.textContent = "一致するデータはありません。";
  renderRows(filtered);
  updateUrlFromFilters(filters);
}

function clearFilters() {
  threadFilter.value = "";
  upperFilter.value = "";
  lowerFilter.value = "";
  idFilter.value = "";
  titleFilter.value = "";
  runSearch();
}

async function boot() {
  populateFiltersFromUrl();
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`データ読み込み失敗: ${response.status}`);
  }

  const payload = await response.json();
  records = hydrateRecords(payload);
  totalCountElement.textContent = records.length.toLocaleString("ja-JP");
  updatedAtElement.textContent = formatUpdatedAt(payload.updatedAt);
  runSearch();
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

clearButton.addEventListener("click", clearFilters);

boot().catch((error) => {
  console.error(error);
  updatedAtElement.textContent = "データを読み込めませんでした。";
});
