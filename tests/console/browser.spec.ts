import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { parseReleaseRecord } from '../../build/release-record.ts';
import type { BuildProfile } from '../../shared/build-profile.ts';
import type { ConsoleBootstrap, StartBuildResponse } from '../../shared/build-console.ts';

const profileId = process.env.CONSOLE_E2E_PROFILE_ID;
const directory = process.env.CONSOLE_E2E_DIRECTORY;
if (!profileId || !directory)
  throw new Error('请使用 playwright.console.config.ts 运行可视化构建验收');
const jobs = new Set<string>();

test.afterAll(() => {
  for (const id of jobs) {
    if (/^[a-zA-Z0-9_-]+$/u.test(id)) {
      rmSync(resolve('dist/.console', id), { recursive: true, force: true });
    }
  }
  if (/^e2e-console-[a-f0-9]+$/u.test(profileId)) {
    rmSync(resolve('dist', profileId), { recursive: true, force: true });
  }
});

test('企业配置可切换、编辑并保存，刷新后读取实际配置文件', async ({ page, request }) => {
  await page.goto('/');
  const enterprise = page.getByRole('combobox', { name: '企业配置', exact: true });
  await enterprise.selectOption('enterprise-a');
  await expect(page.getByRole('checkbox', { name: '图片生成', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: '视频生成', exact: true })).not.toBeChecked();
  await enterprise.selectOption('enterprise-b');
  await expect(page.getByRole('checkbox', { name: '图片生成', exact: true })).toBeChecked();
  await enterprise.selectOption('enterprise-a');
  await page.getByRole('checkbox', { name: '图片生成', exact: true }).check();
  await page.getByRole('combobox', { name: /^默认页面/ }).selectOption('imageStudio');
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/profiles/enterprise-a') &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await enterprise.selectOption('enterprise-a');
  await expect(page.getByRole('checkbox', { name: '图片生成', exact: true })).toBeChecked();
  await expect(page.getByRole('combobox', { name: /^默认页面/ })).toHaveValue('imageStudio');

  const bootstrap = (await (await request.get('/api/bootstrap')).json()) as ConsoleBootstrap;
  expect(
    bootstrap.profiles.find((entry) => entry.profile.id === 'enterprise-a')?.profile.defaultModule,
  ).toBe('imageStudio');
  const savedProfile = JSON.parse(
    readFileSync(join(directory, 'profiles/enterprise-a.json'), 'utf8'),
  );
  expect(savedProfile.modules.imageStudio).toBe(true);
  expect(savedProfile.defaultModule).toBe('imageStudio');
});

test('非法模块组合会阻止提交，保存失败保留输入并可重试', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('enterprise-b');
  await page.getByRole('checkbox', { name: '模型广场', exact: true }).uncheck();
  await expect(
    page.getByText('请选择一个已启用的模块作为默认页面。', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '保存并构建', exact: true })).toBeDisabled();
  for (const name of ['智能对话', '图片生成', '视频生成']) {
    await page.getByRole('checkbox', { name, exact: true }).uncheck();
  }
  await expect(page.getByText('请至少启用一个模块。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存配置', exact: true })).toBeDisabled();

  await page.getByRole('checkbox', { name: '智能对话', exact: true }).check();
  await page.getByRole('combobox', { name: /^默认页面/ }).selectOption('chat');
  await page.route('**/api/profiles/enterprise-b', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'unavailable', message: '测试保存失败，请重试。' } }),
    });
  });
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('测试保存失败，请重试。');
  await expect(page.getByRole('checkbox', { name: '智能对话', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '图片生成', exact: true })).not.toBeChecked();
  await expect(page.getByRole('combobox', { name: /^默认页面/ })).toHaveValue('chat');
  await page.unroute('**/api/profiles/enterprise-b');
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/profiles/enterprise-b') &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('enterprise-b');
  await expect(page.getByRole('checkbox', { name: '模型广场', exact: true })).not.toBeChecked();
  await expect(page.getByRole('combobox', { name: /^默认页面/ })).toHaveValue('chat');
});

test('外部修改造成版本冲突时保留草稿，显式重新加载后恢复编辑', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('enterprise-b');
  const path = join(directory, 'profiles/enterprise-b.json');
  const existing = JSON.parse(readFileSync(path, 'utf8')) as BuildProfile;
  await page
    .getByRole('checkbox', { name: '图片生成', exact: true })
    .setChecked(!existing.modules.imageStudio);
  const external = {
    ...existing,
    modules: { ...existing.modules, videoStudio: !existing.modules.videoStudio },
  };
  writeFileSync(path, `${JSON.stringify(external, null, 2)}\n`);

  const rejected = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/profiles/enterprise-b') &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  expect((await rejected).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('请刷新后重试');
  await expect(page.getByRole('checkbox', { name: '图片生成', exact: true })).toBeChecked({
    checked: !existing.modules.imageStudio,
  });
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(external);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重新加载已保存配置', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '图片生成', exact: true })).toBeChecked({
    checked: existing.modules.imageStudio,
  });
  await expect(page.getByRole('checkbox', { name: '视频生成', exact: true })).toBeChecked({
    checked: external.modules.videoStudio,
  });
  await expect(page.getByRole('button', { name: '保存配置', exact: true })).toBeEnabled();
});

test('可视化新建配置、一键真实构建、预览与下载均对应本次配置快照', async ({
  page,
  context,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  await page.goto('/');
  await page.getByRole('combobox', { name: '企业配置', exact: true }).selectOption('__new__');
  await page.getByRole('textbox', { name: /^企业标识/ }).fill(profileId);
  await page.getByRole('checkbox', { name: '模型广场', exact: true }).check();
  await page.getByRole('checkbox', { name: '智能对话', exact: true }).check();
  await page.getByRole('combobox', { name: /^默认页面/ }).selectOption('chat');
  await page.getByRole('combobox', { name: /^构建环境/ }).selectOption('production');
  const started = page.waitForResponse(
    (response) => response.url().endsWith('/api/builds') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '保存并构建', exact: true }).click();
  const response = await started;
  expect(response.ok()).toBe(true);
  const { entry, job } = (await response.json()) as StartBuildResponse;
  jobs.add(job.id);
  expect(entry.profile.id).toBe(profileId);
  expect(entry.profile.modules).toEqual({
    modelCatalog: true,
    chat: true,
    imageStudio: false,
    videoStudio: false,
  });
  await expect(page.getByTestId('build-result')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('build-log')).toContainText('vite');

  const previewOpened = context.waitForEvent('page');
  await page.getByRole('link', { name: '预览构建结果', exact: true }).click();
  const preview = await previewOpened;
  preview.on('pageerror', (error) => runtimeErrors.push(error.message));
  await expect(preview).toHaveURL(/\/chat$/);
  await expect(preview.getByTestId('chat-page')).toBeVisible();
  await expect(
    preview
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '图片生成', exact: true }),
  ).toHaveCount(0);
  await expect(
    preview
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '视频生成', exact: true }),
  ).toHaveCount(0);
  const recordResponse = await preview.request.get(
    new URL('/release-record.json', preview.url()).href,
  );
  expect(recordResponse.ok()).toBe(true);
  const previewRecord = parseReleaseRecord(await recordResponse.json());
  expect(previewRecord.profile).toEqual(entry.profile);
  expect(previewRecord.environment).toBe('production');
  expect(previewRecord.enabledModules).toEqual(['modelCatalog', 'chat']);
  await preview.goto(new URL('/playground/image', preview.url()).href);
  await expect(preview.getByTestId('route-not-found')).toBeVisible();

  const downloaded = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载交付包', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toContain(`${profileId}-production-`);
  const packagePath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(packagePath);
  const inventory = execFileSync('tar', ['-tzf', packagePath], { encoding: 'utf8' });
  expect(inventory).toContain('./index.html');
  expect(inventory).toContain('./assets/');
  expect(inventory).toContain('./release-record.json');
  expect(inventory).not.toMatch(/config\/profiles|build-console/u);
  const packageRecord = parseReleaseRecord(
    JSON.parse(
      execFileSync('tar', ['-xOf', packagePath, './release-record.json'], { encoding: 'utf8' }),
    ),
  );
  expect(packageRecord.profile).toEqual(entry.profile);
  expect(packageRecord.artifactDigest).toBe(previewRecord.artifactDigest);
  expect(packageRecord.buildId).toBe(previewRecord.buildId);
  // Saving a later configuration must not change an already completed build.
  await page.getByRole('checkbox', { name: '图片生成', exact: true }).check();
  const saved = page.waitForResponse(
    (saveResponse) =>
      saveResponse.url().endsWith(`/api/profiles/${profileId}`) &&
      saveResponse.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: '保存配置', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await preview.reload();
  await expect(preview.getByTestId('route-not-found')).toBeVisible();
  const immutableRecord = parseReleaseRecord(
    await (await preview.request.get(new URL('/release-record.json', preview.url()).href)).json(),
  );
  expect(immutableRecord.profile.modules.imageStudio).toBe(false);
  expect(immutableRecord.artifactDigest).toBe(packageRecord.artifactDigest);
  expect(runtimeErrors).toEqual([]);
});

test('配置页在窄屏仍可操作且无横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('console-form')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '企业配置', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存并构建', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
