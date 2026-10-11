// Ad-hoc visual probe of menu screens: node scripts/probe-menus.mjs [url] [outDir] [w] [h]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? '/tmp/probe-menus';
const width = Number(process.argv[4] ?? 390);
const height = Number(process.argv[5] ?? 844);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: width < 900, reducedMotion: 'reduce' });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url);
await page.waitForSelector('[data-testid="main-menu"]', { timeout: 30000 });
await page.evaluate(() => {
  const s = window.__mallrats.store;
  s.dev.grantCash(5000);
  s.dev.grantBagOfRarity('epic');
  s.dev.grantBagOfRarity('rare');
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/01-menu.png` });

const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}.png` });
};

await page.click('[data-testid="open-shop"]');
await shot('02-shop');
await page.click('[data-testid="item-top_varsity"]');
await shot('03-shop-tryon');
await page.click('[data-testid="cancel-preview"]');
await page.click('[data-testid="cat-boards"]');
await page.click('[data-testid="item-board_flame"]');
await shot('04-shop-board');
await page.click('[data-testid="buy"]');
await shot('05-confirm');
await page.click('[data-testid="confirm-buy"]');
await shot('06-purchased');
await page.click('[data-testid="equip-purchased"]');
await page.click('[data-testid="back"]');
await page.click('[data-testid="open-wardrobe"]');
await shot('07-wardrobe');
await page.click('[data-testid="tab-look"]');
await shot('08-look');
await page.click('[data-testid="tab-boards"]');
await shot('09-boards');
await page.click('[data-testid="tab-presets"]');
await shot('10-presets');
await page.click('[data-testid="back"]');
await page.click('[data-testid="reveal-banner"]');
await page.click('[data-testid="reveal-all"]');
await shot('11-reveal');
await page.click('[data-testid="back"]');
await page.click('[data-testid="open-missions"]');
await shot('12-missions');
await page.click('[data-testid="back"]');
await page.click('[data-testid="open-stats"]');
await shot('13-stats');
await page.click('[data-testid="open-collection"]');
await shot('14-collection');
await page.click('[data-testid="back"]');
await page.click('[data-testid="back"]');
await page.click('[data-testid="open-settings"]');
await shot('15-settings');
await page.click('[data-testid="back"]');
await page.click('[data-testid="wallet"]');
await shot('16-cash');
await page.click('[data-testid="back"]');
await page.click('[data-testid="play"]');
await page.waitForTimeout(300);
if (await page.$('[data-testid="tutorial-offer"]')) {
  await shot('17-tutorial-offer');
  await page.click('[data-testid="start-tutorial"]');
  await page.waitForTimeout(3500);
  await shot('18-tutorial');
}
fs.writeFileSync(`${out}/console.txt`, logs.join('\n'));
console.log(logs.filter((l) => !l.includes('React DevTools')).slice(0, 40).join('\n'));
await browser.close();
