# credential-expiry-report

List the [AveeCare](https://www.aveecare.com) caregiver certifications and state licenses
that expire within the next N days, as a table or a CSV file, using the
[`aveecare` Python library](https://github.com/aveecare/aveecare-python).

```text
Credentials expiring within 30 days of 2026-10-05 (5 active caregivers checked):

Caregiver      Credential           Expires     Days left
-------------  -------------------  ----------  ---------
Maria Gomez    CPR                  2026-10-08  3
Chen Wei, Jr.  Flu Shot             2026-10-10  5
James Okafor   State license (CNA)  2026-10-17  12
```

## Run it

Needs Python 3.9 or newer.

```sh
python -m venv .venv
source .venv/bin/activate          # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then put your API key in .env
python credential_expiry_report.py --days 30
```

| Option | |
|---|---|
| `--days` | How far ahead to look. Default 30. |
| `--include-expired` | Also list credentials that already expired, with negative days left. |
| `--csv FILE` | Write a CSV (`caregiver, caregiver_id, credential, expires, days_left`) instead of a table. |
| `--page-size` | Records per request, 1 to 100. Default 100, which makes the fewest requests. |
| `--as-of YYYY-MM-DD` | Pretend today is this date. Handy for checking a report ahead of time. |

## How it works

```python
from aveecare import AveeCare

client = AveeCare()
caregivers = list(client.caregivers.list(status="Active", limit=100))   # every page
certifications = list(client.certifications.list(limit=100))           # every page
```

The API does not filter certifications by expiry date, so the script reads them all and
compares each `expires` date itself. It only reports caregivers whose status is `Active`,
and it adds each caregiver's state license (`state_license_expiry`) alongside their
certifications. Certifications with no expiry date are skipped.

Rate limits: each key may make 60 requests a minute. Two lists of a few hundred records
take only a few requests, and the library retries politely if the API asks it to slow down.

Run it weekly from cron or a scheduled task, and send the CSV to whoever chases renewals.
Treat the CSV as confidential: it names your staff.

## Configuration

| Variable | |
|---|---|
| `AVEECARE_API_KEY` | Your API key from Settings → API Keys. A read-only key is enough. |
| `AVEECARE_BASE_URL` | Optional. Only to point at a sandbox. |

More examples: [aveecare-examples](https://github.com/aveecare/aveecare-examples).
Built by [AveeCare](https://www.aveecare.com) — home care software.
[API docs](https://www.aveecare.com/docs/api) |
[Developers](https://www.aveecare.com/developers) |
[Partners](https://www.aveecare.com/partners)
