import { expect, test, type Page } from '@playwright/test';

type MallRats = {
  store: {
    cash: number;
    snapshot: { equipped: Record<string, string | null>; wallet: { cash: number }; owned: Record<string, unknown>; duplicates: Record<string, number> };
    dev: {
      grantCash: (n: number) => void;
      setCash: (n: number) => void;
      unlockAll: () => void;
      addDuplicates: () => void;
      grantBagOfRarity: (r: string) => void;
    };
  };
};

async function boot(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible({ timeout: 30_000 });
}

async function mall(page: Page): Promise<MallRats> {
  return page.evaluate(() => {
    const g = (window as unknown as { __mallrats?: MallRats }).__mallrats;
    if (!g) throw new Error('dev hooks missing');
    return g;
  });
}

async function grantCash(page: Page, amount: number) {
  await page.evaluate((n) => {
    (window as unknown as { __mallrats: MallRats }).__mallrats.store.dev.grantCash(n);
  }, amount);
}

test.describe('Mall Rats flows', () => {
  test('the main menu opens with shop, wardrobe and skate actions', async ({ page }) => {
    await boot(page);
    await expect(page.getByTestId('play')).toBeVisible();
    await expect(page.getByTestId('open-shop')).toBeVisible();
    await expect(page.getByTestId('open-wardrobe')).toBeVisible();
    await expect(page.getByTestId('open-missions')).toBeVisible();
    await expect(page.getByTestId('stage')).toBeVisible();
  });

  test('shop browse, try-on preview and cancel restore the owned look', async ({ page }) => {
    await boot(page);
    await page.getByTestId('open-shop').click();
    await expect(page.getByTestId('shop')).toBeVisible();
    await page.getByTestId('item-hat_cuffed_beanie').click();
    await expect(page.getByTestId('preview-banner')).toContainText('Cuffed Beanie');
    await expect(page.getByTestId('item-detail')).toContainText('Cosmetic only');
    await page.getByTestId('cancel-preview').click();
    await expect(page.getByTestId('preview-banner')).toHaveCount(0);
    await page.getByTestId('back').click();
    await expect(page.getByTestId('main-menu')).toBeVisible();
  });

  test('insufficient funds offers a save-for goal instead of charging', async ({ page }) => {
    await boot(page);
    await page.getByTestId('open-shop').click();
    await page.getByTestId('item-hat_cuffed_beanie').click();
    await page.getByTestId('buy').click();
    await expect(page.getByTestId('insufficient-funds')).toBeVisible();
    await expect(page.getByTestId('shortfall-amount')).toContainText('350');
    await page.getByTestId('shortfall-save').click();
    await page.getByTestId('back').click();
    await expect(page.getByTestId('goal-widget')).toContainText('Cuffed Beanie');
  });

  test('buying a cosmetic equips only when the player chooses, then wardrobe wear works', async ({ page }) => {
    await boot(page);
    await grantCash(page, 10_000);
    await page.getByTestId('open-shop').click();
    await page.getByTestId('item-hat_cuffed_beanie').click();
    await page.getByTestId('buy').click();
    await expect(page.getByTestId('confirm-purchase')).toBeVisible();
    await page.getByTestId('confirm-buy').click();
    await expect(page.getByTestId('purchased')).toBeVisible();
    await page.getByTestId('keep-shopping').click();
    const equipped = await page.evaluate(
      () => (window as unknown as { __mallrats: MallRats }).__mallrats.store.snapshot.equipped.headwear,
    );
    expect(equipped).toBeNull();
    await page.getByTestId('equip').click();
    const worn = await page.evaluate(
      () => (window as unknown as { __mallrats: MallRats }).__mallrats.store.snapshot.equipped.headwear,
    );
    expect(worn).toBe('hat_cuffed_beanie');
    await page.getByTestId('back').click();
    await page.getByTestId('open-wardrobe').click();
    await expect(page.getByTestId('wardrobe')).toBeVisible();
    await page.getByTestId('wslot-headwear').click();
    await page.getByTestId('none-headwear').click();
    const cleared = await page.evaluate(
      () => (window as unknown as { __mallrats: MallRats }).__mallrats.store.snapshot.equipped.headwear,
    );
    expect(cleared).toBeNull();
    await page.getByTestId('tab-look').click();
    await expect(page.getByTestId('look')).toBeVisible();
    await page.getByTestId('hair-mohawk').click();
    await page.getByTestId('tab-presets').click();
    await page.getByTestId('preset-save-0').click();
    await page.getByTestId('tab-look').click();
    await page.getByTestId('hair-swoop').click();
    await page.getByTestId('tab-presets').click();
    await page.getByTestId('preset-load-0').click();
    const hair = await page.evaluate(
      () => (window as unknown as { __mallrats: MallRats }).__mallrats.store.snapshot.appearance.hairStyle,
    );
    expect(hair).toBe('mohawk');
  });

  test('duplicate extras can be sold while the owned copy is kept', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const s = (window as unknown as { __mallrats: MallRats }).__mallrats.store;
      s.dev.unlockAll();
      s.dev.addDuplicates();
    });
    await page.getByTestId('open-wardrobe').click();
    await page.getByTestId('tab-duplicates').click();
    await expect(page.getByTestId('duplicates')).toBeVisible();
    const before = await page.evaluate(() => (window as unknown as { __mallrats: MallRats }).__mallrats.store.cash);
    await page.getByTestId('sell-one-hat_cuffed_beanie').click();
    await expect(page.getByTestId('confirm-sale')).toBeVisible();
    await page.getByTestId('sale-confirm').click();
    await expect(page.getByTestId('sale-message')).toContainText('Sold');
    const after = await page.evaluate(() => {
      const s = (window as unknown as { __mallrats: MallRats }).__mallrats.store;
      return { cash: s.cash, owned: !!s.snapshot.owned['hat_cuffed_beanie'], dupes: s.snapshot.duplicates['hat_cuffed_beanie'] ?? 0 };
    });
    expect(after.owned).toBe(true);
    expect(after.dupes).toBe(1);
    expect(after.cash).toBeGreaterThan(before);
  });

  test('skipping the tutorial starts a run, pause-to-quit keeps rewards and shows results', async ({ page }) => {
    await boot(page);
    await page.getByTestId('play').click();
    await expect(page.getByTestId('tutorial-offer')).toBeVisible();
    await page.getByTestId('skip-tutorial').click();
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByTestId('hud-distance')).toBeVisible();
    await page.getByTestId('pause').click();
    await expect(page.getByTestId('pause-menu')).toBeVisible();
    await page.getByTestId('quit-run').click();
    await page.getByTestId('confirm-quit').click();
    await expect(page.getByTestId('results')).toBeVisible();
    await expect(page.getByTestId('results-title')).toHaveText('RUN OVER');
    await page.getByTestId('results-menu').click();
    await expect(page.getByTestId('main-menu')).toBeVisible();
  });

  test('starting the tutorial shows the first prompt and skip returns to results', async ({ page }) => {
    await boot(page);
    await page.getByTestId('play').click();
    await page.getByTestId('start-tutorial').click();
    await expect(page.getByTestId('tutorial')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('tutorial-skip').click();
    await expect(page.getByTestId('results')).toBeVisible();
  });

  test('missions, collection odds, settings and cash shop are reachable', async ({ page }) => {
    await boot(page);
    await page.getByTestId('open-missions').click();
    await expect(page.getByTestId('missions')).toBeVisible();
    await expect(page.getByTestId('mission-m01')).toContainText('Jump 5 obstacles');
    await page.getByTestId('back').click();
    await page.getByTestId('open-shop').click();
    await page.getByRole('button', { name: /Bag odds/ }).click();
    await expect(page.getByTestId('collection')).toBeVisible();
    await expect(page.getByTestId('odds-legendary')).toHaveText('1%');
    await page.getByTestId('back').click();
    await page.getByTestId('back').click();
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('settings')).toBeVisible();
    await page.getByTestId('toggle-sound').click();
    await page.getByTestId('back').click();
    await page.getByTestId('wallet').click();
    await expect(page.getByTestId('cash-shop')).toBeVisible();
    await expect(page.getByTestId('billing-dev')).toContainText('DEVELOPMENT MOCK');
    await expect(page.getByTestId('ad-card')).toBeVisible();
  });

  test('mock currency pack purchase adds Mall Cash after confirmation', async ({ page }) => {
    await boot(page);
    await page.getByTestId('wallet').click();
    await page.getByTestId('buy-pack-1000').click();
    await expect(page.getByTestId('mock-purchase')).toBeVisible();
    await page.getByTestId('mock-pay-success').click();
    await expect(page.getByTestId('cash-message')).toContainText('1,000');
    const cash = await page.evaluate(() => (window as unknown as { __mallrats: MallRats }).__mallrats.store.cash);
    expect(cash).toBe(1000);
  });
});
