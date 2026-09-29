# Simplified Chinese Locale Cleanup Design

## Goal

Remove accidental Traditional Chinese and untranslated English from the Simplified Chinese locale, with special attention to the context usage indicator shown in the composer.

## Scope

- Clean all recently added user-facing entries in `client/src/locales/zh-Hans/translation.json`.
- Preserve product names, model names, API names, code identifiers, and technical abbreviations.
- Normalize context terminology to `上下文`, `上下文窗口`, and `上下文使用量`.
- Keep interpolation placeholders and JSON keys unchanged.

## Verification

- Parse the locale JSON and compare placeholder sets with English resources.
- Add a regression test for the context keys and representative cleaned entries.
- Run the locale test suite and frontend typecheck.
- Review the diff for accidental changes outside the Simplified Chinese resource.

## Out of scope

- No changes to token accounting, pruning, summarization, or backend context handling.
- No changes to other locale files.
