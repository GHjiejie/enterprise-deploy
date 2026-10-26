import { expect, test, type Page } from '@playwright/test';
const a = 'http://127.0.0.1:5191';
const slim = 'http://127.0.0.1:5195';
const b = 'http://127.0.0.1:5192';
const key = 'enterprise:guide:v1:enterprise-a';
test.use({ storageState: { cookies: [], origins: [] } });
async function start(page: Page): Promise<void> {
  await page.getByRole('button', { name: '开始了解', exact: true }).click();
  await expect(page.locator('.guide-highlight')).toBeVisible();
}
async function located(page: Page, target: string): Promise<void> {
  await expect(page.locator('.guide-highlight')).toHaveAttribute('data-guide-target', target);
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /^(下一步|完成指引)$/u }),
  ).toBeEnabled();
}
async function cardFits(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.locator('.guide-card').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= document.documentElement.clientWidth &&
          rect.bottom <= window.innerHeight
        );
      }),
    )
    .toBe(true);
}

test('first visit welcomes, skipping is remembered, and help restarts with keyboard and focus recovery', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${a}/orders`);
  const welcome = page.getByRole('dialog', { name: '欢迎使用企业工作台', exact: true });
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('12 个位置');
  await welcome.getByRole('button', { name: '稍后再说', exact: true }).click();
  await expect(page.getByRole('button', { name: '新手指引', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '新手指引', exact: true }).click();
  await start(page);
  await located(page, 'menu:orders-menu');
  await page.screenshot({ path: info.outputPath('onboarding-menu-desktop.png'), fullPage: true });
  await page.getByRole('dialog').press('ArrowRight');
  await located(page, 'tool:order-create');
  await page.getByRole('button', { name: '上一步', exact: true }).click();
  await located(page, 'menu:orders-menu');
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('button', { name: '新手指引', exact: true })).toBeFocused();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(
    'dismissed',
  );
  expect(errors).toEqual([]);
});

test('all menu and toolbar steps navigate and highlight their actual locations before completion', async ({
  page,
}) => {
  await page.goto(`${a}/inventory`);
  await start(page);
  const targets = [
    ['menu:orders-menu', 'orders'],
    ['tool:order-create', 'orders'],
    ['tool:order-bulk-complete', 'orders'],
    ['tool:order-export-button', 'orders'],
    ['menu:inventory-menu', 'inventory'],
    ['tool:inventory-transfer', 'inventory'],
    ['menu:stocktakes-menu', 'stocktakes'],
    ['tool:stocktake-create', 'stocktakes'],
    ['menu:approvals-menu', 'approvals'],
    ['tool:approval-submit', 'approvals'],
    ['menu:reports-menu', 'reports'],
    ['menu:audit-log-menu', 'audit'],
  ] as const;
  for (const [index, [target, route]] of targets.entries()) {
    await located(page, target);
    await expect(page).toHaveURL(`${a}/${route}`);
    await expect(page.getByRole('dialog')).toContainText(`第 ${index + 1} / 12 步`);
    await cardFits(page);
    if (index < targets.length - 1)
      await page.getByRole('button', { name: '下一步', exact: true }).click();
  }
  await page.getByRole('button', { name: '完成指引', exact: true }).click();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(
    'completed',
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: '操作审计', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('permission changes remove unauthorized steps and the launcher disappears with no accessible pages', async ({
  page,
}) => {
  await page.goto(`${a}/orders`);
  await start(page);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await located(page, 'tool:order-create');
  await page.getByLabel('演示权限').evaluate((element: HTMLSelectElement) => {
    element.value = 'member';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await located(page, 'menu:inventory-menu');
  await expect(page.getByRole('dialog')).toContainText('第 2 / 5 步');
  await expect(page.getByRole('dialog')).not.toContainText('新建订单');
  await page.getByRole('dialog').press('Escape');
  await page.getByLabel('演示权限').selectOption('none');
  await expect(page.getByRole('button', { name: '新手指引', exact: true })).toHaveCount(0);
});

test('a slim enterprise explains only delivered features and an enterprise without onboarding has no guide code entry', async ({
  page,
}) => {
  await page.goto(`${slim}/orders`);
  await expect(page.getByRole('dialog')).toContainText('7 个位置');
  await start(page);
  const targets = [
    'menu:orders-menu',
    'tool:order-create',
    'menu:inventory-menu',
    'menu:stocktakes-menu',
    'tool:stocktake-create',
    'menu:approvals-menu',
    'tool:approval-submit',
  ];
  for (const [index, target] of targets.entries()) {
    await located(page, target);
    await expect(page.getByRole('dialog')).not.toContainText('跨仓调拨');
    if (index < targets.length - 1)
      await page.getByRole('button', { name: '下一步', exact: true }).click();
  }
  await page.getByRole('button', { name: '完成指引', exact: true }).click();
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  await page.goto(`${b}/orders`);
  await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新手指引', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(urls.filter((url) => /Onboarding|GuidedTour/u.test(url))).toEqual([]);
});

test('a temporarily missing anchor has recoverable feedback and can be located again', async ({
  page,
}) => {
  await page.goto(`${a}/orders`);
  await start(page);
  const anchor = page.locator('[data-guide="tool:order-create"]');
  await anchor.waitFor();
  await anchor.evaluate((element) => element.removeAttribute('data-guide'));
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('暂时无法定位此功能');
  await page
    .getByRole('button', { name: '新建订单', exact: true })
    .evaluate((element) => element.setAttribute('data-guide', 'tool:order-create'));
  await page.getByRole('button', { name: '重新定位', exact: true }).click();
  await located(page, 'tool:order-create');
  await page.getByRole('dialog').press('Escape');
});

test('390px guide keeps the target and card in view across scroll and resizing', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${a}/orders`);
  await start(page);
  await located(page, 'menu:orders-menu');
  await cardFits(page);
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await located(page, 'tool:order-create');
  await cardFits(page);
  await page.screenshot({ path: info.outputPath('onboarding-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 620 });
  await cardFits(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('dialog').press('Tab');
  expect(
    await page
      .locator('.guide-dialog')
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await page.getByRole('dialog').press('Escape');
});

test('blocked browser storage does not prevent using or dismissing the guide', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage blocked', 'SecurityError');
    };
  });
  await page.goto(`${a}/orders`);
  await start(page);
  await located(page, 'menu:orders-menu');
  await page.getByRole('button', { name: '跳过指引', exact: true }).click();
  await expect(page.getByRole('button', { name: '新手指引', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
