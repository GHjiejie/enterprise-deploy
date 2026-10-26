import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildEnterprise } from '../../build/enterprise';
import { buildPaths } from '../../build/audit/record';
import type { AuditRecord } from '../../build/audit/types';
import { packageBuild, verifyPackage } from '../../build/package';
import { loadPolicy, selectModules } from '../../build/policy/manifest';
import { scanSources } from '../../build/policy/scan';
import { createProfileStore } from '../../build/console/store';
import { planSelection } from '../../build/console/grouping';
import { createMockService } from '../../src/shared/mock/service';
import { fixture } from '../helpers/fixture';

const markers = [
  'ALIYUN_SMS_MOCK',
  'ALIYUN_CAPTCHA_MOCK',
  'ALIYUN_CLOUDAUTH_MOCK',
  'WECHAT_OPEN_MOCK',
  'WECHAT_PAY_MOCK',
  'WECOM_MOCK',
  'TENCENT_SMTP_MOCK',
  'ALIYUN_OSS_MOCK',
  'FEISHU_BASE_MOCK',
  'HERMES_MODEL_MOCK',
  'COMPANY_SUBJECT_MOCK_ASSET',
];
describe('external mock customization and physical delivery', () => {
  const project = fixture();
  let full: AuditRecord;
  let custom: AuditRecord;
  beforeAll(async () => {
    const { modules } = createProfileStore(project.root).summaries();
    const ids = modules
      .filter((item) =>
        [
          'access',
          'account',
          'billing',
          'media',
          'operations',
          'company',
          'external-resources',
        ].includes(item.groupId),
      )
      .map((item) => item.id);
    expect(ids).toHaveLength(44);
    writeFileSync(
      resolve(project.root, 'config/enterprises/enterprise-mock-full.json'),
      JSON.stringify({
        schemaVersion: 1,
        enterpriseId: 'enterprise-mock-full',
        brandingId: 'brand-a',
        enabledModules: ids,
      }),
    );
    [full, custom] = await Promise.all([
      buildEnterprise(project.root, 'enterprise-mock-full', 'production', 'external-full'),
      buildEnterprise(project.root, 'enterprise-mock-custom', 'production', 'external-custom'),
    ]);
    packageBuild(project.root, 'enterprise-mock-full', 'external-full');
    packageBuild(project.root, 'enterprise-mock-custom', 'external-custom');
  });
  afterAll(project.dispose);
  function contents(audit: AuditRecord): string {
    const site = resolve(
      buildPaths(project.root, audit.enterpriseId, audit.releaseId).release,
      'site',
    );
    return audit.files.map((file) => readFileSync(resolve(site, file.path), 'utf8')).join('\n');
  }
  it('delivers all eleven mock resource identities and their dedicated assets in the full package', () => {
    const text = contents(full);
    for (const marker of markers) expect(text).toContain(marker);
    expect(full.enabledModules).toHaveLength(44);
    expect(
      full.files.filter(
        (file) =>
          file.kind === 'asset' &&
          file.inputs.some(
            (input) =>
              input.id.endsWith('/assets/mock.svg') ||
              input.id.endsWith('/company/assets/logo.svg'),
          ),
      ),
    ).toHaveLength(11);
    expect(verifyPackage(project.root, full.enterpriseId, full.releaseId).audit.siteHash).toBe(
      full.siteHash,
    );
  });
  it('removes disabled owners from source closure, compiled graphs, output origins and sealed package bytes', () => {
    const text = contents(custom);
    const allowed = new Set(custom.enabledModules);
    expect(allowed.size).toBe(17);
    for (const input of [
      ...custom.sources.inputs,
      ...custom.contexts.flatMap((context) => context.modules),
      ...custom.files.flatMap((file) => file.inputs),
    ])
      if (input.kind === 'business') expect(allowed.has(input.owner), input.id).toBe(true);
    for (const marker of [
      'ALIYUN_CAPTCHA_MOCK',
      'WECHAT_OPEN_MOCK',
      'WECOM_MOCK',
      'ALIYUN_OSS_MOCK',
      'COMPANY_SUBJECT_MOCK_ASSET',
    ])
      expect(text).not.toContain(marker);
    for (const removed of [
      '微信扫码登录',
      '个人实名',
      '邮箱绑定',
      '微信充值',
      '客户反馈表单',
      '生成图片',
      '示例代码',
      'mock/generated-video.mp4',
    ])
      expect(text).not.toContain(removed);
    for (const kept of [
      'ALIYUN_SMS_MOCK',
      'ALIYUN_CLOUDAUTH_MOCK',
      'WECHAT_PAY_MOCK',
      'TENCENT_SMTP_MOCK',
      'FEISHU_BASE_MOCK',
      'HERMES_MODEL_MOCK',
    ])
      expect(text).toContain(kept);
    expect(custom.files.filter((file) => file.kind === 'asset')).toHaveLength(6);
    expect(verifyPackage(project.root, custom.enterpriseId, custom.releaseId).audit.siteHash).toBe(
      custom.siteHash,
    );
  });
  it('rejects a retained action with no host or service and previews removal of shared resource consumers', () => {
    const policy = loadPolicy(project.root, 'enterprise-a');
    const { modules } = createProfileStore(project.root).summaries();
    for (const missing of ['access', 'resource-sms'])
      expect(() =>
        selectModules(policy.catalog, {
          ...policy.enterprise,
          enabledModules: ['access', 'resource-sms', 'access-sms-login'].filter(
            (id) => id !== missing,
          ),
        }),
      ).toThrow('MISSING_DEPENDENCY');
    const removal = planSelection(
      modules,
      policy.enterprise.enabledModules,
      ['resource-sms'],
      false,
    );
    expect(removal.removed).toEqual([
      'access-sms-login',
      'access-sms-recover',
      'access-sms-register',
      'account-sms-close',
      'account-sms-mobile',
      'resource-sms',
    ]);
    expect(removal.next).toContain('access-wechat-login');
    expect(removal.next).toContain('billing-recharge');
    const payment = planSelection(
      modules,
      policy.enterprise.enabledModules,
      ['billing-recharge'],
      false,
    );
    expect(payment.next).toContain('billing-refund');
    expect(payment.next).toContain('resource-pay');
    const evidence = scanSources(loadPolicy(project.root, 'enterprise-b'));
    expect(
      evidence.inputs
        .filter((item) => item.kind === 'business')
        .every((item) => item.owner === 'orders'),
    ).toBe(true);
    expect(evidence.inputs.some((item) => item.id.includes('/shared/mock/'))).toBe(false);
  });
});

it('mock transport exposes failures and supports cancellation without a late success', async () => {
  const service = createMockService('测试服务', 'TEST', 'local.svg');
  await expect(
    service.execute('test', '结果', 'failure', new AbortController().signal),
  ).rejects.toThrow('失败');
  const controller = new AbortController();
  const request = service.execute('test', '结果', 'success', controller.signal);
  controller.abort();
  await expect(request).rejects.toThrow('已取消');
  await expect(
    service.execute('test', '结果', 'success', new AbortController().signal),
  ).resolves.toMatchObject({ message: '结果' });
});
