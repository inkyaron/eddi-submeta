const updatedAtElement = document.querySelector("#updated-at");
const totalCountElement = document.querySelector("#total-count");
const resultCountElement = document.querySelector("#result-count");
const resultsElement = document.querySelector("#results");
const emptyStateElement = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const upperFilter = document.querySelector("#upper-filter");
const lowerFilter = document.querySelector("#lower-filter");
const rowTemplate = document.querySelector("#row-template");

let records = [];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function formatTimestamp(value) {
  if (!value) {
    return "更新日時: 不明";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `更新日時: ${value}`;
  }

  return `更新日時: ${date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;
}

function renderRows(rows) {
  resultsElement.replaceChildren();

  for (const record of rows) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector(".thread").textContent = record.threadNumber;
    row.querySelector(".upper").textContent = record.metadentUpper;
    row.querySelector(".lower").textContent = record.metadentLower;
    row.querySelector(".first-post-id").textContent = record.firstPostId || "-";
    row.querySelector(".title").textContent = record.title || "";

    row.children[0].dataset.label = "スレ番号";
    row.children[1].dataset.label = "上位4桁";
    row.children[2].dataset.label = "下位4桁";
    row.children[3].dataset.label = "レス1 ID";
    row.children[4].dataset.label = "スレタイ";

    resultsElement.appendChild(row);
  }

  resultCountElement.textContent = rows.length.toLocaleString("ja-JP");
  emptyStateElement.hidden = rows.length !== 0;
}

function applyFilters() {
  const query = normalize(searchInput.value);
  const upper = normalize(upperFilter.value);
  const lower = normalize(lowerFilter.value);

  const filtered = records.filter((record) => {
    const matchesUpper = !upper || normalize(record.metadentUpper).includes(upper);
    const matchesLower = !lower || normalize(record.metadentLower).includes(lower);

    if (!matchesUpper || !matchesLower) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      record.threadNumber,
      record.metadentUpper,
      record.metadentLower,
      record.firstPostId,
      record.title
    ]
      .map(normalize)
      .join("\n");

    return haystack.includes(query);
  });

  renderRows(filtered);
}

async function boot() {
  const response = await fetch("./data/index.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`データ読み込み失敗: ${response.status}`);
  }

  const payload = await response.json();
  records = Array.isArray(payload.records) ? payload.records : [];
  totalCountElement.textContent = records.length.toLocaleString("ja-JP");
  updatedAtElement.textContent = formatTimestamp(payload.updatedAt);
  applyFilters();
}

searchInput.addEventListener("input", applyFilters);
upperFilter.addEventListener("input", applyFilters);
lowerFilter.addEventListener("input", applyFilters);

boot().catch((error) => {
  console.error(error);
  updatedAtElement.textContent = "データを読み込めませんでした。";
});
