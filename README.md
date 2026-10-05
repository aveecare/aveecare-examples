# AveeCare Examples

[![CI](https://github.com/aveecare/aveecare-examples/actions/workflows/ci.yml/badge.svg)](https://github.com/aveecare/aveecare-examples/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Small, runnable sample apps built on the official libraries for the
[AveeCare API](https://www.aveecare.com/docs/api), the API of AveeCare's home care
software. Copy one, change it, and make it yours.

| Example | Language | What it does |
|---|---|---|
| [`node/visits-to-csv`](node/visits-to-csv) | Node.js | Export a date range of visits to a CSV file, paging through every result |
| [`node/incident-slack-alert`](node/incident-slack-alert) | Node.js | Post each new incident report to a Slack channel as it is filed |
| [`python/credential-expiry-report`](python/credential-expiry-report) | Python | List caregiver certifications and licenses that expire within N days, as a table or CSV |
| [`python/sync-patients-to-sheet`](python/sync-patients-to-sheet) | Python | Export patients to a CSV that imports straight into Google Sheets |

Every example has its own README, an `.env.example`, and only one dependency: the
`aveecare` package ([npm](https://www.npmjs.com/package/aveecare),
[PyPI](https://pypi.org/project/aveecare/)).

## Before you start

1. In AveeCare open **Settings → API Keys** and create a key. **Read-only** is enough
   for every example here.
2. Copy the example's `.env.example` to `.env` and paste the key in. Never commit `.env`.

Keep keys on your own computer or server. The examples read patient and caregiver
records, so treat the files they write as confidential too: store them somewhere
protected, and delete them when you are done.

## Good API citizens

Each key may make 60 requests a minute. The examples ask for 100 records per request,
let the library retry politely when the API says to slow down, and ask the API for only
what changed instead of downloading everything again. Do the same in your own code.

## Developing against a local copy of a library

The examples depend on the published packages. To try an example against an unreleased
checkout of a library instead, install the library from its folder. This is for
development only, so do not commit the change to `package.json` or `requirements.txt`.

```sh
# Node.js: build the library once (npm run build in its folder), then from the example's folder
npm install --no-save ../../../aveecare-node

# Python: from the example's folder, inside a virtual environment
pip install ../../../aveecare-python
```

## Official SDKs and tools

- [aveecare-node](https://github.com/aveecare/aveecare-node): Node.js and TypeScript
- [aveecare-python](https://github.com/aveecare/aveecare-python): Python
- [aveecare-rust](https://github.com/aveecare/aveecare-rust): Rust
- [aveecare-go](https://github.com/aveecare/aveecare-go): Go
- [aveecare-ruby](https://github.com/aveecare/aveecare-ruby): Ruby
- [aveecare-php](https://github.com/aveecare/aveecare-php): PHP
- [aveecare-java](https://github.com/aveecare/aveecare-java): Java and Kotlin
- [aveecare-dotnet](https://github.com/aveecare/aveecare-dotnet): .NET
- [aveecare-cli](https://github.com/aveecare/aveecare-cli): command line
- [aveecare-openapi](https://github.com/aveecare/aveecare-openapi): OpenAPI specification
- [aveecare-mcp](https://github.com/aveecare/aveecare-mcp): connect AI assistants
- [aveecare-examples](https://github.com/aveecare/aveecare-examples): sample apps

## Learn more

- [AveeCare](https://www.aveecare.com): home care software
- [API documentation](https://www.aveecare.com/docs/api)
- [Developers](https://www.aveecare.com/developers)
- [Partner Center](https://www.aveecare.com/partners): building an integration to offer other agencies?

## License

MIT. See [LICENSE](LICENSE).

---

Built by [AveeCare](https://www.aveecare.com) — home care software.

Suggested GitHub topics and keywords are listed in [`.github/TOPICS.md`](.github/TOPICS.md).
