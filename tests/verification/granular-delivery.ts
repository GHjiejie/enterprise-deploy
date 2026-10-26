import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { buildEnterprise } from '../../build/enterprise';
import { buildPaths } from '../../build/audit/record';
import type { AuditRecord } from '../../build/audit/types';
import { loadPolicy } from '../../build/policy/manifest';
import { packageBuild, verifyPackage } from '../../build/package';
import { staticServer } from '../../build/preview';
import { args, cli, PROJECT_ROOT } from '../../build/utils';

const enterpriseId = 'enterprise-granular-proof';
const selected = [
  'orders',
  'order-create',
  'order-field-customer',
  'order-field-amount',
  'order-column-customer',
  'order-column-status',
  'order-detail',
  'order-detail-overview',
  'approvals',
  'approval-submit',
  'approval-field-title',
  'approval-field-applicant',
  'approval-field-amount',
  'approval-field-urgency',
  'approval-approve',
  'approval-column-title',
  'approval-column-status',
  'approval-detail',
  'approval-detail-overview',
  'approval-history',
].sort();

function deliveredText(audit: AuditRecord, site: string, extension: RegExp): string {
  return audit.files
    .filter((file) => extension.test(file.path))
    .map((file) => readFileSync(resolve(site, file.path), 'utf8'))
    .join('\n');
}

async function verifyBrowser(audit: AuditRecord, site: string, evidenceDirectory: string) {
  const server = staticServer(audit, site);
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Preview address unavailable');
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  const checks: string[] = [];
  try {
    await page.goto(`${origin}/orders`);
    await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
    const menuTitles = (
      await page.getByRole('navigation', { name: '主导航' }).getByRole('link').allTextContents()
    )
      .map((text) => text.replace('↗', '').trim())
      .sort();
    assert.deepEqual(menuTitles, ['审批中心', '订单管理'].sort());
    await expect(page.getByRole('columnheader', { name: '客户', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '状态', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '订单金额', exact: true })).toHaveCount(0);
    for (const name of ['导出订单', '批量完成', '加急', '新手指引'])
      await expect(page.getByRole('button', { name: new RegExp(name, 'u') })).toHaveCount(0);
    checks.push('Only orders/approvals menus and selected order columns/actions are rendered.');

    await page.getByRole('button', { name: '新建订单', exact: true }).click();
    const orderForm = page.getByRole('dialog', { name: '新建订单', exact: true });
    await expect(orderForm.getByLabel('客户名称', { exact: true })).toBeVisible();
    await expect(orderForm.getByLabel('订单金额', { exact: true })).toBeVisible();
    await expect(orderForm.getByLabel('客户参考号', { exact: true })).toHaveCount(0);
    await orderForm.getByLabel('客户名称', { exact: true }).fill('裁剪验收客户');
    await orderForm.getByLabel('订单金额', { exact: true }).fill('880');
    await page.screenshot({
      path: resolve(evidenceDirectory, 'orders-selected-fields.png'),
      fullPage: true,
    });
    await orderForm.getByRole('button', { name: '创建订单', exact: true }).click();
    const order = page.getByRole('row').filter({ hasText: '裁剪验收客户' });
    await expect(order).toContainText('待处理');
    assert.equal(
      await order.getByRole('cell').count(),
      await page.getByRole('columnheader').count(),
    );
    await order.getByRole('button', { name: '详情', exact: true }).click();
    const orderDetail = page.getByRole('dialog', { name: '订单详情', exact: true });
    await expect(orderDetail.getByRole('tab')).toHaveText(['基本信息']);
    await expect(orderDetail.getByText('裁剪验收客户', { exact: true })).toBeVisible();
    await page.screenshot({
      path: resolve(evidenceDirectory, 'order-selected-tab.png'),
      fullPage: true,
    });
    await orderDetail.press('Escape');
    checks.push('Order creation works with two required fields and only the overview tab.');

    await page.getByRole('link', { name: '审批中心', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: '申请事由', exact: true })).toBeVisible();
    for (const name of ['申请人', '金额'])
      await expect(page.getByRole('columnheader', { name, exact: true })).toHaveCount(0);
    for (const name of ['驳回', '复核通过'])
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '发起审批', exact: true }).click();
    const approvalForm = page.getByRole('dialog');
    await expect(approvalForm.getByLabel('成本中心', { exact: true })).toHaveCount(0);
    await approvalForm.getByLabel('申请事由', { exact: true }).fill('裁剪版本审批验证');
    await approvalForm.getByLabel('申请人', { exact: true }).fill('验收成员');
    await approvalForm.getByLabel('申请金额', { exact: true }).fill('3200');
    await approvalForm.getByLabel('紧急程度', { exact: true }).selectOption('紧急');
    await page.screenshot({
      path: resolve(evidenceDirectory, 'approval-selected-fields.png'),
      fullPage: true,
    });
    await approvalForm.getByRole('button', { name: '提交申请', exact: true }).click();
    const request = page.getByRole('row').filter({ hasText: '裁剪版本审批验证' });
    await request.getByRole('button', { name: '通过', exact: true }).click();
    const confirmation = page.getByRole('dialog');
    await expect(confirmation.getByRole('textbox')).toHaveCount(0);
    await confirmation.getByRole('button', { name: '确认通过', exact: true }).click();
    await expect(request).toContainText('已通过');
    await request.getByRole('button', { name: '审批详情', exact: true }).click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByRole('tab')).toHaveText(['申请信息', '审批记录']);
    await detail.getByRole('tab', { name: '审批记录', exact: true }).click();
    await expect(detail.getByText('同意申请', { exact: true })).toBeVisible();
    await page.screenshot({
      path: resolve(evidenceDirectory, 'approval-selected-tabs.png'),
      fullPage: true,
    });
    await detail.press('Escape');
    checks.push(
      'Approval submission/initial approval work, urgency remains, cost center and opinion fields are absent, and only two selected detail tabs exist.',
    );

    const large = page.getByRole('row').filter({ hasText: 'AP-1001' });
    await large.getByRole('button', { name: '通过', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确认通过', exact: true }).click();
    await expect(large).toContainText('复核中');
    await expect(large.getByRole('button', { name: '复核通过', exact: true })).toHaveCount(0);
    checks.push('Removing review capability does not bypass the large-amount review state.');

    for (const route of ['inventory', 'reports', 'stocktakes']) {
      await page.goto(`${origin}/${route}`);
      await expect(page.getByRole('heading', { name: '页面未找到', exact: true })).toBeVisible();
    }
    const approvedFiles = new Set(audit.files.map((file) => file.path));
    const resourceRequests = [
      ...new Set(
        requests
          .map((url) => new URL(url))
          .filter((url) => url.origin === origin && /\.(js|css|svg)$/u.test(url.pathname))
          .map((url) => url.pathname.slice(1)),
      ),
    ].sort();
    assert(
      resourceRequests.every((file) => approvedFiles.has(file)),
      'An unapproved resource was requested',
    );
    assert.deepEqual(errors, []);
    checks.push(
      'Excluded module deep links show not-found; all requested assets belong to the sealed file allowlist; no browser runtime errors.',
    );
    return { checks, resourceRequests, errors };
  } finally {
    await browser.close();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  }
}

await cli(async () => {
  const options = args(['release-id']);
  const releaseId = options['release-id'] ?? `granular-proof-${randomUUID().slice(0, 8)}`;
  const policy = loadPolicy(PROJECT_ROOT, enterpriseId);
  const referencePolicy = loadPolicy(PROJECT_ROOT, 'enterprise-a');
  assert.deepEqual(
    [...policy.enterprise.enabledModules].sort(),
    selected,
    'The proof enterprise selection changed',
  );
  assert.equal(
    referencePolicy.selected.length,
    policy.catalog.length,
    'Reference enterprise must enable the complete catalog',
  );
  const [audit, reference] = await Promise.all([
    buildEnterprise(PROJECT_ROOT, enterpriseId, 'production', releaseId),
    buildEnterprise(PROJECT_ROOT, 'enterprise-a', 'production', `${releaseId}-full`),
  ]);
  assert.equal(
    audit.sourceTreeHash,
    reference.sourceTreeHash,
    'The two builds used different source trees',
  );
  const packaged = packageBuild(PROJECT_ROOT, enterpriseId, releaseId);
  const referencePackage = packageBuild(PROJECT_ROOT, 'enterprise-a', reference.releaseId);
  const paths = buildPaths(PROJECT_ROOT, enterpriseId, releaseId);
  const fullPaths = buildPaths(PROJECT_ROOT, 'enterprise-a', reference.releaseId);
  const site = resolve(paths.release, 'site');
  const referenceSite = resolve(fullPaths.release, 'site');
  const allowed = new Set(selected);
  const graphInputs = audit.contexts.flatMap((context) => context.modules);
  const outputInputs = audit.files.flatMap((file) => file.inputs);
  const excluded = policy.catalog
    .filter((module) => !allowed.has(module.id))
    .map((module) => ({
      id: module.id,
      sourceScanInputs: audit.sources.inputs.filter(
        (input) => input.kind === 'business' && input.owner === module.id,
      ).length,
      graphInputs: graphInputs.filter(
        (input) => input.kind === 'business' && input.owner === module.id,
      ).length,
      outputInputs: outputInputs.filter(
        (input) => input.kind === 'business' && input.owner === module.id,
      ).length,
    }));
  assert(
    excluded.every(
      (item) => item.sourceScanInputs === 0 && item.graphInputs === 0 && item.outputInputs === 0,
    ),
    'An excluded capability entered the source/build/output graph',
  );
  for (const input of [...graphInputs, ...outputInputs])
    if (input.kind === 'business') assert(allowed.has(input.owner));
  const customText = deliveredText(audit, site, /\.(js|css)$/u);
  const fullText = deliveredText(reference, referenceSite, /\.(js|css)$/u);
  const markers = [
    ['order-export', 'orders.csv'],
    ['order-export', 'export-control'],
    ['order-bulk-complete', '确认批量完成'],
    ['order-priority', '取消加急'],
    ['order-field-reference', '客户参考号仅允许 1–40 位字母、数字和短横线。'],
    ['order-notes', '新增备注'],
    ['approval-reject', '驳回申请'],
    ['approval-review', '确认复核通过'],
    ['approval-approve-field-comment', '初审意见须为不超过 200 字的文本。'],
    ['approval-field-cost-center', '成本中心格式应为两个大写字母、短横线及三位数字，例如 RD-001。'],
    ['reports', '收入趋势示意'],
    ['onboarding', '正在定位功能位置…'],
    ['stocktake-post', '只有复核通过的盘点单可以差异过账。'],
  ].map(([owner, marker]) => {
    assert(owner && marker);
    const positiveControl = fullText.includes(marker);
    const foundInCustom = customText.includes(marker);
    assert(positiveControl, `Full-build positive control missing: ${owner}/${marker}`);
    assert(!foundInCustom, `Excluded implementation marker found: ${owner}/${marker}`);
    return { owner, marker, foundInFull: positiveControl, foundInCustom };
  });
  assert(
    customText.includes('请选择有效的紧急程度。'),
    'Selected optional urgency validator is missing',
  );
  const removedResources = reference.files
    .filter(
      (file) =>
        file.kind === 'asset' &&
        file.inputs.some((input) => input.kind === 'business' && !allowed.has(input.owner)),
    )
    .map((file) => {
      assert(
        !audit.files.some((item) => item.sha256 === file.sha256),
        `Excluded asset bytes still delivered: ${file.path}`,
      );
      return {
        path: file.path,
        bytes: file.bytes,
        sha256: file.sha256,
        owners: [
          ...new Set(
            file.inputs.filter((input) => input.kind === 'business').map((input) => input.owner),
          ),
        ],
      };
    });
  assert(removedResources.length > 0, 'No resource positive controls were available');
  assert(
    reference.contexts.some((context) => context.kind === 'worker'),
    'Full build has no export worker positive control',
  );
  assert(
    !audit.contexts.some((context) => context.kind === 'worker'),
    'Export worker remains in custom build',
  );
  assert(
    !audit.files.some((file) => file.producer === 'worker'),
    'Worker output remains in custom package',
  );
  assert(
    audit.files.every((file) => !/\.(map|svg|png|webp|ts|vue)$/u.test(file.path)),
    'Unselected resources or raw sources were delivered',
  );
  const evidenceDirectory = resolve(paths.audit, 'granular-proof');
  mkdirSync(evidenceDirectory);
  const browser = await verifyBrowser(audit, site, evidenceDirectory);
  verifyPackage(PROJECT_ROOT, enterpriseId, releaseId);
  verifyPackage(PROJECT_ROOT, 'enterprise-a', reference.releaseId);
  const result = {
    status: 'passed',
    enterpriseId,
    releaseId,
    referenceReleaseId: reference.releaseId,
    sourceTreeHash: audit.sourceTreeHash,
    enabledCapabilities: selected,
    catalogCount: policy.catalog.length,
    excludedCapabilityCount: excluded.length,
    excludedCapabilities: excluded,
    implementationMarkers: markers,
    removedResources,
    deliveredFiles: audit.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    customFileCount: audit.files.length,
    referenceFileCount: reference.files.length,
    customBytes: audit.files.reduce((sum, file) => sum + file.bytes, 0),
    referenceBytes: reference.files.reduce((sum, file) => sum + file.bytes, 0),
    customArchiveBytes: readFileSync(paths.archive).byteLength,
    referenceArchiveBytes: readFileSync(fullPaths.archive).byteLength,
    packageHash: packaged.packageHash,
    referencePackageHash: referencePackage.packageHash,
    archive: paths.archive,
    referenceArchive: fullPaths.archive,
    browser,
  };
  writeFileSync(resolve(evidenceDirectory, 'report.json'), `${JSON.stringify(result, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({
      status: result.status,
      enterpriseId,
      releaseId,
      enabled: selected.length,
      excluded: excluded.length,
      files: audit.files.length,
      removedAssets: removedResources.length,
      report: resolve(evidenceDirectory, 'report.json'),
      archive: paths.archive,
    }),
  );
});
