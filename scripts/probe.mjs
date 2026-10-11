// Ad-hoc visual probe: node scripts/probe.mjs [url] [outDir]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? '/tmp/probe';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url);
await page.waitForSelector('[data-testid="main-menu"]', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/01-menu.png` });

await page.click('[data-testid="play"]');
const offer = await page.$('[data-testid="tutorial-offer"]');
if (offer) await page.click('[data-testid="skip-tutorial"]');
await page.waitForSelector('[data-testid="hud"]');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/02-run-start.png` });
await page.evaluate(() => window.__mallrats.runtime.setAutopilot(true));
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/03-run-mid.png` });
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/04-run-later.png` });
await page.evaluate(() => window.__mallrats.runtime.sim.security.add(100));
await page.waitForSelector('[data-testid="results"]', { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/05-results.png` });
fs.writeFileSync(`${out}/console.txt`, logs.join('\n'));
console.log(logs.filter((l) => !l.startsWith('[debug]')).slice(0, 40).join('\n'));
await browser.close();
