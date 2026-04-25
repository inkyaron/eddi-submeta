import fs from "node:fs/promises";
import path from "node:path";

const DATA_PATH = path.resolve("data", "records.csv");
const DOCS_DATA_DIR = path.resolve("docs", "data");

async function main() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const records = lines.slice(1).map((line) => {
    const [threadNumber, metadentUpper, metadentLower, firstPostId, firstPostDateTime] = parseCsvLine(line);
    return {
      threadNumber,
      metadentUpper,
      metadentLower,
      firstPostId,
      firstPostDateTime
    };
  });

  await fs.mkdir(DOCS_DATA_DIR, { recursive: true });

  const indexPayload = {
    updatedAt: new Date().toISOString(),
    totalRecords: records.length,
    records: records.map((record) => ({
      threadNumber: record.threadNumber,
      metadentUpper: record.metadentUpper,
      metadentLower: record.metadentLower,
      firstPostId: record.firstPostId,
      firstPostDateTime: record.firstPostDateTime
    }))
  };

  await fs.writeFile(
    path.join(DOCS_DATA_DIR, "index.json"),
    JSON.stringify(indexPayload, null, 2) + "\n",
    "utf8"
  );
  await fs.copyFile(DATA_PATH, path.join(DOCS_DATA_DIR, "records.csv"));
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

await main();
