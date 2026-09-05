# Distributing Murmur

Everything needed to ship a release, and the reasoning behind the choices — so
whoever picks this up next knows which decisions were deliberate.

## The signing decision

Murmur ships **unsigned**: no Apple notarization, no Authenticode. Signing both
platforms properly costs roughly:

|                         | Cost     | What it buys                             |
| ----------------------- | -------- | ---------------------------------------- |
| Apple Developer Program | $99/yr   | Notarized `.dmg`, no Gatekeeper friction |
| Azure Trusted Signing   | ~$120/yr | Signed `.exe`, no SmartScreen warning    |

That was declined for a free community app. The consequence is real and worth
being honest about: a plain download shows a frightening warning on both
platforms, and on macOS 15+ the old right-click → Open bypass no longer works —
users get sent to System Settings to approve the app by hand.

**Package managers are the mitigation.** `brew install --cask --no-quarantine`
never applies the quarantine flag, so Gatekeeper never fires; Scoop downloads
and extracts without an installer, so SmartScreen never fires. Both pin a
SHA256, which preserves download integrity even without a signature.

What is genuinely lost: nothing proves a build came from you. A compromised
GitHub account or release pipeline has no second line of defence. If Murmur
gains traction, **Azure Trusted Signing at ~$10/month is the highest-value thing
to buy** — it's open to US/Canada individuals, and the build config already has
the shape for it (see "Adding signing later").

## Before the first release

Replace the placeholders. They're marked `ItsRealAJ`:

| File                         | What                                             |
| ---------------------------- | ------------------------------------------------ |
| `src/config/projectLinks.ts` | Repo, issues, docs, **Discord invite**           |
| `electron-builder.json`      | `publish.owner` / `publish.repo`                 |
| `src/updater.js`             | Auto-update feed — **must match** the line above |
| `INSTALL.md`                 | Both install commands                            |

If the updater feed and the publish target disagree, builds publish to one place
and clients check another, and auto-update silently never fires.

```sh
grep -rn ItsRealAJ --include='*.ts' --include='*.js' --include='*.json' --include='*.md' . | grep -v node_modules
```

## Cutting a release

```sh
npm version minor        # or patch / major — writes package.json and tags
git push && git push --tags
```

The tag push triggers `.github/workflows/release.yml`, which:

1. Runs `quality-check` and the full test suite — a broken build reaching 500
   people costs far more than a slow release
2. Builds macOS arm64, macOS x64, and Windows x64 in parallel
3. **Ad-hoc signs** the macOS bundles (not optional — see below)
4. Generates `SHA256SUMS.txt`, plus `murmur.rb` and `murmur.json`
5. Publishes a **draft** release — review it, then publish by hand

### Why ad-hoc signing is not optional

`electron-builder`'s `identity: null` _skips_ signing rather than signing
ad-hoc, and macOS refuses to execute an unsigned arm64 binary at all. The build
must run:

```sh
xattr -cr Murmur.app                       # or codesign rejects the bundle
codesign --force --deep --sign - Murmur.app
```

The `xattr` step is required: without it codesign fails with _"resource fork,
Finder information, or similar detritus not allowed."_ The workflow also repacks
the `.zip` afterwards, because electron-builder zips the bundle _before_ this
step runs.

## The tap and the bucket

Two small extra repos, created once:

**`homebrew-murmur`** — a Homebrew tap. Copy `murmur.rb` from each release into
`Casks/murmur.rb`. Users then run:

```sh
brew tap <you>/murmur
brew install --cask --no-quarantine murmur
```

**`scoop-murmur`** — a Scoop bucket. Copy `murmur.json` into `bucket/murmur.json`.

```powershell
scoop bucket add murmur https://github.com/<you>/scoop-murmur
scoop install murmur
```

Both manifests are generated with real checksums during the release, so this is
a copy, never a hand-edit.

## Testing before a wide release

You have no Windows machine. CI can _build_ Windows, but hotkeys and clipboard
injection are exactly the parts that break in platform-specific ways, and they
cannot be verified in CI.

Before announcing to the whole server, get the build in front of **two or three
Windows users** and confirm: the hotkey registers, dictation transcribes, and
text pastes into a normal app. A clean-VM install matters too — it's the only
test that reflects what a new user actually experiences.

## Adding signing later

Nothing needs restructuring; it's a credential swap.

**macOS** — join the Apple Developer Program, then in `electron-builder.json`
set `mac.identity` to your Developer ID and `mac.notarize` to `true`, add the
certificate and `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`
secrets, and delete the ad-hoc signing step from the workflow.

**Windows** — sign up for Azure Trusted Signing, then restore a
`win.azureSignOptions` block (`endpoint`, `certificateProfileName`,
`codeSigningAccountName`, `publisherName`) and add the Azure credentials as
secrets.

Once signed, drop `--no-quarantine` from the Homebrew instructions and simplify
`INSTALL.md` — most of that document exists only because the app is unsigned.

## Inherited upstream dependency

GPU-accelerated whisper binaries are downloaded from `OpenWhispr/whisper.cpp`
releases, and the Windows key-listener, fast-paste, and text-monitor helpers
from `OpenWhispr/openwhispr` releases. Murmur therefore depends on upstream's
release infrastructure at runtime. Building and hosting those yourself would
remove the coupling; until then, an upstream retag or deletion breaks downloads.
