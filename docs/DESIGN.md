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

Two of these do real work below. A murmur is _speech barely above silence_ —
low amplitude — and the interface takes that literally.

## Palette

Low chroma everywhere, with **exactly one saturated moment**: live audio. At
rest, Murmur sits close to its own ground; when it hears you, one value lifts.
That contrast is the identity, and it comes from the name rather than a mood
board.

| Role      | Dark      | Light     | Note                                                                                                                                              |
| --------- | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ground    | `#0B0F0C` | `#F1F4EF` | near-black and near-white, both pulled a few points toward green so the accent belongs to the same family rather than sitting on top of a neutral |
| surface   | `#121815` | `#FAFCF8` | one tonal step, never a shadow (see Shape)                                                                                                        |
| ink       | `#E6EDE7` | `#10150F` | 16.21:1 / 16.66:1                                                                                                                                 |
| ink-muted | `#8A968C` | `#5C665D` | 6.27:1 / 5.39:1 — muted, still AA for body text                                                                                                   |
| rule      | `#1E2620` | `#DDE3DA` |                                                                                                                                                   |
| **live**  | `#4FBF6E` | `#186538` | appears **only** while audio is live                                                                                                              |

The dark theme is the real one. Murmur is an always-on-top overlay that spends
its life over other people's windows, and black is the only ground that reads as
_absent_ until it has something to say.

Green is doing specific work here. It is not the category reflex — Wispr Flow,
upstream, and most competitors are blue or purple — and it is not red, which
reads as an error or as a record button you have to remember to stop. Green on
black is the one pairing that already means _live, running, receiving_ to
anyone who has looked at a terminal, which is exactly the state the accent
marks. That reflex is the reason to use it, and also the reason to use it once:
saturated green everywhere would read as a hacker-aesthetic costume rather than
a signal.

Contrast was verified when the palette was chosen, not audited afterwards:

- dark accent `#4FBF6E` on ground — **8.28:1**
- light accent `#186538` on ground — **6.40:1**
- white on the light accent as a fill — **7.10:1**
- ground on the dark accent as a fill — **8.28:1**

A mid-green (`#2E9E52`-ish) would have looked more "brand" in light mode and
measured 3.4:1. The light accent is dark enough to be a text colour, which is
what lets one token serve both the caret and a filled button.

Semantic colors (success / warning / danger) stay separate and are never used
for the live state. This costs something real: success is also green, so
success states are carried by icon and copy, and the accent never doubles as
"that worked".

**The one stated exception.** "Accent only while audio is live" governs the
dictation panel — the always-on-top surface where the colour _is_ the state
readout. Onboarding is a different surface with different rules: it is seen
once, it contains no live audio, and holding the line there produced a first
screen whose only colour came from three macOS system icons while Murmur's own
primary action sat in inert grey and read as already-disabled. So in onboarding
the accent marks the primary action. Nothing is diluted, because the two
surfaces are never on screen together.

## Type

| Role           | Face              | Why                                                                                                                                                                                                                                                                              |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI             | Schibsted Grotesk | commissioned for a news organisation — a face whose entire job is setting text _other people wrote_, which is also this app's job. Ships 400-900, and it is the weight range that carries the hierarchy below.                                                                   |
| **Transcript** | system mono stack | the transcript is _literally what was heard_ — data, not prose. Mono says "these are the exact words," the same promise the verbatim hotkey makes. Using the host OS's own mono (`ui-monospace`, SF Mono, Consolas) costs zero bytes and matches the app the text is going into. |

Inter is gone (it was upstream's, and it is the default of the entire category),
and so is Caveat, a handwriting face bundled upstream with no relationship to
this subject. Noto Sans is retained for CJK coverage only.

**Hierarchy is carried by weight and colour, not by size.** Murmur is dense
chrome that sits beside the user's actual work, so almost all of its text is
genuinely small — a scale with eight steps between 10px and 20px is not a scale,
it is eight things that look alike. The steps are:

| Token            | Size | Weight | Used for                    |
| ---------------- | ---- | ------ | --------------------------- |
| `--text-micro`   | 11px | 500    | keycaps, badges, counts     |
| `--text-body`    | 12px | 400    | the app's default           |
| `--text-label`   | 14px | 500    | section labels, list titles |
| `--text-display` | 32px | 700    | onboarding headings         |

Display is 2.7x body, so a heading never reads as slightly-enlarged body text.
Between micro and label the separation is weight and ink colour, which is what
a grotesque with a 400-900 range is for and what keeps a dense panel legible
without spending vertical space on type size.

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
  because it is a pill; its _contents_ use 10px.
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

**The caret.** A text caret inside the pill that the transcribed words run into
— stating in one element what the whole app does: your voice lands at a cursor
in someone else's window.

It does not blink. A real caret does, and the first version of this copied that,
including a rhythm that reported pipeline state. It was wrong for the subject:
the resting pill is always on screen, so a blinking accent is a permanent
distraction at the edge of someone's vision while they work — the opposite of a
control that is supposed to be quiet until spoken to. The waveform and the
pill's status label carry the state instead.

Boldness is spent here and nowhere else. Everything around it stays quiet.

## States

Weighted above appearance, because an inert interface is the strongest tell that
nobody used it. Every interactive element gets `:hover`, `:active`,
`:focus-visible`, and `:disabled`; every async surface gets loading, empty, and
error. `::selection` and `caret-color` are set rather than inherited.
