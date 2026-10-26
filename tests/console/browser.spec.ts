import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStarted } from '../../build/console/contracts';
import { sha256 } from '../../build/utils';

const root = process.env.CONSOLE_E2E_ROOT;
if (!root) throw new Error('Run using playwright.console.config.ts');

async function manage(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: `管理${title}`, exact: true }).click();
  for (const button of await page.locator('.capability-section-toggle').all())
    if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}

test('mock resources preview dependent removals while individual actions preserve shared services', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('enterprise-a');
  await manage(page, '充值与账单');
  await page.getByRole('checkbox', { name: '微信充值', exact: true }).uncheck();
  await expect(page.getByRole('checkbox', { name: '微信退款', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '交易对账单', exact: true })).toBeChecked();
  await manage(page, '外部资源（Mock）');
  await expect(page.getByRole('checkbox', { name: '微信支付（Mock）', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '关闭整组', exact: true }).click();
  const preview = page.getByRole('dialog');
  await expect(preview).toContainText('微信退款');
  await expect(preview).toContainText('短信登录');
  await expect(preview).toContainText('生成视频');
  await preview.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '微信支付（Mock）', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '关闭整组', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '应用更改', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: '微信支付（Mock）', exact: true }),
  ).not.toBeChecked();
  await manage(page, '充值与账单');
  await expect(page.getByRole('checkbox', { name: '微信退款', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: '充值与账单', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: '保存配置', exact: true })).toBeEnabled();
  await page.screenshot({
    path: info.outputPath('mock-resource-removal-preview.png'),
    fullPage: true,
  });
});

test('new enterprise, dependency validation, unsaved navigation and saved JSON survive refresh', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-company');
  await manage(page, '订单管理');
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
  await manage(page, '订单管理');
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
  await manage(page, '经营报表');
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
  await manage(page, '经营报表');
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
  await manage(page, '经营报表');
  const checkbox = page.getByRole('checkbox', { name: '经营报表', exact: true });
  await checkbox.focus();
  await checkbox.press('Space');
  await expect(checkbox).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('visual-packaging-mobile.png'), fullPage: true });
});

test('fine-grained capability search preserves selections and validates nested dependencies', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-nested');
  await page.getByRole('searchbox', { name: '搜索能力' }).fill('order-notes');
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await page.getByRole('checkbox', { name: '订单备注', exact: true }).check();
  await expect(page.getByText('订单备注 需要启用 订单详情。', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索能力' }).fill('order-detail');
  await page.getByRole('checkbox', { name: '订单详情', exact: true }).check();
  await expect(page.getByText('订单详情 需要启用 订单管理。', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索能力' }).fill('');
  await page.getByRole('checkbox', { name: '订单管理', exact: true }).check();
  await page.getByRole('combobox', { name: '选择状态', exact: true }).selectOption('selected');
  await manage(page, '订单管理');
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByText('配置已保存。', { exact: true })).toBeVisible();
  expect(
    JSON.parse(readFileSync(resolve(root, 'config/enterprises/ui-nested.json'), 'utf8'))
      .enabledModules,
  ).toEqual(['order-detail', 'order-notes', 'orders']);
});

test('type filters configure fields, columns, tabs and separate approval actions without losing selection', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-presentation');
  await manage(page, '审批中心');
  await page.getByRole('checkbox', { name: '审批中心', exact: true }).check();
  await page.getByRole('combobox', { name: '能力类型', exact: true }).selectOption('action');
  const approvalSection = page.getByRole('button', { name: /^审批通过 .*已选/u });
  await approvalSection.click();
  await expect(page.getByRole('checkbox', { name: '审批通过', exact: true })).toHaveCount(0);
  await approvalSection.click();
  await page.getByRole('checkbox', { name: '审批通过', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '审批驳回', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: '审批复核', exact: true })).not.toBeChecked();
  await page.getByRole('combobox', { name: '能力类型', exact: true }).selectOption('column');
  await expect(page.getByRole('checkbox')).toHaveCount(4);
  await page.getByRole('checkbox', { name: '审批 · 状态列', exact: true }).check();
  await page.getByRole('combobox', { name: '能力类型', exact: true }).selectOption('tab');
  await page.getByRole('checkbox', { name: '审批记录', exact: true }).check();
  await expect(page.getByText('审批记录 需要启用 审批详情。', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: '能力类型', exact: true }).selectOption('action');
  await page.getByRole('checkbox', { name: '审批详情', exact: true }).check();
  await page.getByRole('checkbox', { name: '发起审批', exact: true }).check();
  await expect(page.getByRole('button', { name: '保存配置', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: '能力类型', exact: true }).selectOption('field');
  for (const name of ['申请事由字段', '申请人字段', '申请金额字段'])
    await page.getByRole('checkbox', { name, exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '成本中心字段', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByText('配置已保存。', { exact: true })).toBeVisible();
  const profile = JSON.parse(
    readFileSync(resolve(root, 'config/enterprises/ui-presentation.json'), 'utf8'),
  ) as { enabledModules: string[] };
  expect(profile.enabledModules).toContain('approval-approve');
  expect(profile.enabledModules).toContain('approval-column-status');
  expect(profile.enabledModules).not.toContain('approval-reject');
  expect(profile.enabledModules).not.toContain('approval-review');
  expect(profile.enabledModules).not.toContain('approval-field-cost-center');
});

test('inventory and rejection operations require each mandatory field while opinion fields stay optional', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-action-fields');
  await manage(page, '库存管理');
  for (const name of ['库存管理', '库存调整', '库存调拨'])
    await page.getByRole('checkbox', { name, exact: true }).check();
  await manage(page, '审批中心');
  for (const name of ['审批中心', '审批驳回', '审批通过', '审批复核'])
    await page.getByRole('checkbox', { name, exact: true }).check();
  for (const message of [
    '库存调整 需要启用 调整数量字段。',
    '库存调整 需要启用 调整原因字段。',
    '库存调拨 需要启用 源仓商品字段。',
    '库存调拨 需要启用 目标仓字段。',
    '库存调拨 需要启用 调拨数量字段。',
    '库存调拨 需要启用 调拨原因字段。',
    '审批驳回 需要启用 驳回原因字段。',
  ])
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存配置', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: '能力类型', exact: true }).selectOption('field');
  await manage(page, '库存管理');
  await expect(page.getByRole('checkbox')).toHaveCount(6);
  for (const name of [
    '调整数量字段',
    '调整原因字段',
    '源仓商品字段',
    '目标仓字段',
    '调拨数量字段',
    '调拨原因字段',
  ])
    await page.getByRole('checkbox', { name, exact: true }).check();
  await manage(page, '审批中心');
  await page.getByRole('checkbox', { name: '驳回原因字段', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: '初审意见字段', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: '复核意见字段', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByText('配置已保存。', { exact: true })).toBeVisible();
  const profile = JSON.parse(
    readFileSync(resolve(root, 'config/enterprises/ui-action-fields.json'), 'utf8'),
  ) as { enabledModules: string[] };
  expect(profile.enabledModules).toContain('inventory-transfer-field-target');
  expect(profile.enabledModules).toContain('approval-reject-field-reason');
  expect(profile.enabledModules).not.toContain('approval-approve-field-comment');
  expect(profile.enabledModules).not.toContain('approval-review-field-comment');
});

test('module navigation keeps operations and fields together and reviews cross-module bulk changes', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-grouped');
  await expect(page.getByRole('navigation', { name: '业务模块' }).getByRole('button')).toHaveCount(
    14,
  );
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  await manage(page, '库存盘点');
  await expect(page.getByRole('checkbox', { name: '库存调整', exact: true })).toHaveCount(0);
  const section = page
    .locator('.capability-section')
    .filter({ has: page.getByRole('button', { name: /^创建盘点/u }) });
  await expect(section.getByRole('checkbox', { name: '盘点仓库字段', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '启用整组', exact: true }).click();
  const proposal = page.getByRole('dialog', { name: '启用库存盘点全部能力', exact: true });
  await expect(proposal).toContainText('库存管理');
  await expect(proposal).toContainText('将启用 25 项');
  await proposal.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '库存盘点', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: '启用整组', exact: true }).click();
  await proposal.getByRole('button', { name: '应用更改', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存配置', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('grouped-module-console.png'), fullPage: true });
  await manage(page, '库存管理');
  await expect(page.getByRole('checkbox', { name: '库存管理', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '库存调整', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: '关闭整组', exact: true }).click();
  const removal = page.getByRole('dialog', { name: '关闭库存管理', exact: true });
  await expect(removal).toContainText('盘点复核通过');
  await expect(removal).toContainText('将关闭 25 项');
  await removal.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByText('配置已保存。', { exact: true })).toBeVisible();
  await page.reload();
  await manage(page, '库存盘点');
  await expect(page.getByRole('checkbox', { name: '盘点备注字段', exact: true })).toBeChecked();
  expect(errors).toEqual([]);
});

test('dependency jump crosses module boundaries and reviewed repair enables only required capabilities', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: '企业标识', exact: true }).fill('ui-repair');
  await page.getByRole('searchbox', { name: '搜索能力' }).fill('stocktake-count');
  await page.getByRole('checkbox', { name: '录入实盘', exact: true }).check();
  await page.getByRole('button', { name: '定位盘点 · 盘点明细页签', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: '盘点 · 盘点明细页签', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: '补齐必需依赖', exact: true }).click();
  const proposal = page.getByRole('dialog', { name: '补齐必需依赖', exact: true });
  await expect(proposal).toContainText('库存管理');
  await proposal.getByRole('button', { name: '应用更改', exact: true }).click();
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByText('配置已保存。', { exact: true })).toBeVisible();
  const profile = JSON.parse(
    readFileSync(resolve(root, 'config/enterprises/ui-repair.json'), 'utf8'),
  ) as { enabledModules: string[] };
  expect(profile.enabledModules).toHaveLength(7);
  expect(profile.enabledModules).not.toContain('stocktake-post');
  expect(profile.enabledModules).not.toContain('stocktake-create');
});
