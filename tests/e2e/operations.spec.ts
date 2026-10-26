import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const a = 'http://127.0.0.1:5191';
const b = 'http://127.0.0.1:5192';
let errors: string[];
test.beforeEach(({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors).toEqual([]));

test('order buttons, nested notes, CSV and cross-page session state compose independently', async ({
  page,
}, info) => {
  await page.goto(`${a}/orders`);
  await page.getByRole('button', { name: '新建订单', exact: true }).click();
  const form = page.getByRole('dialog', { name: '新建订单' });
  await form.getByLabel('客户名称').fill('   ');
  await form.getByLabel('订单金额').fill('1380.25');
  await form.getByRole('button', { name: '创建订单' }).click();
  await expect(form.getByRole('alert')).toContainText('客户名称');
  await form.getByLabel('客户名称').fill('新客户测试');
  await form.getByRole('button', { name: '创建订单' }).click();
  await expect(form).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: '新客户测试' });
  await row.getByRole('button', { name: '加急', exact: true }).click();
  await expect(row.getByRole('button', { name: '取消加急' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await row.getByRole('button', { name: '详情', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '订单详情' });
  await detail.getByRole('tab', { name: '跟进备注' }).click();
  await detail.getByLabel('新增备注').fill('仅内部可见的跟进记录');
  await detail.getByRole('button', { name: '添加备注' }).click();
  await expect(detail.getByText('仅内部可见的跟进记录', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('order-detail-notes.png'), fullPage: true });
  await detail.press('Escape');
  await expect(row.getByRole('button', { name: '详情', exact: true })).toBeFocused();
  await row.getByRole('checkbox').check();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出订单', exact: true }).click();
  const file = info.outputPath('order-with-notes.csv');
  await (await downloaded).saveAs(file);
  expect(readFileSync(file, 'utf8')).toContain('新客户测试');
  expect(readFileSync(file, 'utf8')).not.toContain('仅内部可见');
  await page.getByRole('button', { name: '批量完成', exact: true }).click();
  await page
    .getByRole('dialog', { name: '确认批量完成' })
    .getByRole('button', { name: '确认完成' })
    .click();
  await expect(row).toContainText('已完成');
  await expect(row.getByRole('checkbox')).not.toBeChecked();
  await page.getByRole('link', { name: '操作审计' }).click();
  await expect(page.getByRole('cell', { name: '追加备注', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '批量完成', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '订单管理' }).click();
  await expect(row).toContainText('已完成');
});

test('mixed batch is disabled and cancellation keeps orders unchanged', async ({ page }) => {
  await page.goto(`${a}/orders`);
  await page.getByRole('checkbox', { name: '选择 ORD-2026-1001', exact: true }).check();
  await page.getByRole('checkbox', { name: '选择 ORD-2026-1002', exact: true }).check();
  await expect(page.getByRole('button', { name: /批量完成/ })).toBeDisabled();
  await page.getByRole('checkbox', { name: '选择 ORD-2026-1002', exact: true }).uncheck();
  await page.getByRole('button', { name: '批量完成', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'ORD-2026-1001' })).toContainText('待处理');
  await page.getByLabel('订单状态').selectOption('已完成');
  await expect(page.getByRole('row').filter({ hasText: 'ORD-2026-1001' })).toHaveCount(0);
  await page.getByRole('button', { name: '清空选择' }).click();
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(
    page.getByRole('checkbox', { name: '选择 ORD-2026-1001', exact: true }),
  ).not.toBeChecked();
});

test('inventory transfer is atomic, protects reservations and retains recoverable forms', async ({
  page,
}, info) => {
  await page.goto(`${a}/inventory`);
  const source = page
    .getByRole('row')
    .filter({ hasText: 'SKU-1001' })
    .filter({ hasText: '上海仓' });
  const target = page
    .getByRole('row')
    .filter({ hasText: 'SKU-1001' })
    .filter({ hasText: '杭州仓' });
  await page.getByRole('button', { name: '库存调拨', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '库存调拨' });
  await dialog.getByLabel('源仓商品').selectOption('ST-001');
  await dialog.getByRole('combobox', { name: '目标仓', exact: true }).selectOption('ST-002');
  await dialog.getByLabel('调拨数量').fill('101');
  await dialog.getByLabel('调拨原因').fill('华东仓补货');
  await dialog.getByRole('button', { name: '确认调拨' }).click();
  await expect(dialog.getByRole('alert')).toContainText('可用库存');
  await expect(dialog.getByLabel('调拨原因')).toHaveValue('华东仓补货');
  await expect(source.getByRole('cell', { name: '120', exact: true })).toBeVisible();
  await dialog.getByLabel('调拨数量').fill('25');
  await dialog.getByRole('button', { name: '确认调拨' }).click();
  await expect(source.getByRole('cell', { name: '95', exact: true })).toBeVisible();
  await expect(target.getByRole('cell', { name: '40', exact: true })).toBeVisible();
  await source.getByRole('button', { name: '调整库存' }).click();
  const adjustment = page.getByRole('dialog', { name: '调整库存' });
  await adjustment.getByLabel('调整数量').fill('-80');
  await adjustment.getByLabel('调整原因').fill('盘点差异');
  await adjustment.getByRole('button', { name: '确认调整' }).click();
  await expect(adjustment.getByRole('alert')).toContainText('预留库存');
  await adjustment.getByLabel('调整数量').fill('-5');
  await adjustment.getByRole('button', { name: '确认调整' }).click();
  await expect(source.getByRole('cell', { name: '90', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('inventory-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: '操作审计' }).click();
  await expect(page.getByRole('cell', { name: '库存调拨', exact: true })).toHaveCount(1);
  await expect(page.getByRole('cell', { name: '库存调整', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: '库存管理' }).click();
  await expect(source.getByRole('cell', { name: '90', exact: true })).toBeVisible();
  await page.getByLabel('仅看预警').check();
  await expect(source).toHaveCount(0);
  await page.getByRole('searchbox', { name: '搜索库存' }).fill('不存在');
  await expect(page.getByText('没有符合条件的库存，请调整筛选。')).toBeVisible();
  await page.getByRole('button', { name: '重置筛选' }).click();
  await expect(source).toBeVisible();
});

test('approval submission, two-stage review and rejection produce complete history', async ({
  page,
}, info) => {
  await page.goto(`${a}/approvals`);
  await page.getByRole('button', { name: '发起审批', exact: true }).click();
  const form = page.getByRole('dialog', { name: '发起审批' });
  await form.getByLabel('申请事由').fill('新生产线采购');
  await form.getByLabel('申请人').fill('测试成员');
  await form.getByLabel('申请金额').fill('50000');
  await form.getByRole('button', { name: '提交申请' }).click();
  const row = page.getByRole('row').filter({ hasText: '新生产线采购' });
  await row.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认通过' }).click();
  await expect(row).toContainText('复核中');
  await row.getByRole('button', { name: '复核通过', exact: true }).click();
  await page.getByRole('dialog').getByLabel('审批意见').fill('复核预算已落实');
  await page.getByRole('dialog').getByRole('button', { name: '确认复核通过' }).click();
  await expect(row).toContainText('已通过');
  await expect(row.getByRole('button', { name: '通过', exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: '审批详情' }).click();
  const history = page.getByRole('dialog', { name: '审批详情' });
  await history.getByRole('tab', { name: '审批记录', exact: true }).click();
  await expect(history.getByText('提交申请', { exact: true })).toBeVisible();
  await expect(history.getByText('初审通过', { exact: true })).toBeVisible();
  await expect(history.getByText('复核预算已落实')).toBeVisible();
  await page.screenshot({ path: info.outputPath('approval-history.png'), fullPage: true });
  await history.press('Escape');
  const small = page.getByRole('row').filter({ hasText: 'AP-1002' });
  await small.getByRole('button', { name: '驳回', exact: true }).click();
  await page.getByRole('dialog').getByLabel('驳回原因').fill('   ');
  await page.getByRole('dialog').getByRole('button', { name: '确认驳回' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('驳回原因');
  await page.getByRole('dialog').getByLabel('驳回原因').fill('请补充出差计划');
  await page.getByRole('dialog').getByRole('button', { name: '确认驳回' }).click();
  await expect(small).toContainText('已驳回');
});

test('member permissions remove mutation controls and audit access while preserving permitted actions', async ({
  page,
}) => {
  await page.goto(`${a}/orders`);
  await page
    .getByRole('row')
    .filter({ hasText: 'ORD-2026-1001' })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('tab', { name: '跟进备注' }).click();
  await expect(page.getByRole('dialog').getByLabel('新增备注')).toBeVisible();
  // Native modal focus prevents interacting outside; close before switching identity.
  await page.getByRole('dialog').press('Escape');
  await page.getByLabel('演示权限').selectOption('member');
  await expect(page.getByRole('button', { name: '新建订单' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '加急', exact: true })).toHaveCount(0);
  await page
    .getByRole('row')
    .filter({ hasText: 'ORD-2026-1001' })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByLabel('新增备注')).toHaveCount(0);
  await page.getByRole('dialog').press('Escape');
  await page.getByRole('link', { name: '库存管理' }).click();
  await expect(page.getByRole('button', { name: '库存调拨' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '调整库存' })).toHaveCount(0);
  await page.getByRole('link', { name: '审批中心' }).click();
  await expect(page.getByRole('button', { name: '发起审批' })).toBeVisible();
  await expect(page.getByRole('button', { name: '通过', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '审批详情' })).toHaveCount(3);
  await expect(page.getByRole('link', { name: '操作审计' })).toHaveCount(0);
  await page.goto(`${a}/audit`);
  await page.getByLabel('演示权限').selectOption('member');
  await expect(page.getByRole('heading', { name: '没有访问权限' })).toBeVisible();
});

test('all expanded pages and dialogs fit a 390px viewport with usable empty states', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['orders', 'inventory', 'approvals', 'audit']) {
    await page.goto(`${a}/${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  }
  await expect(page.getByText('暂无操作记录，完成一次业务操作后即可在此查看。')).toBeVisible();
  await page.getByRole('link', { name: '库存管理' }).click();
  await page.getByRole('button', { name: '库存调拨', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    await page.getByRole('dialog').evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(358);
  await page.screenshot({ path: info.outputPath('stock-transfer-mobile.png'), fullPage: true });
});

test('B excludes every optional operation and new module deep link without fetching implementations', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`${b}/orders`);
  await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
  for (const name of ['新建订单', '加急', '详情', '库存调拨', '审批记录'])
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  for (const path of ['inventory', 'approvals', 'audit']) {
    await page.goto(`${b}/${path}`);
    await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
  }
  expect(
    requests.filter((url) =>
      /(?:InventoryPage|StockTransfer|ApprovalsPage|ApprovalDecide|AuditPage|OrderNotes|CreateOrder)-/.test(
        url,
      ),
    ),
  ).toEqual([]);
});
