import { expect, test, type Page } from '@playwright/test';
const a = 'http://127.0.0.1:5191';
const slim = 'http://127.0.0.1:5195';
async function create(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: '创建盘点', exact: true }).click();
  const form = page.getByRole('dialog', { name: '创建盘点', exact: true });
  await form.getByLabel('盘点名称', { exact: true }).fill(title);
  await form.getByLabel('盘点仓库', { exact: true }).selectOption('上海仓');
  await form.getByRole('button', { name: '确认创建盘点', exact: true }).click();
}
async function count(page: Page, changed = true): Promise<void> {
  const detail = page.getByRole('dialog', { name: '盘点详情', exact: true });
  for (const [name, value] of [
    ['工业网关', changed ? '118' : '120'],
    ['温度传感器', '360'],
    ['控制面板', '8'],
  ] as const) {
    await detail
      .locator('article')
      .filter({ hasText: name })
      .getByRole('button', { name: '录入实盘', exact: true })
      .click();
    const form = page.getByRole('dialog', { name: `实盘录入 · ${name}`, exact: true });
    await form.getByLabel('实盘数量', { exact: true }).fill(value ?? '');
    if (changed && name === '工业网关')
      await form.getByLabel('盘点差异原因', { exact: true }).fill('样品领用漏记');
    await form.getByRole('button', { name: '保存实盘', exact: true }).click();
    await expect(form).toHaveCount(0);
  }
  await detail.getByRole('button', { name: '关闭弹窗', exact: true }).click();
}
async function advance(page: Page, title: string, label: string): Promise<void> {
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: label, exact: true }).click();
  await page
    .getByRole('dialog', { name: `确认${label}`, exact: true })
    .getByRole('button', { name: `确认${label}`, exact: true })
    .click();
}

test('warehouse stocktake completes counting, review and atomic posting with audit history', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${a}/stocktakes`);
  await expect(page.getByText('暂无盘点单。创建盘点后将固定该仓的账面库存快照。')).toBeVisible();
  await create(page, '月末盘点');
  const row = page.getByRole('row').filter({ hasText: '月末盘点' });
  await advance(page, '月末盘点', '提交复核');
  await expect(page.getByRole('alert')).toContainText('全部明细');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await row.getByRole('button', { name: '盘点详情', exact: true }).click();
  await count(page);
  await expect(row).toContainText('3 / 3 项');
  await advance(page, '月末盘点', '提交复核');
  await expect(row).toContainText('待复核');
  await advance(page, '月末盘点', '复核通过');
  await expect(row).toContainText('待过账');
  await page.screenshot({ path: info.outputPath('stocktake-ready.png'), fullPage: true });
  await advance(page, '月末盘点', '差异过账');
  await expect(row).toContainText('已过账');
  await expect(row.getByRole('button', { name: '差异过账', exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: '作废盘点', exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: '盘点详情', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '盘点详情', exact: true });
  await detail.getByRole('tab', { name: '流转记录', exact: true }).click();
  await expect(detail).toContainText('净差异 -2 件');
  await detail.press('Escape');
  await page.getByRole('link', { name: '库存管理', exact: true }).click();
  const stock = page.getByRole('row').filter({ hasText: 'SKU-1001' }).filter({ hasText: '上海仓' });
  await expect(stock.getByRole('cell', { name: '118', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '操作审计', exact: true }).click();
  await expect(page.getByRole('cell', { name: '差异过账', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('changed inventory blocks posting and returning clears counts against a new snapshot', async ({
  page,
}) => {
  await page.goto(`${a}/stocktakes`);
  await create(page, '变更冲突盘点');
  const row = page.getByRole('row').filter({ hasText: '变更冲突盘点' });
  await row.getByRole('button', { name: '盘点详情', exact: true }).click();
  await count(page, false);
  await advance(page, '变更冲突盘点', '提交复核');
  await advance(page, '变更冲突盘点', '复核通过');
  await page.getByRole('link', { name: '库存管理', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: 'SKU-1001' })
    .filter({ hasText: '上海仓' })
    .getByRole('button', { name: '调整库存' })
    .click();
  const adjustment = page.getByRole('dialog', { name: '调整库存' });
  await adjustment.getByLabel('调整数量').fill('1');
  await adjustment.getByLabel('调整原因').fill('盘点期间到货');
  await adjustment.getByRole('button', { name: '确认调整' }).click();
  await page.getByRole('link', { name: '库存盘点', exact: true }).click();
  await advance(page, '变更冲突盘点', '差异过账');
  await expect(page.getByRole('alert')).toContainText('库存已变化');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(row).toContainText('待过账');
  await row.getByRole('button', { name: '退回重盘', exact: true }).click();
  const form = page.getByRole('dialog', { name: '确认退回重盘' });
  await form.getByLabel('重盘原因').fill('重新核对到货');
  await form.getByRole('button', { name: '确认退回重盘', exact: true }).click();
  await expect(row).toContainText('盘点中');
  await expect(row).toContainText('0 / 3 项');
  await row.getByRole('button', { name: '盘点详情', exact: true }).click();
  await expect(
    page.getByRole('dialog').locator('article').filter({ hasText: '工业网关' }),
  ).toContainText('121');
  await page.getByRole('dialog').press('Escape');
  await page.getByRole('link', { name: '库存管理', exact: true }).click();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'SKU-1001' })
      .filter({ hasText: '上海仓' })
      .getByRole('cell', { name: '121', exact: true }),
  ).toBeVisible();
});

test('conditional difference reasons, duplicate warehouse prevention, cancellation and permission revocation work', async ({
  page,
}) => {
  await page.goto(`${a}/stocktakes`);
  await create(page, '盘点校验');
  await create(page, '重复盘点');
  await expect(page.getByRole('alert')).toContainText('该仓已有未结束');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: '盘点校验' });
  await row.getByRole('button', { name: '盘点详情', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '盘点详情', exact: true });
  await detail
    .locator('article')
    .filter({ hasText: '工业网关' })
    .getByRole('button', { name: '录入实盘', exact: true })
    .click();
  const form = page.getByRole('dialog', { name: '实盘录入 · 工业网关', exact: true });
  await expect(form.getByLabel('盘点差异原因')).not.toHaveAttribute('required');
  await form.getByLabel('实盘数量').fill('0');
  await expect(form.getByLabel('盘点差异原因')).toHaveAttribute('required');
  await form.getByLabel('盘点差异原因').fill('   ');
  await form.getByRole('button', { name: '保存实盘' }).click();
  await expect(form.getByRole('alert')).toContainText('差异原因');
  await form.getByLabel('盘点差异原因').fill('未保存的原因');
  await page.getByLabel('演示权限').evaluate((element: HTMLSelectElement) => {
    element.value = 'member';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(form).toHaveCount(0);
  await expect(detail.getByRole('button', { name: '录入实盘', exact: true })).toHaveCount(0);
  await detail.press('Escape');
  await page.getByLabel('演示权限').selectOption('admin');
  await row.getByRole('button', { name: '作废盘点', exact: true }).click();
  const cancel = page.getByRole('dialog', { name: '确认作废盘点', exact: true });
  await cancel.getByLabel('作废原因').fill('盘点计划调整');
  await cancel.getByRole('button', { name: '确认作废盘点', exact: true }).click();
  await expect(row).toContainText('已作废');
  await create(page, '调整后新盘点');
  await expect(page.getByRole('row').filter({ hasText: '调整后新盘点' })).toBeVisible();
});

test('slim enterprise removes optional fields, columns, tabs and posting action while retaining a usable review flow', async ({
  page,
}) => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  await page.goto(`${slim}/stocktakes`);
  await page.getByRole('button', { name: '创建盘点', exact: true }).click();
  await expect(page.getByLabel('盘点备注', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await create(page, '精简盘点');
  const row = page.getByRole('row').filter({ hasText: '精简盘点' });
  await expect(page.getByRole('columnheader', { name: '净差异', exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: '盘点详情', exact: true }).click();
  await expect(page.getByRole('tab', { name: '扩展信息', exact: true })).toHaveCount(0);
  await count(page);
  await advance(page, '精简盘点', '提交复核');
  await row.getByRole('button', { name: '复核通过', exact: true }).click();
  const approval = page.getByRole('dialog', { name: '确认复核通过', exact: true });
  await expect(approval.getByRole('textbox')).toHaveCount(0);
  await approval.getByRole('button', { name: '确认复核通过', exact: true }).click();
  await expect(row).toContainText('待过账');
  await expect(row.getByRole('button', { name: '差异过账', exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: '盘点详情', exact: true }).click();
  await page.getByRole('tab', { name: '流转记录', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('实盘结果已复核，等待差异过账');
  expect(
    urls.filter((url) =>
      /stocktake-(?:post|return|cancel|create-field-note|approve-field-comment|detail-extra|column-difference)/u.test(
        url,
      ),
    ),
  ).toEqual([]);
});

test('stocktake nested forms fit 390px and Escape restores the detail action focus', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${a}/stocktakes`);
  await create(page, '移动端盘点');
  await page.getByRole('button', { name: '盘点详情', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '盘点详情', exact: true });
  const trigger = detail
    .locator('article')
    .filter({ hasText: '工业网关' })
    .getByRole('button', { name: '录入实盘', exact: true });
  await trigger.click();
  const form = page.getByRole('dialog', { name: '实盘录入 · 工业网关', exact: true });
  await form.getByLabel('实盘数量').fill('119');
  await form.getByLabel('盘点差异原因').fill('包装损坏');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('stocktake-mobile.png'), fullPage: true });
  await form.press('Escape');
  await expect(detail).toBeVisible();
  await expect(trigger).toBeFocused();
  await detail.press('Escape');
  await expect(page.getByRole('button', { name: '盘点详情', exact: true })).toBeFocused();
});
