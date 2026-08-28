# Installing Murmur

Murmur is **not code-signed**. That's a deliberate cost decision, not an
oversight — signing costs about $220/year, and Murmur is free. The trade-off is
that your OS doesn't recognise the publisher, so the plain download shows a
scary warning.

**The package-manager install below avoids that warning entirely.** It's one
line, and it's the recommended path on both platforms.

---

## macOS

```sh
brew tap REPLACE_WITH_YOUR_GITHUB_USER/murmur
brew install --cask --no-quarantine murmur
```

`--no-quarantine` is what skips the Gatekeeper prompt. Without it, macOS 15 and
newer make you go to **System Settings → Privacy & Security** and click "Open
Anyway" by hand.

<details>
<summary>No Homebrew? Manual install</summary>

1. Download the `.dmg` for your chip from [Releases](https://github.com/REPLACE_WITH_YOUR_GITHUB_USER/murmur/releases)
   — `arm64` for Apple Silicon (M1 and later), `x64` for Intel.
2. Drag Murmur to Applications.
3. Remove the quarantine flag, or macOS will refuse to open it:
   ```sh
   xattr -cr /Applications/Murmur.app
   ```
4. Open it normally.

</details>

### Permissions macOS will ask for

| Permission | Why | When |
|---|---|---|
| **Microphone** | To hear you | Popup on first dictation — click Allow |
| **Accessibility** | To paste text into other apps | Grant by hand in Settings |
| **Input Monitoring** | To notice your hotkey | Grant by hand in Settings |

The last two can't be granted by a popup — macOS requires you to add Murmur in
**System Settings → Privacy & Security** yourself. Murmur will point you there
during setup.

> **Accessibility only takes effect after a restart.** If the hotkey does
> nothing right after you grant it, quit Murmur completely and reopen it.

---

## Windows

```powershell
scoop bucket add murmur https://github.com/REPLACE_WITH_YOUR_GITHUB_USER/scoop-murmur
scoop install murmur
```

<details>
<summary>No Scoop? Manual install</summary>

1. Download the `.exe` from [Releases](https://github.com/REPLACE_WITH_YOUR_GITHUB_USER/murmur/releases).
2. Windows will say **"Windows protected your PC."** That's SmartScreen not
   recognising an unsigned publisher — not a virus warning.
3. Click **More info** → **Run anyway**.

</details>

Windows asks for microphone access on first dictation. Nothing else to grant.

---

## First run

1. Pick **local** (downloads a speech model, works offline, free forever) or
   **your own API key**. There is no account and nothing to pay for.
2. Choose a hotkey.
3. Hold it, say a sentence, release. The text lands wherever your cursor is.

The local model is a few hundred MB and downloads once.

---

## Verifying your download

Every release publishes `SHA256SUMS.txt`. Homebrew and Scoop check this for you
automatically. To check a manual download:

```sh
# macOS
shasum -a 256 ~/Downloads/Murmur-*.dmg

# Windows PowerShell
Get-FileHash .\Murmur-*.exe -Algorithm SHA256
```

Compare against `SHA256SUMS.txt` on the release page. This is worth doing
precisely *because* the app isn't signed: the checksum is what proves you got
the file we built.

---

## If something goes wrong

**The hotkey does nothing (macOS).** Accessibility and Input Monitoring both
need granting, and Murmur must be restarted afterwards.

**"Murmur is damaged and can't be opened."** The quarantine flag is still set.
Run `xattr -cr /Applications/Murmur.app`, or reinstall via Homebrew with
`--no-quarantine`.

**Text appears in the wrong app.** Murmur pastes into whatever was focused when
you *started* talking. Click into the target field first, then hold the hotkey.

**Nothing is transcribed.** Check the model finished downloading in
Settings → Speech-to-Text, and that the right microphone is selected.

Still stuck? Ask in the Discord — include your OS version and whether you
installed via package manager or by hand.
