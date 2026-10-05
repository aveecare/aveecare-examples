# incident-slack-alert

Post each new [AveeCare](https://www.aveecare.com) incident report to a Slack channel as soon
as it is filed, using the [`aveecare` Node.js library](https://github.com/aveecare/aveecare-node)
and a Slack incoming webhook.

## What it does

Every minute (you choose) it asks the API for incidents created since the last one it saw
and posts a short message to Slack:

> :rotating_light: **New incident report** (High)
> Category: Fall   Status: Open
> Happened: 2026-10-05T17:15:44Z
> Incident ID: `9b2e4c71-...`
> Open AveeCare to review it.

By default the message has no patient or caregiver names and no description: Slack is a
shared space, and incident reports are protected health information. Set
`INCLUDE_DETAILS=true` to add each incident's title. Check that your agency's agreements
with Slack allow that before you do.

## Set up

1. In Slack create an [incoming webhook](https://api.slack.com/messaging/webhooks) for the
   channel that should get the alerts.
2. In AveeCare create a **Read-only** API key (Settings → API Keys).
3. Install and configure (needs Node.js 20.12 or newer):

```sh
npm install
cp .env.example .env      # then fill in AVEECARE_API_KEY and SLACK_WEBHOOK_URL
npm start                 # keeps running, checking every minute
```

Use `npm start -- --once` to check a single time and exit, for example from cron or a
scheduled task. Use `--since 2026-10-01T00:00:00Z` on the first run to also alert on older
incidents. Without it, only incidents filed after you start are alerted.

## Polling and rate limits

- `POLL_INTERVAL_SECONDS` sets the time between checks. The default is 60 and the minimum 15.
  Each key may make 60 requests a minute, shared with anything else using the key, and one
  check is normally one request, so a one-minute interval uses a fraction of that.
- Each check filters by `created_after`, so the API returns only what is new. It asks for
  100 at a time and follows further pages if a burst needs them.
- If the API says to slow down (`429`), the library waits as long as `Retry-After` says and
  tries again.
- It remembers where it got to in `.incident-alert-state.json` (set `STATE_FILE` to move
  it), so a restart neither repeats nor misses alerts. It looks a minute behind the newest
  incident each time and skips IDs it has already posted, so an incident that arrives
  late is not lost.
- If Slack refuses a message, that incident is retried on the next check and later ones
  wait behind it, so alerts stay in order.

## Configuration

| Variable | Default | |
|---|---|---|
| `AVEECARE_API_KEY` | | Your API key. |
| `AVEECARE_BASE_URL` | `https://api.aveecare.com` | Only to point at a sandbox. |
| `SLACK_WEBHOOK_URL` | | Your Slack incoming webhook. Required. |
| `POLL_INTERVAL_SECONDS` | `60` | Seconds between checks, 15 or more. |
| `MIN_SEVERITY` | `Low` | Only alert at this severity or higher: `Low`, `Medium`, `High`, `Critical`. |
| `INCLUDE_DETAILS` | `false` | `true` adds the incident title to the message. |
| `STATE_FILE` | `.incident-alert-state.json` | Where progress is saved. |

Treat the webhook URL like a password: anyone who has it can post to your channel.

## Where to take it

Incidents also carry `updatedAt`, so you can use `updatedAfter` instead of `createdAfter`
to alert when an incident's status changes. Filter by `status`, `patientId` or `caregiverId`
too. See the [Incidents reference](https://www.aveecare.com/docs/api).

More examples: [aveecare-examples](https://github.com/aveecare/aveecare-examples).
Built by [AveeCare](https://www.aveecare.com) — home care software.
[API docs](https://www.aveecare.com/docs/api) |
[Developers](https://www.aveecare.com/developers) |
[Partners](https://www.aveecare.com/partners)
