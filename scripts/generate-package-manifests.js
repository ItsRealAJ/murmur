#!/usr/bin/env node
/**
 * Generates the Homebrew cask and Scoop manifest for a release.
 *
 * Murmur is not notarized or Authenticode-signed, so package managers are the
 * install path that keeps users out of Gatekeeper and SmartScreen dialogs:
 *
 *   brew install --cask --no-quarantine murmur
 *   scoop install murmur
 *
 * Both pin a SHA256, which is what makes that acceptable — the signature is
 * missing, but tampering in transit is still caught.
 *
 * Usage: node scripts/generate-package-manifests.js <releaseDir> <tag>
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const [, , releaseDir, rawTag] = process.argv;
if (!releaseDir || !rawTag) {
  console.error("Usage: generate-package-manifests.js <releaseDir> <tag>");
  process.exit(1);
}

const tag = rawTag.startsWith("v") ? rawTag : `v${rawTag}`;
const version = tag.replace(/^v/, "");

// Filled in by the release workflow from the repository it runs in, so the
// generated manifests never carry the placeholder from projectLinks.ts.
const repo = process.env.GITHUB_REPOSITORY || "REPLACE_WITH_YOUR_GITHUB_USER/murmur";
const downloadBase = `https://github.com/${repo}/releases/download/${tag}`;

const sha256 = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const files = fs.readdirSync(releaseDir);
const find = (re) => files.find((f) => re.test(f));

// macOS ships arm64 and x64 separately; Homebrew picks per-machine.
const armZip = find(/arm64.*\.zip$/i) || find(/\.zip$/i);
const x64Zip = find(/x64.*\.zip$/i);
const winExe = find(/\.exe$/i);

if (!armZip) {
  console.error("No macOS .zip found — cannot generate the Homebrew cask.");
  process.exit(1);
}

const armSha = sha256(path.join(releaseDir, armZip));
const x64Sha = x64Zip ? sha256(path.join(releaseDir, x64Zip)) : null;

const cask = `cask "murmur" do
  version "${version}"

${
  x64Zip
    ? `  on_arm do
    sha256 "${armSha}"
    url "${downloadBase}/${encodeURIComponent(armZip)}"
  end
  on_intel do
    sha256 "${x64Sha}"
    url "${downloadBase}/${encodeURIComponent(x64Zip)}"
  end`
    : `  sha256 "${armSha}"
  url "${downloadBase}/${encodeURIComponent(armZip)}"`
}

  name "Murmur"
  desc "Local-first voice dictation"
  homepage "https://github.com/${repo}"

  app "Murmur.app"

  # Murmur is ad-hoc signed, not notarized. Installing without --no-quarantine
  # leaves the app quarantined, and macOS 15+ sends users to System Settings ->
  # Privacy & Security to approve it by hand. The pinned sha256 above is what
  # still guarantees the download was not tampered with.
  caveats <<~EOS
    Install with:
      brew install --cask --no-quarantine murmur

    Murmur needs Accessibility and Input Monitoring permission to paste text
    and to read its hotkey. Grant both in System Settings -> Privacy & Security.
  EOS

  zap trash: [
    "~/Library/Application Support/Murmur",
    "~/Library/Caches/com.murmur.app",
    "~/Library/Preferences/com.murmur.app.plist",
    "~/.cache/murmur",
  ]
end
`;

const scoop = {
  version,
  description: "Local-first voice dictation. Hold a key, speak, text appears at your cursor.",
  homepage: `https://github.com/${repo}`,
  license: "MIT",
  architecture: {
    "64bit": {
      url: winExe ? `${downloadBase}/${encodeURIComponent(winExe)}` : undefined,
      hash: winExe ? sha256(path.join(releaseDir, winExe)) : undefined,
    },
  },
  bin: winExe ? [[winExe, "murmur"]] : undefined,
  checkver: { github: `https://github.com/${repo}` },
  autoupdate: {
    architecture: {
      "64bit": { url: `${downloadBase.replace(tag, "v$version")}/Murmur-$version-win-x64.exe` },
    },
  },
  notes: [
    "Murmur is not Authenticode-signed. Installing through Scoop avoids the",
    "SmartScreen installer prompt; the hash above still verifies the download.",
    "Grant microphone access when prompted on first use.",
  ],
};

fs.writeFileSync(path.join(releaseDir, "murmur.rb"), cask);
fs.writeFileSync(path.join(releaseDir, "murmur.json"), JSON.stringify(scoop, null, 2) + "\n");

console.log(`Wrote murmur.rb (cask) and murmur.json (scoop) for ${tag}`);
console.log(`  macOS arm64: ${armZip}  ${armSha.slice(0, 16)}…`);
if (x64Zip) console.log(`  macOS x64:   ${x64Zip}  ${x64Sha.slice(0, 16)}…`);
if (winExe) console.log(`  Windows:     ${winExe}`);
else console.warn("  No Windows .exe found — the Scoop manifest has no download URL.");
