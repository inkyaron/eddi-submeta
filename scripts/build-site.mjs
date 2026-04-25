import fs from "node:fs/promises";
import path from "node:path";

const DATA_PATH = path.resolve("data", "records.json");
const DOCS_DATA_DIR = path.resolve("docs", "data");

async function main() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const state = JSON.parse(raw);
  const records = Array.isArray(state.records) ? state.records : [];

  await fs.mkdir(DOCS_DATA_DIR, { recursive: true });

  const indexPayload = {
    updatedAt: state.updatedAt ?? null,
    totalRecords: records.length,
    records: records.map((record) => ({
      threadNumber: record.threadNumber,
      metadentUpper: record.metadentUpper,
      metadentLower: record.metadentLower,
      firstPostId: record.firstPostId,
      title: record.title ?? "",
      discoveredAt: record.discoveredAt ?? null
    }))
  };

  const csvLines = [
    ["thread_number", "metadent_upper", "metadent_lower", "first_post_id", "title", "discovered_at"].join(","),
    ...indexPayload.records.map((record) =>
      [
        csvEscape(record.threadNumber),
        csvEscape(record.metadentUpper),
        csvEscape(record.metadentLower),
        csvEscape(record.firstPostId),
        csvEscape(record.title),
        csvEscape(record.discoveredAt ?? "")
      ].join(",")
    )
  ];

  await fs.writeFile(
    path.join(DOCS_DATA_DIR, "index.json"),
    JSON.stringify(indexPayload, null, 2) + "\n",
    "utf8"
  );
  await fs.writeFile(path.join(DOCS_DATA_DIR, "records.csv"), csvLines.join("\n") + "\n", "utf8");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

await main();
