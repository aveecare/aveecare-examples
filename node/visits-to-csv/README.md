# visits-to-csv

Export a date range of [AveeCare](https://www.aveecare.com) visits to a CSV file, using the
[`aveecare` Node.js library](https://github.com/aveecare/aveecare-node).

## What it does

- Lists every visit that starts in the range you give, following the API's pages for you
  with the library's `for await` auto-paging.
- Splits ranges longer than the API's 93-day window into chunks, so you can ask for a whole
  year.
- Writes `id, start_time, end_time, status, patient_id, caregiver_id, title, service_code,
  billable_hours, evv_status, billing_status` as properly quoted CSV. Cells that start with
  `=`, `+`, `-` or `@` get a leading apostrophe so Excel and Google Sheets show them as
  text instead of running them as formulas.

## Run it

Needs Node.js 20.12 or newer.

```sh
npm install
cp .env.example .env      # then put your API key in .env
npm start -- --from 2026-10-01 --to 2026-11-01 --out october.csv
```

`--to` is the day to stop at and is not included, so the example above covers all of October.

| Option | |
|---|---|
| `--from`, `--to` | The range, as `YYYY-MM-DD` (UTC). Required. |
| `--status` | Only one status: `Scheduled`, `InProgress`, `Cancelled`, `Completed`, `Late`, `OverTime` or `Incomplete`. |
| `--patient-id`, `--caregiver-id` | Only that patient's or that caregiver's visits. |
| `--page-size` | Visits per request, 1 to 100. Default 100, which makes the fewest requests. |
| `--out` | Output file. Default `visits.csv`. |

The CSV holds IDs, not names. Match them to patients and caregivers with
`avee.patients.list()` and `avee.caregivers.list()` if you need names in the same file.

## How it works

```js
import AveeCare from 'aveecare';

const avee = new AveeCare();
for await (const visit of avee.visits.list({
  startFrom: '2026-10-01T00:00:00.000Z',
  startTo: '2026-11-01T00:00:00.000Z',
  limit: 100,
})) {
  console.log(visit.id, visit.status);
}
```

Rate limits: each key may make 60 requests a minute. A month of visits is a handful of
requests, and the library waits and retries when the API answers `429 Too Many Requests`.

## Configuration

| Variable | |
|---|---|
| `AVEECARE_API_KEY` | Your API key from Settings → API Keys. |
| `AVEECARE_BASE_URL` | Optional. Only to point at a sandbox. |

More examples: [aveecare-examples](https://github.com/aveecare/aveecare-examples).
Built by [AveeCare](https://www.aveecare.com) — home care software.
[API docs](https://www.aveecare.com/docs/api) |
[Developers](https://www.aveecare.com/developers) |
[Partners](https://www.aveecare.com/partners)
