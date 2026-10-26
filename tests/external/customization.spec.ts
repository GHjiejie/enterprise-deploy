import { expect, test, type Page } from '@playwright/test';
const full = 'http://127.0.0.1:5201';
const custom = 'http://127.0.0.1:5202';

async function phoneCode(page: Page): Promise<void> {
  await page.getByPlaceholder('请输入手机号码').fill('13800000000');
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(page.getByText('验证码已发送，演示验证码为 123456。')).toBeVisible();
  await page.getByPlaceholder('请输入验证码').fill('123456');
}
async function noDebugUI(page: Page): Promise<void> {
  await expect(page.getByText('模拟响应', { exact: true })).toHaveCount(0);
  await expect(page.locator('.mock-grid')).toHaveCount(0);
}

test('login is a standalone product page with integrated verification and a workspace transition', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== full) external.push(request.url());
  });
  await page.goto(full + '/access');
  await expect(page.getByRole('heading', { name: '登录', exact: true })).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '手机验证码登录' })).toBeVisible();
  await expect(page.getByRole('link', { name: '立即注册' })).toBeVisible();
  await noDebugUI(page);
  await phoneCode(page);
  await page.getByRole('button', { name: '登录工作台', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('安全验证');
  await page.getByRole('button', { name: '点击完成安全验证' }).click();
  await expect(page.getByRole('button', { name: '安全验证已通过' })).toBeVisible();
  await page.getByRole('button', { name: '登录工作台', exact: true }).click();
  await expect(page).toHaveURL(full + '/orders');
  await expect(page.getByRole('heading', { name: '订单管理', exact: true })).toBeVisible();
  expect(external).toEqual([]);
});

test('registration and password recovery have separate routes and complete phone flows', async ({
  page,
}) => {
  await page.goto(full + '/access');
  await page.getByRole('link', { name: '立即注册' }).click();
  await expect(page).toHaveURL(full + '/register');
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await phoneCode(page);
  await page.getByLabel('设置密码', { exact: true }).fill('password123');
  await page.getByRole('button', { name: '注册账号', exact: true }).click();
  await expect(page.getByRole('heading', { name: '注册成功' })).toBeVisible();
  await page.getByRole('link', { name: '前往登录' }).click();
  await page.getByRole('link', { name: '忘记密码？' }).click();
  await expect(page).toHaveURL(full + '/forgot-password');
  await phoneCode(page);
  await page.getByLabel('新密码', { exact: true }).fill('newpassword123');
  await page.getByLabel('确认新密码', { exact: true }).fill('newpassword123');
  await page.getByRole('button', { name: '重置密码', exact: true }).click();
  await expect(page.getByRole('heading', { name: '密码已重置' })).toBeVisible();
});

test('WeChat and administrator scan login use dedicated scan experiences', async ({ page }) => {
  await page.goto(full + '/access');
  await page.getByRole('tab', { name: '微信扫码登录' }).click();
  await expect(page.getByRole('img', { name: '微信登录演示二维码' })).toBeVisible();
  await expect(page.getByPlaceholder('请输入手机号码')).toHaveCount(0);
  await page.getByRole('button', { name: '我已在手机上确认' }).click();
  await expect(page).toHaveURL(full + '/orders');
  await page.goto(full + '/admin-login');
  await expect(page.getByRole('heading', { name: '管理后台登录' })).toBeVisible();
  await page.getByRole('button', { name: '我已在手机上确认' }).click();
  await expect(page).toHaveURL(full + '/operations');
});

test('account settings expose real security dialogs, avatar selection and separate certification pages', async ({
  page,
}) => {
  await page.goto(full + '/account');
  await expect(page.getByRole('heading', { name: '账号设置', exact: true })).toBeVisible();
  await noDebugUI(page);
  for (const scene of [
    {
      id: 'account-sms-mobile',
      button: '修改',
      values: [
        ['新手机号码', '13900000000'],
        ['短信验证码', '123456'],
      ],
      submit: '保存手机号码',
    },
    {
      id: 'account-email-bind',
      button: '绑定',
      values: [
        ['邮箱地址', 'demo@example.invalid'],
        ['邮箱验证码', '123456'],
      ],
      submit: '确认绑定',
    },
    {
      id: 'account-sms-close',
      button: '申请注销',
      values: [['短信验证码', '123456']],
      submit: '提交注销申请',
    },
  ]) {
    await page
      .locator(`[data-feature="${scene.id}"]`)
      .getByRole('button', { name: scene.button, exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    for (const [label, value] of scene.values)
      if (label && value) await dialog.getByLabel(label, { exact: false }).fill(value);
    await dialog.getByRole('button', { name: scene.submit, exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('操作成功');
    await dialog.getByRole('button', { name: '完成', exact: true }).click();
  }
  await page.getByRole('button', { name: '更换头像' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('选择头像')
    .setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNxkAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  await page.getByRole('button', { name: '保存头像', exact: true }).click();
  await expect(page.getByRole('img', { name: '个人头像', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '绑定微信', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认绑定' }).click();
  await expect(page.getByRole('button', { name: '已绑定', exact: true })).toBeDisabled();
  await page
    .locator('[data-feature="account-personal-auth"]')
    .getByRole('link', { name: /去认证/ })
    .click();
  await expect(page).toHaveURL(full + '/account/personal-auth');
  await page.getByLabel('真实姓名').fill('林晓');
  await page.getByLabel('身份证号码', { exact: false }).fill('110101199001011234');
  await page.getByRole('button', { name: '提交实名认证' }).click();
  await expect(page.getByRole('status')).toContainText('实名认证已通过');
  await page.goto(full + '/account/enterprise-auth');
  await page.getByLabel('企业名称', { exact: true }).fill('演示科技有限公司');
  await page.getByLabel('统一社会信用代码', { exact: false }).fill('91310000123456789X');
  await page.getByLabel('法定代表人姓名').fill('林晓');
  await page.getByRole('button', { name: '下一步，人脸核验' }).click();
  await page.getByRole('button', { name: '开始人脸核验', exact: true }).click();
  await expect(page.getByRole('heading', { name: '企业认证已通过' })).toBeVisible();
});

test('billing follows recharge, scan payment, transaction refund, statement and invoice workflows', async ({
  page,
}) => {
  await page.goto(full + '/billing');
  await page.getByRole('button', { name: '账户充值', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('充值金额（元）').fill('125.50');
  await dialog.getByRole('button', { name: '下一步，扫码支付' }).click();
  await expect(dialog.getByRole('img', { name: '微信支付演示二维码' })).toBeVisible();
  await dialog.getByRole('button', { name: '我已完成支付' }).click();
  await expect(dialog.getByRole('heading', { name: '充值成功' })).toBeVisible();
  await dialog.getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.locator('.billing-balance')).toContainText('1,405.50');
  await page
    .getByRole('row')
    .filter({ hasText: 'TX20261026001' })
    .getByRole('button', { name: '申请退款' })
    .click();
  await page.getByRole('dialog').getByLabel('退款原因').fill('重复充值');
  await page.getByRole('button', { name: '确认退款', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '完成', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'TX20261026001' })).toContainText('已退款');
  await page.getByRole('button', { name: '下载对账单', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 CSV' }).click();
  expect((await download).suggestedFilename()).toContain('交易对账单');
  await page.getByRole('dialog').press('Escape');
  await page.getByRole('button', { name: '查看发票', exact: true }).click();
  await expect(page.locator('.invoice-paper')).toContainText('信息技术服务');
});

test('creative studio generates previews, playable video and downloadable file exports', async ({
  page,
}) => {
  await page.goto(full + '/media');
  await page.getByLabel('画面描述').fill('日落时分的海岸');
  await page.getByRole('button', { name: '生成图片', exact: true }).click();
  await expect(page.getByRole('img', { name: '生成的海岸日落图片' })).toBeVisible();
  await page.getByRole('tab', { name: '视频创作' }).click();
  await page.getByLabel('视频描述').fill('缓慢移动的海面波纹');
  await page.getByRole('button', { name: '生成视频', exact: true }).click();
  await expect(page.locator('video')).toHaveAttribute('src', /^blob:/);
  await expect(page.getByRole('status')).toContainText('视频已生成');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出文件', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('文件列表.csv');
  await expect(page.locator('.studio-file-list li')).toHaveCount(2);
});

test('support, management security, notifications and assistant use their business contexts', async ({
  page,
}) => {
  await page.goto(full + '/operations');
  await page.getByRole('button', { name: '同步工单', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('工单已同步');
  await page.getByRole('link', { name: /提交反馈/ }).click();
  await page.getByLabel('问题描述').fill('希望优化账单筛选体验');
  await page.getByLabel('联系邮箱').fill('demo@example.invalid');
  await page.getByRole('button', { name: '提交反馈', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('感谢你的反馈');
  await page.goto(full + '/operations');
  await page.getByRole('tab', { name: '管理安全' }).click();
  await page.getByRole('link', { name: /前往审批/ }).click();
  await page.getByLabel('申请事项').fill('更新告警阈值');
  await page.getByLabel('申请说明').fill('调整高峰时段阈值');
  await page.getByRole('button', { name: '提交审批', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('审批申请已提交');
  await page.goto(full + '/operations');
  await page.getByRole('tab', { name: '管理安全' }).click();
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  let modal = page.getByRole('dialog');
  await modal.getByLabel('当前密码').fill('oldpassword');
  await modal.getByLabel('新密码', { exact: false }).fill('newpassword123');
  await modal.getByLabel('二次验证码', { exact: false }).fill('654321');
  await modal.getByRole('button', { name: '确认修改' }).click();
  await modal.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('tab', { name: '通知与告警' }).click();
  for (const scene of [
    {
      button: '发送通知',
      fields: [
        ['收件邮箱', 'demo@example.invalid'],
        ['邮件主题', '服务状态通知'],
        ['邮件内容', '当前服务运行正常。'],
      ],
      submit: '发送通知',
    },
    { button: '发送指令', fields: [['运维指令', '查看当前服务状态']], submit: '发送指令' },
    { button: '测试通知', fields: [], submit: '发送测试通知' },
  ]) {
    await page.getByRole('button', { name: scene.button, exact: true }).click();
    modal = page.getByRole('dialog');
    for (const [label, value] of scene.fields)
      if (label && value) await modal.getByLabel(label).fill(value);
    await modal.getByRole('button', { name: scene.submit, exact: true }).click();
    await expect(modal.getByRole('status')).toContainText('操作成功');
    await modal.getByRole('button', { name: '完成', exact: true }).click();
  }
  await page.getByRole('tab', { name: '智能助手' }).click();
  await page.getByRole('button', { name: /查看当前服务状态/ }).click();
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.assistant-message.assistant')).toContainText('99.98%');
});

test('custom delivery removes routes and controls while retaining shared-service business flows', async ({
  page,
  request,
}) => {
  await page.goto(custom + '/access');
  await expect(page.locator('.sidebar')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '立即注册' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '忘记密码？' })).toHaveCount(0);
  await expect(page.locator('[data-mock-company]')).toHaveCount(0);
  await noDebugUI(page);
  await phoneCode(page);
  await page.getByRole('button', { name: '登录工作台' }).click();
  await expect(page).toHaveURL(custom + '/account');
  await expect(page.locator('[data-feature="account-enterprise-auth"]')).toBeVisible();
  await expect(page.locator('[data-feature="account-personal-auth"]')).toHaveCount(0);
  await page.goto(custom + '/billing');
  await expect(page.getByRole('button', { name: '账户充值', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '申请退款' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '下载对账单' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看发票' })).toHaveCount(0);
  await page.goto(custom + '/operations');
  await expect(page.getByRole('tab', { name: '客户支持' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '管理安全' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: '智能助手' })).toBeVisible();
  for (const path of [
    '/register',
    '/forgot-password',
    '/account/personal-auth',
    '/operations/feedback',
    '/admin-login',
    '/media',
    '/company',
  ]) {
    await page.goto(custom + path);
    await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
  }
  await page.goto(full + '/access');
  await page.getByRole('tab', { name: '微信扫码登录' }).click();
  const src = await page.getByRole('img', { name: '微信登录演示二维码' }).getAttribute('src');
  expect((await request.get(custom + src)).status()).toBe(404);
});

test('service failures and empty data remain recoverable without debug controls in the product', async ({
  page,
}) => {
  await page.goto(custom + '/access');
  await page.getByPlaceholder('请输入手机号码').fill('123');
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('11 位');
  await page.getByPlaceholder('请输入手机号码').fill('13800000000');
  await page.evaluate(() => sessionStorage.setItem('enterprise:mock:access-sms-login', 'failure'));
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('请求暂时失败');
  await expect(page.getByPlaceholder('请输入手机号码')).toHaveValue('13800000000');
  await page.evaluate(() => sessionStorage.removeItem('enterprise:mock:access-sms-login'));
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('验证码已发送');
  await page.goto(custom + '/billing');
  await page.evaluate(() => sessionStorage.setItem('enterprise:mock:billing-statement', 'empty'));
  await page.getByRole('button', { name: '下载对账单' }).click();
  await page.getByRole('button', { name: '下载 CSV' }).click();
  await expect(page.getByRole('status')).toContainText('没有交易对账数据');
  await page.getByRole('dialog').press('Escape');
  await page.getByLabel('演示权限').selectOption('none');
  await expect(page.getByRole('heading', { name: '没有访问权限' })).toBeVisible();
  await noDebugUI(page);
});

test('standalone login and workspace pages fit desktop and 390px and preserve company placement', async ({
  page,
}, info) => {
  for (const [name, base] of [
    ['full', full],
    ['custom', custom],
  ]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/access');
    await expect(page.getByRole('button', { name: '登录工作台' })).toBeVisible();
    if (name === 'full') await expect(page.locator('[data-mock-company="login"]')).toBeVisible();
    await page.screenshot({ path: info.outputPath(name + '-access-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.screenshot({ path: info.outputPath(name + '-access-mobile.png'), fullPage: true });
    for (const path of ['/account', '/billing', '/operations']) {
      await page.goto(base + path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (path === '/account') {
        const avatar = await page.locator('.product-avatar').first().boundingBox();
        expect(avatar).toBeTruthy();
        if (avatar) expect(Math.abs(avatar.width - avatar.height)).toBeLessThan(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
    }
  }
  await page.goto(full + '/company');
  await expect(page.getByRole('heading', { name: '示例代码' })).toBeVisible();
  await expect(page.locator('pre').last()).toContainText(
    'https://enterprise-a.example.invalid/docs',
  );
});
