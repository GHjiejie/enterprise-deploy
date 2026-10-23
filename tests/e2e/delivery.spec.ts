import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const a = 'http://127.0.0.1:5191';
const b = 'http://127.0.0.1:5192';

test('A: orders, selected-order CSV worker export and report assets work in a sealed production site', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${a}/orders`);
  await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
  const exportButton = page.getByRole('button', { name: '导出订单', exact: true });
  await expect(exportButton).toBeDisabled();
  await expect(
    page.getByRole('checkbox', { name: '选择 ORD-2026-1001', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('enterprise-a-desktop.png'), fullPage: true });
  await page.getByRole('checkbox', { name: '选择 ORD-2026-1001', exact: true }).check();
  const downloadEvent = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('orders.csv');
  const file = info.outputPath('orders.csv');
  await download.saveAs(file);
  const csv = readFileSync(file, 'utf8');
  expect(csv).toContain('ORD-2026-1001');
  expect(csv).not.toContain('ORD-2026-1002');
  await expect(page.getByRole('status')).toHaveText('订单已导出');
  await page.getByRole('link', { name: '经营报表' }).click();
  await expect(page.getByRole('heading', { name: '经营报表', exact: true })).toBeVisible();
  const image = page.getByRole('img', { name: '收入趋势示意图，从周一到周五逐步增长' });
  await expect(image).toBeVisible();
  expect(
    await image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('B: only orders are assembled; reports deep link is 404 UI with no forbidden chunk requests', async ({
  page,
  request,
}) => {
  const requests: string[] = [];
  page.on('request', (event) => requests.push(event.url()));
  await page.goto(`${b}/orders`);
  await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '经营报表' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导出订单' })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(5);
  await page.goto(`${b}/reports`);
  await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
  expect(
    requests.filter((url) => /ReportsPage|ExportButton|export\.worker|revenue-/u.test(url)),
  ).toEqual([]);
  const missing = await request.get(`${b}/assets/ReportsPage-missing.js`, {
    headers: { Accept: 'text/html' },
  });
  expect(missing.status()).toBe(404);
  expect((await request.get(`${b}/.audit/audit.json`)).status()).toBe(404);
});

test('delivered feature, service license and demo user permissions intersect', async ({ page }) => {
  await page.goto(`${a}/orders`);
  await page.getByLabel('演示权限').selectOption('member');
  await expect(page.getByRole('link', { name: '经营报表' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导出订单' })).toHaveCount(0);
  await page.getByLabel('演示权限').selectOption('admin');
  await page.getByRole('link', { name: '经营报表' }).click();
  await expect(page.getByRole('heading', { name: '经营报表', exact: true })).toBeVisible();
  await page.getByLabel('演示权限').selectOption('member');
  await expect(page.getByRole('heading', { name: '没有访问权限' })).toBeVisible();
  await page.getByLabel('演示权限').selectOption('admin');
  await expect(page.getByRole('heading', { name: '经营报表', exact: true })).toBeVisible();
});

test('orders support search, empty recovery and a narrow viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${b}/orders`);
  await expect(page.getByRole('checkbox')).toHaveCount(5);
  await page.getByRole('searchbox', { name: '搜索订单' }).fill('不存在');
  await expect(page.getByText('没有符合条件的订单，请调整搜索内容。')).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索订单' }).fill('');
  await expect(page.getByRole('checkbox')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('enterprise-b-mobile.png'), fullPage: true });
  await page.getByLabel('演示权限').selectOption('none');
  await expect(page.getByRole('heading', { name: '没有访问权限' })).toBeVisible();
  await page.getByLabel('演示权限').selectOption('member');
  await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
});

test('a missing allowed chunk shows an explicit version-refresh state', async ({ page }) => {
  await page.goto(`${a}/orders`);
  await page.route('**/ReportsPage-*.js', (route) => route.abort('failed'));
  await page.getByRole('link', { name: '经营报表' }).click();
  await expect(page.getByRole('heading', { name: '资源加载失败', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '刷新当前版本' })).toBeVisible();
});
