# Security Policy

## Reporting a vulnerability

Please report security issues privately to **security@aveecare.com**. Do not
open a public GitHub issue, pull request or discussion for a vulnerability.

Include what you can of the following:

- the affected example and version (aveecare-examples)
- a description of the issue and its impact
- steps to reproduce or a proof of concept

We will acknowledge your report, keep you informed while we investigate, and
credit you in the release notes if you would like.

## Scope

This repository contains sample applications. Issues in the AveeCare API or application itself
are also welcome at the same address.

## Handling API keys

AveeCare API keys grant access to agency data. Keep them on servers only: never
ship a key in a browser, a mobile app or a public repository. If a key is
exposed, revoke it in AveeCare right away and create a new one.

## Supported versions

Security fixes are released for the latest minor version.
