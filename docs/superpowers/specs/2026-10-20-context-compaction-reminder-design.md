# Context Compaction Reminder Design

## Goal

Make manual context compaction discoverable when the active conversation is using most of its known context window, without interrupting the current chat.

## User Experience

- When known context usage rises above 80%, show a small reminder at the top edge of the composer if the deployment has compaction enabled and the current conversation can be compacted.
- The reminder explains that the context window is nearly full and offers a one-click `Compact context` action using the existing compaction flow.
- The reminder has a close button. Dismissing it hides it until usage falls to 80% or lower; a later rise above 80% while eligible shows it again.
- Hide the reminder while context usage is unknown, compaction is disabled or unsupported, the conversation is new or otherwise not actionable, or a request is in progress.
- Use a subtle breathing animation and disable it when the operating system requests reduced motion.
- Localize the reminder and action in English and Simplified Chinese. Other locale bundles may use the existing English fallback until their translations are maintained.

## Implementation

- Reuse `useTokenUsage`'s existing `percent` and `maxTokens` values; do not add another token calculation or network request.
- Reuse `useCompactConversation` for compaction eligibility, state, and action.
- Keep reminder visibility and dismissal state within the context usage indicator, resetting dismissal when the usage returns to 80% or lower or the active conversation changes.
- Render the reminder within the composer, with semantic theme roles and accessible labels for its action and close button. Announce its appearance politely without exposing animation updates to assistive technology.
- Add locale keys to the English source and the Simplified Chinese resource.

## Verification

- Add focused tests for visibility above 80%, hidden states at or below 80% and when compaction is unavailable, the one-click action, dismissal, and reappearance after the threshold resets.
- Verify the localized reminder strings and English-key coverage in Simplified Chinese.
- Run the focused context usage UI and locale tests, frontend typecheck, and `git diff --check`.

## Out of Scope

- Changing context token calculations, compaction eligibility, or the existing compaction request flow.
- Automatically compacting context or opening a modal/popover.
- Persisting dismissal across page reloads or across separate threshold episodes.
