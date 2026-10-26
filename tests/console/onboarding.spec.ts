import { expect, test } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });

test('console tour locates the full configuration and delivery flow without saving or building', async ({
  page,
}, info) => {
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT'].includes(request.method())) writes.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('dialog', { name: '欢迎使用企业构建中心', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '开始了解', exact: true }).click();
  const targets = [
    'console-enterprise',
    'console-brand',
    'console-modules',
    'console-capabilities',
    'console-summary',
    'console-actions',
    'console-build',
  ];
  for (const [index, target] of targets.entries()) {
    await expect(page.locator('.guide-highlight')).toHaveAttribute('data-guide-target', target);
    await expect(page.getByRole('dialog')).toContainText(`第 ${index + 1} / 7 步`);
    if (index === 2)
      await page.screenshot({ path: info.outputPath('console-onboarding.png'), fullPage: true });
    if (index < targets.length - 1)
      await page.getByRole('button', { name: '下一步', exact: true }).click();
  }
  await page.getByRole('button', { name: '完成指引', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '新手指引', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('console tour is reusable and fits a 390px viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '稍后再说', exact: true }).click();
  await page.getByRole('button', { name: '新手指引', exact: true }).click();
  await page.getByRole('button', { name: '开始了解', exact: true }).click();
  await expect(page.locator('.guide-highlight')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.guide-card').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= 390 && rect.top >= 0 && rect.bottom <= 844;
      }),
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath('console-onboarding-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('dialog').press('Escape');
  await expect(page.getByRole('button', { name: '新手指引', exact: true })).toBeFocused();
});
