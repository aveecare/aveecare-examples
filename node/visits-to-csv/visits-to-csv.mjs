#!/usr/bin/env node
// Export a date range of AveeCare visits to a CSV file.
//
//   node visits-to-csv.mjs --from 2026-10-01 --to 2026-11-01 [--status Completed] [--out visits.csv]
//
// The API lists visits for a window of at most 93 days, so longer ranges are fetched in
// chunks. Each chunk is read page by page through the SDK's auto-paging iterator.
import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { parseArgs } from 'node:util';
import AveeCare, { AveeCareError } from 'aveecare';

try {
  process.loadEnvFile(); // reads ./.env when present (Node 20.12+)
} catch {
  // No .env file: the variables may already be in the environment.
}

const USAGE = `Usage: node visits-to-csv.mjs --from YYYY-MM-DD --to YYYY-MM-DD [options]

  --from <date>          First day to include (UTC midnight). Required.
  --to <date>            Day to stop at, not included. Required.
  --status <status>      Only visits with this status (Scheduled, InProgress, Cancelled,
                         Completed, Late, OverTime, Incomplete).
  --patient-id <id>      Only visits for this patient.
  --caregiver-id <id>    Only visits for this caregiver.
  --page-size <n>        Visits per request, 1 to 100. Default: 100 (fewest requests).
  --out <file>           Output file. Default: visits.csv
  --help                 Show this help.`;

const COLUMNS = [
  ['id', 'id'],
  ['startTime', 'start_time'],
  ['endTime', 'end_time'],
  ['status', 'status'],
  ['patientId', 'patient_id'],
  ['caregiverId', 'caregiver_id'],
  ['title', 'title'],
  ['serviceCode', 'service_code'],
  ['billableHours', 'billable_hours'],
  ['evvStatus', 'evv_status'],
  ['billingStatus', 'billing_status'],
];

const MAX_WINDOW_DAYS = 90; // the API allows 93; stay a little under
const DAY_MS = 86_400_000;

/** One CSV cell. Quotes when needed, and defuses cells a spreadsheet would run as a formula. */
export function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseDay(label, text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? '') || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new Error(`${label} must be a date like 2026-10-01`);
  }
  return Date.parse(`${text}T00:00:00Z`);
}

/** Splits [from, to) into windows of at most MAX_WINDOW_DAYS days. */
export function windows(fromMs, toMs) {
  const out = [];
  for (let start = fromMs; start < toMs; start += MAX_WINDOW_DAYS * DAY_MS) {
    out.push([start, Math.min(start + MAX_WINDOW_DAYS * DAY_MS, toMs)]);
  }
  return out;
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      to: { type: 'string' },
      status: { type: 'string' },
      'patient-id': { type: 'string' },
      'caregiver-id': { type: 'string' },
      'page-size': { type: 'string', default: '100' },
      out: { type: 'string', default: 'visits.csv' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) return console.log(USAGE);

  const fromMs = parseDay('--from', values.from);
  const toMs = parseDay('--to', values.to);
  if (toMs <= fromMs) throw new Error('--to must be after --from');
  const pageSize = Number(values['page-size']);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('--page-size must be a whole number from 1 to 100');

  // Reads AVEECARE_API_KEY (and AVEECARE_BASE_URL when set) from the environment.
  const avee = new AveeCare();
  const filters = {
    ...(values.status && { status: values.status }),
    ...(values['patient-id'] && { patientId: values['patient-id'] }),
    ...(values['caregiver-id'] && { caregiverId: values['caregiver-id'] }),
  };

  const file = createWriteStream(values.out, { encoding: 'utf8' });
  file.write(`${COLUMNS.map(([, header]) => header).join(',')}\n`);

  let count = 0;
  for (const [start, end] of windows(fromMs, toMs)) {
    const visits = avee.visits.list({
      startFrom: new Date(start).toISOString(),
      startTo: new Date(end).toISOString(),
      limit: pageSize,
      ...filters,
    });
    // `for await` walks every page of the window.
    for await (const visit of visits) {
      if (!file.write(`${COLUMNS.map(([field]) => csvCell(visit[field])).join(',')}\n`)) await once(file, 'drain');
      count++;
    }
  }
  file.end();
  await once(file, 'finish');
  console.log(`Wrote ${count} visit${count === 1 ? '' : 's'} to ${values.out}`);
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    if (err instanceof AveeCareError) {
      console.error(`AveeCare error ${err.status ?? ''} ${err.code ?? ''}: ${err.message}${err.requestId ? ` (request ${err.requestId})` : ''}`);
    } else {
      console.error(err.message ?? err);
    }
    process.exitCode = 1;
  });
}
