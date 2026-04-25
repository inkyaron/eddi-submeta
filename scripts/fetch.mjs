import fs from "node:fs/promises";
import path from "node:path";

const SUBJECT_URL = "https://bbs.eddibb.cc/liveedge/subject-metadent.txt";
const DAT_BASE_URL = "https://bbs.eddibb.cc/liveedge/dat";
const DATA_DIR = path.resolve("data");
const DATA_PATH = path.join(DATA_DIR, "records.csv");

const SUBJECT_LINE_RE =
  /^(?<threadNumber>\d+)\.dat<>(?<title>.+?) \[(?<metadent>[^\[\]\s]{8})★\] \((?<responseCount>\d+)\)$/;
const FIRST_POST_RE =
  /^.*?<>(?<dateTime>\d{4}\/\d{2}\/\d{2}\([^)]+\) \d{2}:\d{2}:\d{2}(?:\.\d+)?) ID:(?<postId>[A-Za-z0-9+\/._-]+)<>/;

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_PATH);
  } catch {
    await fs.writeFile(
      DATA_PATH,
      "thread_number,metadent_upper,metadent_lower,first_post_id,first_post_datetime\n",
      "utf8"
    );
  }
}

async function loadData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const records = [];

  for (const line of lines.slice(1)) {
    const [threadNumber, metadentUpper, metadentLower, firstPostId, firstPostDateTime] = parseCsvLine(line);
    if (!threadNumber) {
      continue;
    }
    records.push({
      threadNumber,
      metadentUpper,
      metadentLower,
      firstPostId,
      firstPostDateTime
    });
  }

  return { records };
}

async function saveData(records) {
  const lines = [
    "thread_number,metadent_upper,metadent_lower,first_post_id,first_post_datetime",
    ...records.map((record) =>
      [
        csvEscape(record.threadNumber),
        csvEscape(record.metadentUpper),
        csvEscape(record.metadentLower),
        csvEscape(record.firstPostId),
        csvEscape(record.firstPostDateTime)
      ].join(",")
    )
  ];
  await fs.writeFile(DATA_PATH, lines.join("\n") + "\n", "utf8");
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
    metadent,
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

async function fetchFirstPost(threadNumber) {
  const datText = await fetchText(`${DAT_BASE_URL}/${threadNumber}.dat`);
  const firstLine = datText.split(/\r?\n/, 1)[0] ?? "";
  const match = firstLine.match(FIRST_POST_RE);
  return {
    firstPostId: match?.groups?.postId ?? "",
    firstPostDateTime: match?.groups?.dateTime ?? ""
  };
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
    let firstPostDateTime = "";
    try {
      const firstPost = await fetchFirstPost(parsed.threadNumber);
      firstPostId = firstPost.firstPostId;
      firstPostDateTime = firstPost.firstPostDateTime;
    } catch (error) {
      console.error(`Failed to fetch .dat for ${parsed.threadNumber}:`, error.message);
    }

    const record = {
      threadNumber: parsed.threadNumber,
      metadentUpper: parsed.metadentUpper,
      metadentLower: parsed.metadentLower,
      firstPostId,
      firstPostDateTime
    };

    existing.set(record.threadNumber, record);
    addedCount += 1;
  }

  const records = Array.from(existing.values()).sort(compareRecords);
  await saveData(records);

  console.log(
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        totalRecords: records.length,
        addedCount
      },
      null,
      2
    )
  );
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

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

await main();
