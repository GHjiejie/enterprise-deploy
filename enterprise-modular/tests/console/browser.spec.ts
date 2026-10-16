import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStarted } from '../../build/console/contracts';
import { sha256 } from '../../build/utils';

const root = process.env.CONSOLE_E2E_ROOT;
if (!root) throw new Error('Run using playwright.console.config.ts');

test('new enterprise, dependency validation, unsaved navigation and saved JSON survive refresh', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-company');
  await page.getByRole('checkbox', { name: '订单导出', exact: true }).check();
  await expect(page.getByText('订单导出 需要启用 订单管理。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存并打包', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: '订单管理', exact: true }).check();
  await page.getByRole('combobox', { name: '企业品牌', exact: true }).selectOption('brand-b');
  await page.getByRole('combobox', { name: '构建环境', exact: true }).selectOption('staging');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('enterprise-a');
  await expect(page.getByRole('dialog', { name: '放弃未保存的修改？' })).toBeVisible();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '企业标识', exact: true })).toHaveValue(
    'ui-company',
  );
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByText('配置已保存。', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('combobox', { name: '企业配置', exact: true })).toHaveValue(
    'ui-company',
  );
  await expect(page.getByRole('checkbox', { name: '订单导出', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: '企业品牌', exact: true })).toHaveValue(
    'brand-b',
  );
  expect(
    JSON.parse(readFileSync(resolve(root, 'config/enterprises/ui-company.json'), 'utf8')),
  ).toEqual({
    schemaVersion: 1,
    enterpriseId: 'ui-company',
    enabledModules: ['order-export', 'orders'],
    brandingId: 'brand-b',
  });
});

test('conflicting external edits preserve the draft until explicitly reloaded', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('enterprise-b');
  await page.getByRole('checkbox', { name: '经营报表', exact: true }).check();
  const file = resolve(root, 'config/enterprises/enterprise-b.json');
  const profile = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, JSON.stringify({ ...profile, brandingId: 'brand-a' }));
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('配置已被其他页面或编辑器修改');
  await expect(page.getByRole('checkbox', { name: '经营报表', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '重新加载服务器配置', exact: true }).click();
  await page.getByRole('button', { name: '放弃修改并继续', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '经营报表', exact: true })).not.toBeChecked();
  await expect(page.getByRole('combobox', { name: '企业品牌', exact: true })).toHaveValue(
    'brand-a',
  );
});

test('real source-boundary failure shows logs, no download, and permits a corrected retry', async ({
  page,
}) => {
  const source = resolve(root, 'src/modules/orders/api.ts');
  const original = readFileSync(source);
  writeFileSync(
    source,
    `${original.toString('utf8')}\nif (false) void import('../reports/api');\n`,
  );
  try {
    await page.goto('/');
    await page
      .getByRole('combobox', { name: '企业配置', exact: true })
      .selectOption('enterprise-b');
    await page.getByRole('button', { name: '保存并打包', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('打包失败', { timeout: 30000 });
    await expect(page.getByTestId('build-log')).toContainText('FORBIDDEN_MODULE');
    await expect(page.getByRole('link', { name: '下载交付包' })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: '订单管理', exact: true })).toBeChecked();
  } finally {
    writeFileSync(source, original);
  }
  await page.getByRole('button', { name: '保存并打包', exact: true }).click();
  await expect(page.getByTestId('build-result')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('status')).toContainText('打包完成');
});

test('UI packages a fixed orders-only production version with refresh recovery, preview and downloads', async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-delivery');
  await page.getByRole('checkbox', { name: '订单管理', exact: true }).check();
  await page.getByRole('combobox', { name: '企业品牌', exact: true }).selectOption('brand-b');
  await page.getByRole('combobox', { name: '构建环境', exact: true }).selectOption('production');
  const responseEvent = page.waitForResponse(
    (response) => response.url().endsWith('/api/builds') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '保存并打包', exact: true }).click();
  const started = parseStarted(await (await responseEvent).json());
  expect(started.entry.profile.enabledModules).toEqual(['orders']);
  await expect(page.getByRole('checkbox', { name: '订单管理', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('combobox', { name: '企业配置', exact: true })).toHaveValue(
    'ui-delivery',
  );
  await expect(page.getByTestId('build-result')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('status')).toContainText('打包完成');
  await page.screenshot({ path: info.outputPath('visual-packaging-desktop.png'), fullPage: true });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载交付包' }).click();
  const download = await downloadEvent;
  const file = info.outputPath('delivery.tar.gz');
  await download.saveAs(file);
  const hash = sha256(readFileSync(file));
  const reportEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载审计报告', exact: true }).click();
  const report = await reportEvent;
  const reportFile = info.outputPath('audit.json');
  await report.saveAs(reportFile);
  const audit = JSON.parse(readFileSync(reportFile, 'utf8')) as {
    enterpriseId: string;
    releaseId: string;
    enabledModules: string[];
    files: unknown[];
  };
  expect(audit.enterpriseId).toBe('ui-delivery');
  expect(audit.releaseId).toBe(started.job.id);
  expect(audit.enabledModules).toEqual(['orders']);
  expect(audit.files).toHaveLength(5);
  const previewEvent = context.waitForEvent('page');
  await page.getByRole('link', { name: '预览此版本' }).click();
  const preview = await previewEvent;
  await expect(preview.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
  await expect(preview.getByRole('link', { name: '经营报表' })).toHaveCount(0);
  await expect(preview.getByRole('button', { name: '导出订单' })).toHaveCount(0);
  await preview.close();
  await page.getByRole('checkbox', { name: '经营报表', exact: true }).check();
  const unchangedEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载交付包' }).click();
  const unchanged = await unchangedEvent;
  const second = info.outputPath('unchanged.tar.gz');
  await unchanged.saveAs(second);
  expect(sha256(readFileSync(second))).toBe(hash);
  expect(errors).toEqual([]);
});

test('390px layout and keyboard selection work with reduced motion', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('enterprise-b');
  const checkbox = page.getByRole('checkbox', { name: '经营报表', exact: true });
  await checkbox.focus();
  await checkbox.press('Space');
  await expect(checkbox).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('visual-packaging-mobile.png'), fullPage: true });
});
