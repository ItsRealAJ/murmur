# Murmur — design decisions

Written before the redesign, so every value on screen can be traced to a reason.
Upstream's palette was Tailwind's defaults almost verbatim (`#2563eb`, `#ffffff`,
`#171717`, `#f5f5f5`) — fine, but identical to thousands of other apps, and the
main reason a fork reads as a reskin.

## Subject

An always-on-top dictation overlay used dozens of times a day by someone who is
**mid-task in a different application**. It appears over unknown backgrounds,
gets glanced at rather than read, and its whole job is to end at a blinking
cursor somewhere else.

That last clause drives most of what follows. Murmur's UI is never the thing
being looked at — it is the thing in the corner of your eye while you talk.

## Ground

Nouns from the subject's own world: **caret**, **amplitude**, **silence**,
**latency**, **transcript**, **host window**.

Two of these do real work below. A murmur is *speech barely above silence* —
low amplitude — and the interface takes that literally.

## Palette

Low chroma everywhere, with **exactly one saturated moment**: live audio. At
rest, Murmur sits close to its own ground; when it hears you, one value lifts.
That contrast is the identity, and it comes from the name rather than a mood
board.

| Role | Dark | Light | Note |
|---|---|---|---|
| ground | `#15120F` | `#F7F3ED` | **warm** bias, not cool — a cool grey would read clinical, and this thing sits next to your writing |
| surface | `#1C1815` | `#FFFCF7` | one tonal step, never a shadow (see Shape) |
| ink | `#EFE9E1` | `#1A1613` | warm off-white / warm near-black |
| ink-muted | `#9A9086` | `#6B625A` | |
| rule | `#2A2420` | `#E4DCD1` | |
| **live** | `#D96F4B` | `#BC381E` | ember. Appears **only** while audio is live |

`live` is deliberately not blue or purple (the category reflex — Wispr Flow,
upstream, and most competitors), and not red (which reads as an error, or as a
record button you must stop). Ember is warm, matches the neutral bias, and means
*active* rather than *alarming*.

Semantic colors (success / warning / danger) stay separate and are never used
for the live state.

Contrast was verified when the palette was chosen, not audited afterwards. The
first light-mode ember (`#C05531`) looked right but measured 4.14:1 against the
ground — below AA — so it was darkened to `#BC381E`, which clears 5.10:1 as text
and 5.51:1 as a fill under white while staying terracotta rather than sliding to
red. Every ink and accent pair now meets AA in both themes.

## Type

| Role | Face | Why |
|---|---|---|
| UI | Inter Variable (opsz) | already bundled, offline, and its optical-size axis means the pill's 11px labels and onboarding's display text come from one file |
| **Transcript** | system mono stack | the transcript is *literally what was heard* — data, not prose. Mono says "these are the exact words," which is the same promise the verbatim hotkey makes. Using the host OS's own mono (`ui-monospace`, SF Mono, Consolas) also costs zero bytes and matches the app the text is going into. |

Caveat (a handwriting face bundled upstream) is dropped. It has no relationship
to this subject.

## Space

Two registers, deliberately different numbers:

- **Intra-component** — 6px / 10px / 14px. Inside the pill, label-to-control,
  icon-to-text.
- **Section rhythm** — 28px / 44px. Between regions in the control panel and
  onboarding.

One value doing both jobs would assert that a pill's internals and a settings
page's sections carry equal weight. They don't.

## Shape

- **Radius 10px** for panels, cards, inputs. The pill itself stays a capsule
  because it is a pill; its *contents* use 10px.
- **Elevation by tonal step only — never shadow.** This is derived, not
  aesthetic: the pill floats over arbitrary host windows, and a drop shadow over
  an unknown background reads as smudge. Surfaces separate by one step of
  lightness instead.

## Motion

Three animated moments, 120–220ms, plus one continuous:

1. idle → listening: `live` blooms in (160ms)
2. amplitude: continuous while recording, driven by real audio (not a canned loop)
3. listening → processing: `live` drains to muted (220ms)

Everything respects `prefers-reduced-motion`, which for the waveform means
holding a static bar rather than freezing mid-animation.

## Signature

**The caret.** A blinking text caret inside the pill that the transcribed words
run into — stating in one element what the whole app does: your voice lands at a
cursor in someone else's window.

Boldness is spent here and nowhere else. Everything around it stays quiet.

## States

Weighted above appearance, because an inert interface is the strongest tell that
nobody used it. Every interactive element gets `:hover`, `:active`,
`:focus-visible`, and `:disabled`; every async surface gets loading, empty, and
error. `::selection` and `caret-color` are set rather than inherited.
