// Gameplay probe through branch environments: node scripts/probe-run.mjs [url] [outDir] [w] [h] [quality]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? '/tmp/probe-run';
const width = Number(process.argv[4] ?? 390);
const height = Number(process.argv[5] ?? 844);
const quality = process.argv[6] ?? 'medium';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: width < 900, reducedMotion: 'reduce' });
const page = await context.newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
page.on('console', (m) => m.type() === 'error' && logs.push(`[error] ${m.text()}`));
await page.goto(url);
await page.waitForSelector('[data-testid="main-menu"]', { timeout: 30000 });
await page.evaluate((q) => {
  const s = window.__mallrats.store;
  s.skipTutorial();
  s.updateSettings({ graphics: q, showControlHints: false });
  s.dev.unlockAll();
  s.dev.randomOutfit();
}, quality);
await page.click('[data-testid="play"]');
await page.waitForSelector('[data-testid="hud"]');
await page.evaluate(() => window.__mallrats.runtime.setAutopilot(true, ['foodcourt', 'atrium', 'deptstore', 'maintenance']));
const seen = new Map();
for (let i = 0; i < 70; i++) {
  await page.evaluate(() => window.__mallrats.runtime.fastForward(2.2));
  await page.waitForTimeout(350);
  const info = await page.evaluate(() => {
    const sim = window.__mallrats.runtime.sim;
    if (!sim) return null;
    return { env: sim.currentEnv, s: Math.round(sim.player.s), phase: sim.phase, mode: sim.player.mode, chunk: sim.course.chunkAt(sim.player.s)?.templateId };
  });
  if (!info || info.phase !== 'running') {
    const end = await page.evaluate(() => {
      const r = window.__mallrats.runtime;
      const sim = r.sim;
      if (!sim) return 'no sim';
      const o = sim.crashObstacle;
      return JSON.stringify({ reason: sim.endReason, s: sim.player.s, lane: sim.player.lane, target: sim.player.targetLane, mode: sim.player.mode, y: sim.player.y, pressure: sim.security.pressure, obstacle: o && { id: o.def.id, lanes: [o.laneMin, o.laneMax], s0: o.s0, s1: o.s1 }, chunk: sim.course.chunkAt(sim.player.s)?.templateId, failed: r.autopilot?.failedPlans });
    });
    console.log('RUN ENDED', end);
    break;
  }
  const key = `${info.env}`;
  const count = seen.get(key) ?? 0;
  if (count < 2) {
    seen.set(key, count + 1);
    await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}-${info.env}-${info.chunk}-${info.mode}.png` });
  }
}
fs.writeFileSync(`${out}/console.txt`, logs.join('\n'));
console.log([...seen.entries()].map(([k, v]) => `${k}:${v}`).join(' '));
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
