# sync-patients-to-sheet

Export your [AveeCare](https://www.aveecare.com) patients to a CSV file that imports straight
into Google Sheets (or Excel), using the
[`aveecare` Python library](https://github.com/aveecare/aveecare-python). There is no Google
API, account linking or extra dependency: you upload the file yourself.

## Run it

Needs Python 3.9 or newer.

```sh
python -m venv .venv
source .venv/bin/activate          # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then put your API key in .env
python sync_patients_to_sheet.py --active --out patients.csv
```

Then in Google Sheets choose **File → Import → Upload**, pick `patients.csv`, and choose
**Replace spreadsheet** (or **Insert new sheet**).

| Option | |
|---|---|
| `--out` | Output file. Default `patients.csv`. |
| `--active` | Only active clients. |
| `--status` | Only one status, for example `Prospect` or `Discharged`. |
| `--lifecycle-stage` | `Prospect` or `Client`. |
| `--office-id` | Only one office. |
| `--updated-after` | Only patients changed after this time (ISO 8601). |
| `--columns` | Comma-separated columns to write. |
| `--page-size` | Patients per request, 1 to 100. Default 100, which makes the fewest requests. |

The default columns are `id, first_name, last_name, status, lifecycle_stage, email, address,
city, state, zip_code, office_id, updated_at`. Others you can add with `--columns`:
`middle_name, goes_by_name, date_of_birth, gender, primary_language, active, service_type,
created_at`.

## Keep a sheet up to date

When it finishes, the script prints the newest change it saw. Next time pass that as
`--updated-after` to fetch only patients changed since, and write to a different file:

```sh
python sync_patients_to_sheet.py --updated-after 2026-10-04T22:25:44Z --out changes.csv
```

That is the API's incremental sync filter: far fewer requests than downloading everyone
again. Each key may make 60 requests a minute, and 100 patients come back per request.

## Be careful with patient data

A Google Sheet is easy to share by accident. This CSV holds names, addresses and contact
details, so before you import it:

- keep the sheet private to the few people who need it, and check your agency's
  agreements with Google cover protected health information;
- leave out columns you do not need (the defaults omit date of birth for this reason);
- delete the CSV from your computer afterwards.

Cells that start with `=`, `+`, `-` or `@` get a leading apostrophe so a spreadsheet
shows them as text instead of running them as formulas.

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
