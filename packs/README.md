# Shared dictionary packs

A pack is a JSON word list published at an https URL. Subscribe to one in
**Dictionary → Shared packs**, and its words are recognised alongside your own —
so a community can fix the same set of mangled names once, for everybody.

## Format

```json
{
  "name": "Murmur community",
  "description": "Optional, shown nowhere yet",
  "words": ["Murmur", "whisper.cpp", "BYOK"]
}
```

A bare array of strings also works. Unknown fields are ignored.

## Publishing one

Host the file anywhere that serves it over https and subscribe to the raw URL.
A file in a GitHub repo works — use the `raw.githubusercontent.com` link, not the
HTML page.

Update the file and subscribers pick up the change on their next launch, or when
they hit **Refresh**.

## Limits, and why they exist

Pack words are injected into the speech model's prompt and appended to the
cleanup model's system prompt. That makes a pack **untrusted input to an LLM**,
so Murmur enforces:

| Limit               | Value                                              |
| ------------------- | -------------------------------------------------- |
| Words per pack      | 500                                                |
| Characters per word | 60                                                 |
| Document size       | 256 KB                                             |
| Scheme              | https only, no credentials in the URL              |
| Redirects           | refused (a redirect could leave the vetted origin) |

Entries containing control characters, `<` `>` `{` `}` or backticks, or that
start with `system:` / `assistant:` / `user:`, are **dropped rather than
escaped** — a dictionary word has no legitimate need for them, and dropping is
the only handling that cannot be worked around.

Only subscribe to packs from people you trust. A pack cannot execute anything,
but it can waste your prompt budget on junk words, and a hostile one would try
to steer the cleanup model.

## Your own words are safe

Pack words are stored separately from your personal dictionary. Refreshing a
pack never touches your own entries, disabling one takes its words out of play
instantly, and unsubscribing removes exactly what that pack contributed.
