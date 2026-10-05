#!/usr/bin/env node
// Post new AveeCare incident reports to a Slack channel.
//
//   node incident-slack-alert.mjs            keep checking every POLL_INTERVAL_SECONDS
//   node incident-slack-alert.mjs --once     check once and exit (for cron or a scheduler)
//   node incident-slack-alert.mjs --since 2026-10-01T00:00:00Z    also alert on older incidents (first run only)
//
// Each check asks the API only for incidents created after the newest one already seen
// (`created_after`), so a quiet check costs one small request.
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import AveeCare, { AveeCareError } from 'aveecare';

try {
  process.loadEnvFile(); // reads ./.env when present (Node 20.12+)
} catch {
  // No .env file: the variables may already be in the environment.
}

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const EMOJI = { Low: ':information_source:', Medium: ':warning:', High: ':rotating_light:', Critical: ':sos:' };
// Look slightly behind the newest incident we saw, so one created in the same instant
// as another, or committed a moment late, is not missed. Seen ids stop duplicates.
const OVERLAP_MS = 60_000;
const MAX_SEEN = 1000;

export function loadConfig(env = process.env) {
  const interval = Number(env.POLL_INTERVAL_SECONDS ?? 60);
  if (!Number.isFinite(interval) || interval < 15) throw new Error('POLL_INTERVAL_SECONDS must be a number of at least 15');
  const minSeverity = env.MIN_SEVERITY ?? 'Low';
  if (!SEVERITIES.includes(minSeverity)) throw new Error(`MIN_SEVERITY must be one of ${SEVERITIES.join(', ')}`);
  if (!env.SLACK_WEBHOOK_URL || !/^https?:\/\//.test(env.SLACK_WEBHOOK_URL)) {
    throw new Error('SLACK_WEBHOOK_URL must be a Slack incoming webhook URL (https://hooks.slack.com/services/...)');
  }
  return {
    intervalMs: interval * 1000,
    minSeverity,
    includeDetails: env.INCLUDE_DETAILS === 'true',
    webhookUrl: env.SLACK_WEBHOOK_URL,
    stateFile: env.STATE_FILE ?? '.incident-alert-state.json',
  };
}

/** The Slack message. Titles can contain patient names, so they are opt-in. */
export function slackMessage(incident, includeDetails) {
  const severity = incident.severity ?? 'Unrated';
  const lines = [
    `${EMOJI[severity] ?? ':memo:'} *New incident report* (${severity})`,
    `Category: ${incident.category ?? 'Unspecified'}   Status: ${incident.status ?? 'Unknown'}`,
    `Happened: ${incident.incidentDateTime ?? incident.createdAt}`,
    `Incident ID: \`${incident.id}\``,
  ];
  if (includeDetails && incident.title) lines.splice(1, 0, `Title: ${incident.title}`);
  lines.push('Open AveeCare to review it.');
  return { text: lines.join('\n') };
}

function loadState(file) {
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof state.createdAfter === 'string' && Array.isArray(state.seen)) return state;
  } catch {
    // First run, or an unreadable file: start fresh.
  }
  return null;
}

const saveState = (file, state) => writeFileSync(file, JSON.stringify(state, null, 2));

/** Posts to Slack, waiting out a 429 once. Throws if Slack still refuses. */
export async function postToSlack(webhookUrl, message, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (res.ok) return;
    if (res.status === 429 && attempt === 0) {
      await sleep(Math.min(Number(res.headers.get('retry-after') ?? 1), 30) * 1000);
      continue;
    }
    throw new Error(`Slack answered ${res.status}`);
  }
}

/**
 * One check. Returns the new state. An incident that fails to post is left out of
 * `seen` and the cursor stays before it, so the next check tries it again.
 */
export async function checkOnce({ avee, config, state, post = postToSlack, log = console.log }) {
  const after = new Date(Date.parse(state.createdAfter) - OVERLAP_MS).toISOString();
  const seen = new Set(state.seen);
  const fresh = [];
  // limit 100 keeps a burst to few requests; `for await` fetches further pages if needed.
  for await (const incident of avee.incidents.list({ createdAfter: after, limit: 100 })) {
    if (!seen.has(incident.id)) fresh.push(incident);
  }
  // The API makes no promise about order: sort so alerts arrive oldest first.
  fresh.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  let newest = Date.parse(state.createdAfter);
  let blocked = false;
  for (const incident of fresh) {
    if (blocked) continue; // keep order: do not skip past a failed alert
    const meets = SEVERITIES.indexOf(incident.severity ?? 'Low') >= SEVERITIES.indexOf(config.minSeverity);
    if (meets) {
      try {
        await post(config.webhookUrl, slackMessage(incident, config.includeDetails));
        log(`alerted ${incident.id} (${incident.severity})`);
      } catch (err) {
        log(`could not post ${incident.id}, will retry: ${err.message}`);
        blocked = true;
        continue;
      }
    }
    seen.add(incident.id);
    newest = Math.max(newest, Date.parse(incident.createdAt));
  }
  return { createdAfter: new Date(newest).toISOString(), seen: [...seen].slice(-MAX_SEEN) };
}

function describe(err) {
  return err instanceof AveeCareError ? `AveeCare error ${err.status ?? ''} ${err.code ?? ''}: ${err.message}` : (err.message ?? String(err));
}

async function main() {
  const { values } = parseArgs({
    options: { once: { type: 'boolean', default: false }, since: { type: 'string' }, help: { type: 'boolean', default: false } },
  });
  if (values.help) {
    return console.log('Usage: node incident-slack-alert.mjs [--once] [--since <ISO 8601 time>]\nSee README.md for the environment variables.');
  }
  const config = loadConfig();
  const avee = new AveeCare(); // AVEECARE_API_KEY and optional AVEECARE_BASE_URL come from the environment

  let state = loadState(config.stateFile);
  if (!state) {
    const start = values.since ? Date.parse(values.since) : Date.now();
    if (Number.isNaN(start)) throw new Error('--since must be an ISO 8601 time such as 2026-10-01T00:00:00Z');
    state = { createdAfter: new Date(start).toISOString(), seen: [] };
    console.log(`First run: alerting on incidents created after ${state.createdAfter}`);
  }

  const stop = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop.abort());

  do {
    try {
      state = await checkOnce({ avee, config, state });
      saveState(config.stateFile, state);
    } catch (err) {
      if (values.once) throw err;
      console.error(`check failed, will try again: ${describe(err)}`);
    }
    if (!values.once) await sleep(config.intervalMs, undefined, { signal: stop.signal }).catch(() => undefined);
  } while (!values.once && !stop.signal.aborted);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(describe(err));
    process.exitCode = 1;
  });
}
