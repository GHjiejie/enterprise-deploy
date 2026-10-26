/** Console-only presentation metadata; never imported by the business app. */
export const externalLabels: Readonly<Record<string, { title: string; description: string }>> = {
  'resource-sms': {
    title: '阿里云短信（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-captcha': {
    title: '阿里云 Captcha 2.0（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-cloudauth': {
    title: '阿里云 CloudAuth（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-wechat': {
    title: '微信开放平台（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-pay': {
    title: '微信支付（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-wecom': {
    title: '企业微信（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-smtp': {
    title: '腾讯企业邮 SMTP（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-oss': {
    title: '阿里云 OSS（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-feishu': {
    title: '飞书开放平台与多维表格（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  'resource-hermes': {
    title: '智能运维助手（Mock）',
    description: '外部资源 · 本地模拟服务、回执和专属图标；关闭时连同依赖功能一起裁剪。',
  },
  access: {
    title: '登录与注册',
    description: '体验当前企业保留的登录、注册与密码找回方式。 外部调用全部使用 Mock。',
  },
  account: {
    title: '账号与认证',
    description: '管理身份认证、账号绑定和账号安全。 外部调用全部使用 Mock。',
  },
  billing: {
    title: '充值与账单',
    description: '体验充值、退款、交易对账单与发票文件。 外部调用全部使用 Mock。',
  },
  media: {
    title: '文件与媒体',
    description: '体验生成图片、视频和导出文件。 外部调用全部使用 Mock。',
  },
  operations: {
    title: '运维与协作',
    description: '体验后台验证、审批、通知、反馈与智能运维。 外部调用全部使用 Mock。',
  },
  'access-sms-login': {
    title: '短信登录',
    description: '使用演示手机号码获取短信验证码。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'access-sms-register': {
    title: '手机注册',
    description: '模拟注册验证，不创建真实账号。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'access-sms-recover': {
    title: '找回密码',
    description: '模拟短信验证找回密码。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'account-sms-mobile': {
    title: '换绑手机',
    description: '模拟验证并换绑手机号码。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'account-sms-close': {
    title: '注销验证',
    description: '仅演示注销验证结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'access-captcha': {
    title: '登录人机验证',
    description: '模拟 Captcha 2.0 验证结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'account-personal-auth': {
    title: '个人实名',
    description: '使用演示姓名与模拟证件标识体验实名结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'account-enterprise-auth': {
    title: '企业人脸认证',
    description: '模拟企业认证中的人脸核验。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'access-wechat-login': {
    title: '微信扫码登录',
    description: '演示扫码确认后的登录结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'account-wechat-bind': {
    title: '微信账号绑定',
    description: '演示微信账号的绑定结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'billing-recharge': {
    title: '微信充值',
    description: '模拟创建充值交易。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'billing-refund': {
    title: '微信退款',
    description: '模拟对演示交易进行退款。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'billing-statement': {
    title: '交易对账单',
    description: '查询本地演示对账数据。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-wecom-approval': {
    title: '后台审批',
    description: '模拟企业微信审批提交与回执。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-wecom-login': {
    title: '后台扫码登录',
    description: '模拟企业微信后台扫码登录。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-wecom-password': {
    title: '二次认证改密',
    description: '模拟二次验证通过后的改密结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-email-notify': {
    title: '邮件通知',
    description: '模拟发送通知，不发送真实邮件。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'account-email-bind': {
    title: '邮箱绑定',
    description: '模拟邮箱验证与绑定。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'account-avatar': {
    title: '头像上传',
    description: '使用模拟文件名体验头像上传结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'media-image': {
    title: '生成图片',
    description: '模拟保存生成图片的结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'media-video': {
    title: '生成视频',
    description: '模拟保存生成视频的结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'media-export': {
    title: '导出文件',
    description: '模拟导出文件的生成结果。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'billing-invoice': {
    title: '发票文件',
    description: '模拟获取已生成的发票文件。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-feedback': {
    title: '客户反馈表单',
    description: '模拟提交反馈到多维表格。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-ticket': {
    title: '工单同步',
    description: '模拟同步工单到多维表格。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-hermes-chat': {
    title: 'Hermes 运维交互',
    description: '模拟通过飞书提交运维指令。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-alert': {
    title: '运维告警',
    description: '模拟发送飞书告警消息。 表单、校验和模拟结果随功能独立裁剪。',
  },
  'operations-model': {
    title: 'Hermes 模型调用',
    description: '模拟运维 Agent 的模型响应。 表单、校验和模拟结果随功能独立裁剪。',
  },
  company: {
    title: '主体与品牌',
    description: 'Mock 主体信息 · 登录页、页脚、示例代码和邮件模板。',
  },
};
