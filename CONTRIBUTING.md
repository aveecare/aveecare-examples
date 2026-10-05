# Contributing to aveecare-examples

Thanks for helping improve the AveeCare sample apps.

## What is welcome

- Fixes and clearer explanations for the existing examples.
- New examples in any language that has an official
  [AveeCare library](https://github.com/aveecare), especially for jobs an agency actually
  does: reports, exports, reminders, and syncs to other tools.

## Ground rules for an example

- **Small and readable.** One job, one script, a README that says what it does and how to run it.
- **Only the official library as a dependency.** Depend on the published package
  (`aveecare` on npm or PyPI), never on a path or a git URL. Anything else you need
  should come with the language itself.
- **Use only what the API documents.** Resources, fields and filters must exist in the
  [OpenAPI specification](https://github.com/aveecare/aveecare-openapi).
- **Read keys from the environment.** Provide an `.env.example`, support the optional
  `AVEECARE_BASE_URL`, and never write a key into code, logs or output.
- **Treat the data as private.** Examples touch patient and caregiver records. Keep
  output to what the job needs, and avoid sending names or details to third parties by
  default.
- **Be kind to the API.** Use the library's pagination, ask for 100 records per request,
  filter on the server side where a filter exists, and poll no faster than once a minute.
  Each key may make 60 requests a minute.
- **Made-up data only** in documentation, tests and screenshots.

## Pull requests

1. Open an issue first for a new example or anything larger than a small fix.
2. Run your example against a sandbox or a read-only key and say how you checked it.
3. Add a line to `CHANGELOG.md` under "Unreleased".

By contributing you agree that your contributions are licensed under the MIT
License, and you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

Security issues: please follow [SECURITY.md](SECURITY.md) instead of opening a
public issue.
