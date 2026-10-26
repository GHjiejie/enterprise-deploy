import { expect, test } from '@playwright/test';
const a = 'http://127.0.0.1:5191';
const slim = 'http://127.0.0.1:5195';

test('slim enterprise delivers initial approval without rejection or review and preserves the review gate', async ({
  page,
}) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto(`${slim}/approvals`);
  await expect(page.getByRole('columnheader', { name: '申请人', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '金额', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '申请事由', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '驳回', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '复核通过', exact: true })).toHaveCount(0);
  const pending = page.getByRole('row').filter({ hasText: 'AP-1001' });
  await pending.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认通过', exact: true }).click();
  await expect(pending).toContainText('复核中');
  await expect(pending.getByRole('button', { name: '通过', exact: true })).toHaveCount(0);
  await pending.getByRole('button', { name: '审批详情' }).click();
  await expect(
    page.getByRole('dialog').getByRole('tab', { name: '申请信息', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('tab', { name: '审批记录', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('dialog').getByRole('tab', { name: '扩展信息', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('dialog').press('Escape');
  const small = page.getByRole('row').filter({ hasText: 'AP-1002' });
  await small.getByRole('button', { name: '通过', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认通过', exact: true }).click();
  await expect(small).toContainText('已通过');
  expect(
    requests.filter((url) =>
      /approval-(?:reject|review|history|field-cost-center|field-urgency)|(?:approval-column-amount|approval-column-applicant)/u.test(
        url,
      ),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test('slim forms contain only selected fields, and column headers match cells after creation', async ({
  page,
}) => {
  await page.goto(`${slim}/orders`);
  await expect(page.getByRole('columnheader', { name: '客户', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '订单金额', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '状态', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '新建订单', exact: true }).click();
  const form = page.getByRole('dialog');
  await expect(form.getByLabel('客户参考号', { exact: true })).toHaveCount(0);
  await form.getByLabel('客户名称', { exact: true }).fill('精简企业客户');
  await form.getByLabel('订单金额', { exact: true }).fill('500');
  await form.getByRole('button', { name: '创建订单', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: '精简企业客户' });
  expect(await row.getByRole('cell').count()).toBe(await page.getByRole('columnheader').count());
  await row.getByRole('button', { name: '详情', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('dialog').getByRole('tab', { name: '跟进备注' })).toHaveCount(0);
  await page.getByRole('dialog').press('Escape');
  await page.getByRole('link', { name: '审批中心' }).click();
  await page.getByRole('button', { name: '发起审批', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('成本中心', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByLabel('紧急程度', { exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByLabel('申请事由', { exact: true }).fill('精简表单申请');
  await page.getByRole('dialog').getByLabel('申请人', { exact: true }).fill('成员');
  await page.getByRole('dialog').getByLabel('申请金额', { exact: true }).fill('200');
  await page.getByRole('dialog').getByRole('button', { name: '提交申请', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '精简表单申请' })).toBeVisible();
});

test('optional fields validate and persist in independently selected detail tabs', async ({
  page,
}, info) => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  await page.goto(`${a}/orders`);
  await page.getByRole('button', { name: '新建订单', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('客户名称', { exact: true }).fill('字段配置客户');
  await form.getByLabel('订单金额', { exact: true }).fill('880');
  await form.getByLabel('客户参考号', { exact: true }).fill('INVALID!');
  await form.getByRole('button', { name: '创建订单', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('客户参考号');
  await expect(form.getByLabel('客户名称', { exact: true })).toHaveValue('字段配置客户');
  await form.getByLabel('客户参考号', { exact: true }).fill('PO-2026-001');
  await form.getByRole('button', { name: '创建订单', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: '字段配置客户' })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  const detail = page.getByRole('dialog', { name: '订单详情' });
  await expect(detail.getByRole('tab', { name: '基本信息' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(urls.some((url) => /order-detail-extra/u.test(url))).toBe(false);
  const controls = await detail
    .getByRole('tab', { name: '扩展信息' })
    .getAttribute('aria-controls');
  expect(controls).toBeTruthy();
  await expect(detail.locator(`[id="${controls}"]`)).toHaveCount(1);
  await detail.getByRole('tab', { name: '跟进备注' }).click();
  await detail.getByLabel('新增备注').fill('切换页签后仍保留草稿');
  await detail.getByRole('tab', { name: '扩展信息' }).click();
  await expect(detail.getByText('PO-2026-001', { exact: true })).toBeVisible();
  await detail.getByRole('tab', { name: '扩展信息' }).press('ArrowLeft');
  await expect(detail.getByRole('tab', { name: '跟进备注' })).toBeFocused();
  await expect(detail.getByLabel('新增备注')).toHaveValue('切换页签后仍保留草稿');
  await page.screenshot({ path: info.outputPath('configured-detail-tabs.png'), fullPage: true });
  // Simulate an identity refresh while a detail dialog is open.
  await page.getByLabel('演示权限').evaluate((element: HTMLSelectElement) => {
    element.value = 'member';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(detail.getByRole('tab', { name: '跟进备注' })).toHaveCount(0);
  await expect(detail.getByRole('tab', { name: '扩展信息' })).toHaveCount(0);
  await expect(detail.getByRole('tab', { name: '基本信息' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(detail.getByLabel('新增备注')).toHaveCount(0);
});

test('permission revocation removes optional inputs and their draft values before submission', async ({
  page,
}, info) => {
  await page.goto(`${a}/approvals`);
  await page.getByRole('button', { name: '发起审批', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('申请事由', { exact: true }).fill('字段权限测试');
  await form.getByLabel('申请人', { exact: true }).fill('测试成员');
  await form.getByLabel('申请金额', { exact: true }).fill('1200');
  await form.getByLabel('成本中心', { exact: true }).fill('BAD');
  await form.getByRole('button', { name: '提交申请', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('成本中心');
  await form.getByLabel('成本中心', { exact: true }).fill('RD-001');
  await form.getByRole('combobox', { name: '紧急程度', exact: true }).selectOption('紧急');
  await page.screenshot({ path: info.outputPath('configured-form-fields.png'), fullPage: true });
  await page.getByLabel('演示权限').evaluate((element: HTMLSelectElement) => {
    element.value = 'member';
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(form.getByLabel('成本中心', { exact: true })).toHaveCount(0);
  await expect(form.getByRole('combobox', { name: '紧急程度', exact: true })).toHaveValue('紧急');
  await form.getByRole('button', { name: '提交申请', exact: true }).click();
  await page.getByLabel('演示权限').selectOption('admin');
  const row = page.getByRole('row').filter({ hasText: '字段权限测试' });
  await row.getByRole('button', { name: '审批详情' }).click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('tab', { name: '扩展信息', exact: true }).click();
  await expect(detail.getByText('紧急', { exact: true })).toBeVisible();
  await expect(detail.getByText('成本中心', { exact: true })).toHaveCount(0);
  await expect(detail.getByText('RD-001', { exact: true })).toHaveCount(0);
});

test('configured tabs and fields remain usable at 390px', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${a}/orders`);
  await page
    .getByRole('row')
    .filter({ hasText: 'ORD-2026-1001' })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('tab', { name: '基本信息' }).press('End');
  await expect(detail.getByRole('tab', { name: '扩展信息' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('detail-tabs-mobile.png'), fullPage: true });
});
