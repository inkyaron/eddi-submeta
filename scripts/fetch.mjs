import fs from "node:fs/promises";
import path from "node:path";

const SUBJECT_URL = "https://bbs.eddibb.cc/liveedge/subject-metadent.txt";
const DAT_BASE_URL = "https://bbs.eddibb.cc/liveedge/dat";
const DATA_DIR = path.resolve("data");
const DATA_PATH = path.join(DATA_DIR, "records.json");

const SUBJECT_LINE_RE =
  /^(?<threadNumber>\d+)\.dat<>(?<title>.+?) \[(?<metadent>[^\[\]\s]{8})★\] \((?<responseCount>\d+)\)$/;
const FIRST_POST_ID_RE = / ID:([A-Za-z0-9+\/._-]+)/;

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_PATH);
  } catch {
    const initial = {
      version: 1,
      updatedAt: null,
      records: []
    };
    await fs.writeFile(DATA_PATH, JSON.stringify(initial, null, 2) + "\n", "utf8");
  }
}

async function loadData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const records = Array.isArray(parsed.records) ? parsed.records : [];
  return {
    version: parsed.version ?? 1,
    updatedAt: parsed.updatedAt ?? null,
    records
  };
}

async function saveData(state) {
  await fs.writeFile(DATA_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function splitMetadent(metadent) {
  return {
    metadentUpper: metadent.slice(0, 4),
    metadentLower: metadent.slice(4, 8)
  };
}

function parseSubjectLine(line) {
  const match = line.match(SUBJECT_LINE_RE);
  if (!match?.groups) {
    return null;
  }

  const { threadNumber, title, metadent, responseCount } = match.groups;
  return {
    threadNumber,
    title,
    metadent,
    responseCount: Number(responseCount),
    ...splitMetadent(metadent)
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "eddi-submeta-bot/1.0 (+https://github.com/)"
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText} (${url})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return new TextDecoder("shift_jis").decode(buffer);
}

async function fetchFirstPostId(threadNumber) {
  const datText = await fetchText(`${DAT_BASE_URL}/${threadNumber}.dat`);
  const firstLine = datText.split(/\r?\n/, 1)[0] ?? "";
  const match = firstLine.match(FIRST_POST_ID_RE);
  return match?.[1] ?? "";
}

function compareRecords(a, b) {
  return Number(b.threadNumber) - Number(a.threadNumber);
}

async function main() {
  const state = await loadData();
  const existing = new Map(state.records.map((record) => [record.threadNumber, record]));

  const subjectText = await fetchText(SUBJECT_URL);
  const lines = subjectText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let addedCount = 0;

  for (const line of lines) {
    const parsed = parseSubjectLine(line);
    if (!parsed) {
      continue;
    }

    if (existing.has(parsed.threadNumber)) {
      continue;
    }

    let firstPostId = "";
    try {
      firstPostId = await fetchFirstPostId(parsed.threadNumber);
    } catch (error) {
      console.error(`Failed to fetch .dat for ${parsed.threadNumber}:`, error.message);
    }

    const record = {
      threadNumber: parsed.threadNumber,
      metadentUpper: parsed.metadentUpper,
      metadentLower: parsed.metadentLower,
      firstPostId,
      title: parsed.title,
      sourceMetadent: parsed.metadent,
      observedResponseCount: parsed.responseCount,
      discoveredAt: new Date().toISOString()
    };

    existing.set(record.threadNumber, record);
    addedCount += 1;
  }

  state.records = Array.from(existing.values()).sort(compareRecords);
  state.updatedAt = new Date().toISOString();
  await saveData(state);

  console.log(
    JSON.stringify(
      {
        updatedAt: state.updatedAt,
        totalRecords: state.records.length,
        addedCount
      },
      null,
      2
    )
  );
}

await main();
