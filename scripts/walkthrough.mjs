import { chromium } from '@playwright/test';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const out = process.argv[3] ?? '/opt/cursor/artifacts';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--window-position=745,60',
    '--window-size=430,980',
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-testid="main-menu"]', { timeout: 30000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/menu_phone.png` });

await page.click('[data-testid="open-shop"]');
await page.waitForSelector('[data-testid="shop"]');
await page.waitForTimeout(700);
await page.click('[data-testid="item-hat_cuffed_beanie"]');
await page.waitForSelector('[data-testid="preview-banner"]');
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/shop_tryon_beanie.png` });
await page.click('[data-testid="cancel-preview"]');
await page.waitForTimeout(400);

await page.evaluate(() => window.__mallrats.store.dev.grantCash(5000));
await page.click('[data-testid="item-hat_dad_cap"]');
await page.click('[data-testid="buy"]');
await page.waitForSelector('[data-testid="confirm-purchase"]');
await page.click('[data-testid="confirm-buy"]');
await page.waitForSelector('[data-testid="purchased"]');
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/shop_purchased.png` });
await page.click('[data-testid="equip-purchased"]');
await page.waitForTimeout(600);
await page.click('[data-testid="back"]');

await page.click('[data-testid="open-wardrobe"]');
await page.waitForSelector('[data-testid="wardrobe"]');
await page.click('[data-testid="tab-look"]');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/wardrobe_look.png` });
await page.click('[data-testid="back"]');

await page.click('[data-testid="play"]');
await page.waitForSelector('[data-testid="tutorial-offer"]');
await page.screenshot({ path: `${out}/tutorial_offer.png` });
await page.click('[data-testid="skip-tutorial"]');
await page.waitForSelector('[data-testid="hud"]');
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/run_hud.png` });
await page.click('[data-testid="pause"]');
await page.waitForSelector('[data-testid="pause-menu"]');
await page.click('[data-testid="quit-run"]');
await page.click('[data-testid="confirm-quit"]');
await page.waitForSelector('[data-testid="results"]');
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/results.png` });
await page.click('[data-testid="results-menu"]');
await page.waitForSelector('[data-testid="main-menu"]');
await page.waitForTimeout(800);

await browser.close();
console.log('walkthrough screenshots written to', out);
