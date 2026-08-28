#!/usr/bin/env node
/**
 * Renders src/assets/logo.svg into every icon asset the app ships:
 * icon.png, icon.icns (macOS), icon.ico (Windows), and iconTemplate@3x.png
 * (the monochrome macOS menu-bar template).
 *
 * Uses Electron for rasterisation because it is already a dependency and draws
 * the SVG with the same engine the app does — no ImageMagick, no librsvg,
 * nothing extra for a contributor to install.
 *
 * Run with:  npm run icons
 */

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ASSETS = path.join(__dirname, "..", "src", "assets");
const SIZE = 1024;

const ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * One offscreen window, two captures.
 *
 * Two things that do not work here, both found the hard way: a BrowserWindow
 * smaller than roughly 50px never loads (so every size is downscaled from a
 * single 1024 capture), and creating a second offscreen window right after
 * destroying the first fails with ERR_FAILED (so the monochrome pass toggles a
 * CSS class in the same window rather than opening another).
 */
async function main() {
  const page = path.join(ASSETS, ".icon-render.html");
  fs.writeFileSync(
    page,
    `<!doctype html><meta charset="utf-8">
     <style>
       html,body{margin:0;padding:0;background:transparent;
                 width:${SIZE}px;height:${SIZE}px;overflow:hidden}
       img{width:${SIZE}px;height:${SIZE}px;display:block}
       body.mono img{filter:grayscale(1) brightness(0) invert(1)}
     </style>
     <img src="./logo.svg">`
  );

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true },
  });

  const at = (img, size) => img.resize({ width: size, height: size, quality: "best" }).toPNG();

  try {
    await win.loadFile(page);
    await new Promise((r) => setTimeout(r, 300));
    const master = await win.capturePage();

    fs.writeFileSync(path.join(ASSETS, "icon.png"), at(master, 1024));
    console.log("  icon.png         1024");

    const iconset = path.join(ASSETS, "murmur.iconset");
    fs.rmSync(iconset, { recursive: true, force: true });
    fs.mkdirSync(iconset, { recursive: true });
    for (const size of ICNS_SIZES) {
      fs.writeFileSync(path.join(iconset, `icon_${size}x${size}.png`), at(master, size));
      if (size <= 512) {
        fs.writeFileSync(path.join(iconset, `icon_${size}x${size}@2x.png`), at(master, size * 2));
      }
    }
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(ASSETS, "icon.icns")]);
    fs.rmSync(iconset, { recursive: true, force: true });
    console.log(`  icon.icns        ${ICNS_SIZES.join(", ")} (+@2x)`);

    // Minimal multi-size .ico: a 6-byte header, one 16-byte directory entry per
    // image, then the payloads. Modern Windows accepts PNG payloads directly,
    // so no BMP encoding is needed.
    const entries = ICO_SIZES.map((size) => ({ size, data: at(master, size) }));
    const header = Buffer.alloc(6);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(entries.length, 4);
    let offset = 6 + entries.length * 16;
    const dir = entries.map(({ size, data }) => {
      const e = Buffer.alloc(16);
      e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 encodes 256
      e.writeUInt8(size >= 256 ? 0 : size, 1);
      e.writeUInt16LE(1, 4);
      e.writeUInt16LE(32, 6);
      e.writeUInt32LE(data.length, 8);
      e.writeUInt32LE(offset, 12);
      offset += data.length;
      return e;
    });
    fs.writeFileSync(
      path.join(ASSETS, "icon.ico"),
      Buffer.concat([header, ...dir, ...entries.map((e) => e.data)])
    );
    console.log(`  icon.ico         ${ICO_SIZES.join(", ")}`);

    // macOS tints template images itself, so this one must be
    // black-on-transparent; the *Template suffix is what opts it in.
    await win.webContents.executeJavaScript("document.body.classList.add('mono')");
    await new Promise((r) => setTimeout(r, 250));
    const mono = await win.capturePage();
    fs.writeFileSync(path.join(ASSETS, "iconTemplate@3x.png"), at(mono, 66));
    console.log("  iconTemplate@3x  66 (monochrome)");
  } finally {
    win.destroy();
    fs.rmSync(page, { force: true });
  }

  app.exit(0);
}

app.whenReady().then(() =>
  main().catch((err) => {
    console.error(err);
    app.exit(1);
  })
);
