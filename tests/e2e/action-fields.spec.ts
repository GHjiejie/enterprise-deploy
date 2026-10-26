import { expect, test } from '@playwright/test';
const a = 'http://127.0.0.1:5191';
const slim = 'http://127.0.0.1:5195';
const reviewOnly = 'http://127.0.0.1:5196';

test('configured transfer fields reset dependent choices, preserve drafts on cancel and enforce reasons', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${a}/inventory`);
  await page.getByRole('button', { name: '库存调拨', exact: true }).click();
  const form = page.getByRole('dialog', { name: '库存调拨' });
  await expect(form.getByRole('combobox', { name: '目标仓', exact: true })).toBeDisabled();
  await expect(form.getByRole('button', { name: '确认调拨' })).toBeDisabled();
  await form.getByRole('combobox', { name: '源仓商品', exact: true }).selectOption('ST-001');
  await form.getByRole('combobox', { name: '目标仓', exact: true }).selectOption('ST-002');
  await form.getByLabel('调拨数量', { exact: true }).fill('3');
  await form.getByLabel('调拨原因', { exact: true }).fill('计划补货');
  await form.getByRole('combobox', { name: '源仓商品', exact: true }).selectOption('ST-003');
  await expect(form.getByRole('combobox', { name: '目标仓', exact: true })).toHaveValue('');
  await expect(form.getByLabel('调拨数量', { exact: true })).toHaveValue('3');
  await expect(form.getByLabel('调拨原因', { exact: true })).toHaveValue('计划补货');
  await expect(
    form.getByRole('combobox', { name: '目标仓', exact: true }).locator('option'),
  ).toHaveText(['请选择目标仓', '杭州仓']);
  await form.getByRole('combobox', { name: '目标仓', exact: true }).selectOption('ST-004');
  await form.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '库存调拨', exact: true }).click();
  await expect(form.getByRole('combobox', { name: '源仓商品', exact: true })).toHaveValue('ST-003');
  await expect(form.getByRole('combobox', { name: '目标仓', exact: true })).toHaveValue('ST-004');
  await form.getByLabel('调拨原因', { exact: true }).fill('   ');
  await form.getByRole('button', { name: '确认调拨' }).click();
  await expect(form.getByRole('alert')).toContainText('调拨原因');
  await form.getByLabel('调拨原因', { exact: true }).fill('跨仓补货');
  await page.screenshot({
    path: info.outputPath('configured-transfer-fields.png'),
    fullPage: true,
  });
  await form.getByRole('button', { name: '确认调拨' }).click();
  const source = page
    .getByRole('row')
    .filter({ hasText: 'SKU-1002' })
    .filter({ hasText: '上海仓' });
  const target = page
    .getByRole('row')
    .filter({ hasText: 'SKU-1002' })
    .filter({ hasText: '杭州仓' });
  await expect(source.getByRole('cell', { name: '357', exact: true })).toBeVisible();
  await expect(target.getByRole('cell', { name: '88', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('adjustment fields validate nonzero quantity and required reason without changing stock on failure', async ({
  page,
}) => {
  await page.goto(`${a}/inventory`);
  const row = page.getByRole('row').filter({ hasText: 'SKU-1001' }).filter({ hasText: '上海仓' });
  await row.getByRole('button', { name: '调整库存' }).click();
  const form = page.getByRole('dialog', { name: '调整库存' });
  await form.getByLabel('调整原因', { exact: true }).fill('盘点');
  await form.getByRole('button', { name: '确认调整' }).click();
  await expect(form.getByRole('alert')).toContainText('不能为 0');
  await form.getByLabel('调整数量', { exact: true }).fill('-1');
  await form.getByLabel('调整原因', { exact: true }).fill('  ');
  await form.getByRole('button', { name: '确认调整' }).click();
  await expect(form.getByRole('alert')).toContainText('调整原因');
  await expect(row.getByRole('cell', { name: '120', exact: true })).toBeVisible();
  await form.getByLabel('调整原因', { exact: true }).fill('盘点差异');
  await form.getByRole('button', { name: '确认调整' }).click();
  await expect(row.getByRole('cell', { name: '119', exact: true })).toBeVisible();
});

test('initial approval can omit its opinion field and review-only enterprise omits all opinion code', async ({
  page,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(`${slim}/approvals`);
  await page
    .getByRole('row')
    .filter({ hasText: 'AP-1002' })
    .getByRole('button', { name: '通过', exact: true })
    .click();
  await expect(page.getByRole('dialog').getByLabel('审批意见', { exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: '确认通过' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'AP-1002' })).toContainText('已通过');
  await page.goto(`${reviewOnly}/approvals`);
  await expect(page.getByRole('button', { name: '通过', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '驳回', exact: true })).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: 'AP-1003' });
  await row.getByRole('button', { name: '复核通过', exact: true }).click();
  const form = page.getByRole('dialog', { name: '确认复核' });
  await expect(form.getByRole('textbox')).toHaveCount(0);
  await form.getByRole('button', { name: '确认复核通过' }).click();
  await expect(row).toContainText('已通过');
  await row.getByRole('button', { name: '审批详情' }).click();
  await page.getByRole('dialog').getByRole('tab', { name: '审批记录', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('同意申请', { exact: true })).toBeVisible();
  expect(requested.filter((url) => /approval-(?:approve|review)-field-comment/u.test(url))).toEqual(
    [],
  );
});

test('configured initial opinion and rejection reason are isolated and role changes discard open drafts', async ({
  page,
}, info) => {
  await page.goto(`${a}/approvals`);
  const row = page.getByRole('row').filter({ hasText: 'AP-1002' });
  await row.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByRole('dialog').getByLabel('审批意见', { exact: true }).fill('  初审预算已确认  ');
  await page.getByRole('dialog').getByRole('button', { name: '确认通过' }).click();
  await row.getByRole('button', { name: '审批详情' }).click();
  await page.getByRole('dialog').getByRole('tab', { name: '审批记录', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('初审预算已确认', { exact: true })).toBeVisible();
  await page.getByRole('dialog').press('Escape');
  const pending = page.getByRole('row').filter({ hasText: 'AP-1001' });
  await pending.getByRole('button', { name: '驳回', exact: true }).click();
  const rejection = page.getByRole('dialog', { name: '驳回申请' });
  await rejection.getByLabel('驳回原因', { exact: true }).fill('未提交的私有原因');
  await page.getByLabel('演示权限').evaluate((element: HTMLSelectElement) => {
    element.value = 'member';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(rejection).toHaveCount(0);
  await page.getByLabel('演示权限').selectOption('admin');
  await pending.getByRole('button', { name: '驳回', exact: true }).click();
  await expect(rejection.getByLabel('驳回原因', { exact: true })).toHaveValue('');
  await rejection.getByLabel('驳回原因', { exact: true }).fill('   ');
  await rejection.getByRole('button', { name: '确认驳回' }).click();
  await expect(rejection.getByRole('alert')).toContainText('驳回原因');
  await rejection.getByLabel('驳回原因', { exact: true }).fill('预算不足');
  await page.screenshot({
    path: info.outputPath('configured-rejection-field.png'),
    fullPage: true,
  });
  await rejection.getByRole('button', { name: '确认驳回' }).click();
  await expect(pending).toContainText('已驳回');
});

test('warehouse field controls fit 390px and retain keyboard-accessible labels', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${a}/inventory`);
  await page.getByRole('button', { name: '库存调拨', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByRole('combobox', { name: '源仓商品', exact: true }).selectOption('ST-001');
  await form.getByRole('combobox', { name: '目标仓', exact: true }).selectOption('ST-002');
  await form.getByLabel('调拨原因', { exact: true }).focus();
  await expect(form.getByLabel('调拨原因', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('transfer-field-mobile.png'), fullPage: true });
});
