// Screenshot driver: serves the game, renders the four staged shots in
// headless Chromium, and converts them to JPEGs under screenshots/.
// Usage: node shots.mjs  (serves on port 8123, seed 1)
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const SHELL =
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PORT = 8123;
const SHOTS = [
  { name: '1-cover.jpg', query: '?shot=rings&seed=1' },
  { name: '2-takeoff.jpg', query: '?shot=takeoff&seed=1' },
  { name: '3-landing.jpg', query: '?shot=landing&seed=1' },
  { name: '4-cockpit.jpg', query: '?shot=cockpit&seed=1' },
];

const server = spawn(process.execPath, [join(here, 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1200));

function shot(url, out) {
  execSync(
    `"${SHELL}" --headless --no-sandbox --disable-gpu --hide-scrollbars ` +
      `--screenshot="${out}" --window-size=1280,800 --virtual-time-budget=6000 "${url}"`,
    { stdio: 'pipe' },
  );
}

try {
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  for (const s of SHOTS) {
    const png = join(here, 'screenshots', s.name.replace(/\.jpg$/, '.png'));
    const jpg = join(here, 'screenshots', s.name);
    shot(`http://localhost:${PORT}/game/index.html${s.query}`, png);
    // Convert to JPEG with PIL, quality tuned to stay under 256 KiB.
    execSync(
      `python3 -c "from PIL import Image; im=Image.open('${png}').convert('RGB'); im.save('${jpg}', quality=88, optimize=True)"`,
      { stdio: 'pipe' },
    );
    console.log(s.name, 'done');
  }
} finally {
  server.kill();
}
console.log('all shots done');
