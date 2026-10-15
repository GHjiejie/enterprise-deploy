import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadBuildProfile } from '../../build/load-profile.ts';
import { MODULE_IDS, parseBuildMode } from '../../shared/build-profile.ts';
import { validateTarget, parseBackendPolicy } from '../../build/release-record.ts';
import { parseDeliveryPolicy } from '../../build/delivery-policy.ts';
import { moduleRegistry } from '../../build/module-catalog.ts';
import { getModuleHref } from '../../src/platform/navigation-service.ts';
import { DEMO_ACCESS } from '../../src/platform/permissions.ts';
import { startTamperedPreview } from './tamper-preview.ts';

const profile = loadBuildProfile(process.env.APP_PROFILE);
const mode = parseBuildMode(process.env.APP_MODE ?? 'production');
const defaultHref = getModuleHref(
  profile.defaultModule,
  profile,
  DEMO_ACCESS.member,
  moduleRegistry,
);
const previewOrigin = `http://127.0.0.1:${process.env.DELIVERY_PORT ?? 4173}`;
const backendPolicy = parseBackendPolicy(
  JSON.parse(
    readFileSync(resolve(`config/backend-policies/demo-${profile.id}-${mode}.json`), 'utf8'),
  ),
);
const record = validateTarget(resolve(`dist/${profile.id}/${mode}`), {
  profileId: profile.id,
  environment: mode,
  backendPolicy,
  deliveryPolicy: parseDeliveryPolicy(
    JSON.parse(
      readFileSync(resolve(`config/delivery-policies/demo-${profile.id}-${mode}.json`), 'utf8'),
    ),
  ),
});

test('隔离产物副本改开关也不能恢复未交付模块', async ({ page }) => {
  const disabled = MODULE_IDS.filter((id) => !profile.modules[id]);
  test.skip(disabled.length === 0, '全模块包没有被裁剪模块');
  const preview = await startTamperedPreview(
    resolve(`dist/${profile.id}/${mode}`),
    record,
    disabled,
  );
  try {
    for (const id of disabled) {
      const definition = moduleRegistry.find((module) => module.id === id);
      const path = definition?.routes.find(
        (route) => route.name === definition.entryRouteName,
      )?.path;
      if (!path) throw new Error(`Missing test route for ${id}`);
      await page.goto(`${preview.origin}${path}`);
      await expect(page.getByTestId('route-not-found')).toBeVisible();
    }
    await page.goto(`${preview.origin}${defaultHref}`);
    await expect(page.getByTestId('route-not-found')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link')).toHaveCount(
      record.enabledModules.length,
    );
  } finally {
    await preview.close();
  }
});

test('产物身份、配置仓库隔离和默认入口', async ({ page, request }) => {
  const response = await request.get('/release-record.json');
  expect(response.ok()).toBe(true);
  expect((await response.json()).artifactDigest).toBe(record.artifactDigest);
  for (const filename of [
    'config/profiles/enterprise-a.json',
    'config/profiles/enterprise-b.json',
  ]) {
    expect((await request.get(`/${filename}`)).headers()['content-type']).not.toContain(
      'application/json',
    );
  }
  await page.goto('/');
  await expect(page).toHaveURL(`${previewOrigin}${defaultHref}`);
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
});

test('导航、快捷按钮、卡片和搜索共享功能规则', async ({ page }) => {
  test.skip(!profile.modules.modelCatalog, '此企业未开放模型广场');
  await page.goto('/models');
  await expect(page.getByTestId('catalog-page')).toBeVisible();
  for (const [moduleId, label, capability, shortcut] of [
    ['imageStudio', '图片生成', 'image', '图片创作'],
    ['videoStudio', '视频生成', 'video', '视频创作'],
  ] as const) {
    const count = profile.modules[moduleId] ? 1 : 0;
    await expect(page.getByRole('navigation').getByRole('link', { name: label })).toHaveCount(
      count,
    );
    await expect(page.getByRole('link', { name: shortcut, exact: true })).toHaveCount(count);
    await expect(page.getByTestId(`model-${capability}`)).toBeVisible();
    await expect(
      page.getByTestId(`model-${capability}`).getByRole('link', { name: '在线体验' }),
    ).toHaveCount(count);
  }
  await page.getByRole('searchbox').fill('图像');
  const search = page.getByRole('region', { name: '体验搜索结果' });
  // The named search container is rendered as a semantic region.
  await expect(search.getByRole('link', { name: '图片生成' })).toHaveCount(
    profile.modules.imageStudio ? 1 : 0,
  );
});

for (const [moduleId, kind, alias] of [
  ['imageStudio', 'image', 'image-studio'],
  ['videoStudio', 'video', 'video-studio'],
] as const) {
  test(`${kind} 直链、详情、旧别名及管理员无法绕过关闭规则`, async ({ page }) => {
    const chunks = record.artifacts
      .filter((item) => item.path.endsWith('.js') && item.path.includes('page-'))
      .map((item) => item.path);
    const requested = new Set<string>();
    page.on('request', (request) => {
      requested.add(new URL(request.url()).pathname.slice(1));
    });
    for (const path of [
      `/playground/${kind}`,
      `/playground/${kind}/tasks/test-01`,
      `/${alias}`,
      `/${alias}/tasks/test-01`,
    ]) {
      await page.goto(path);
      if (profile.modules[moduleId]) await expect(page.getByTestId(`${kind}-studio`)).toBeVisible();
      else {
        await expect(page.getByTestId('route-not-found')).toBeVisible();
        await page.getByRole('combobox', { name: '演示权限' }).selectOption('admin');
        await expect(page.getByTestId('route-not-found')).toBeVisible();
        expect(chunks.filter((chunk) => requested.has(chunk))).toEqual([]);
      }
    }
  });
}

test('运行时权限、默认入口降级、无权限与未登录恢复', async ({ page }) => {
  test.skip(
    !profile.modules.modelCatalog || !profile.modules.chat,
    '此场景需要模型广场和对话同时开放',
  );
  await page.goto('/models');
  await page.getByRole('combobox', { name: '演示权限' }).selectOption('chatOnly');
  await expect(page.getByTestId('route-forbidden')).toBeVisible();
  await page.getByRole('link', { name: '返回工作台' }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByTestId('chat-page')).toBeVisible();
  await page.getByRole('combobox', { name: '演示权限' }).selectOption('noAccess');
  await page.getByRole('link', { name: '返回工作台' }).click();
  await expect(page.getByTestId('route-no-access')).toBeVisible();
  await page.getByRole('combobox', { name: '演示权限' }).selectOption('anonymous');
  await expect(page.getByTestId('route-unauthenticated')).toBeVisible();
  await page.getByRole('button', { name: '演示登录' }).click();
  await expect(page).toHaveURL(`${previewOrigin}${defaultHref}`);
});

test('对话公共上传在图片关闭时仍可使用，历史入口给出反馈', async ({ page }) => {
  test.skip(
    !profile.modules.modelCatalog || !profile.modules.chat,
    '此场景需要模型广场和对话同时开放',
  );
  await page.goto('/chat');
  await page.getByLabel('附加图片或文件', { exact: false }).setInputFiles({
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('shared upload'),
  });
  await expect(page.getByText('note.txt', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '你的问题' }).fill('你好');
  await page.getByRole('button', { name: '检查对话输入' }).click();
  await expect(page.getByRole('status')).toContainText('尚未连接对话服务');
  await page.goto('/models');
  await page.getByRole('button', { name: '产品视觉探索' }).click();
  if (profile.modules.imageStudio)
    await expect(page.getByTestId('image-studio')).toContainText('demo-image-01');
  else {
    await expect(page).toHaveURL(/\/models$/);
    await expect(page.getByRole('status')).toBeVisible();
  }
});

test('窄屏无横向溢出、空搜索和未知通用类型', async ({ page }) => {
  test.skip(!profile.modules.modelCatalog, '此企业未开放模型广场');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/models');
  await expect(page.getByTestId('catalog-page')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('searchbox').fill('不存在的模型');
  await expect(page.getByText('没有匹配的模型，请尝试其他关键词。')).toBeVisible();
  await page.goto('/playground/unknown');
  await expect(page.getByTestId('route-not-found')).toBeVisible();
});
