import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'account-sms-close',
  service: 'resource-sms',
  title: '注销账号',
  description: '提交注销申请前，请确认账号中的业务已处理完毕。',
  button: '提交注销申请',
  message: '注销申请已提交，可在本次会话中继续体验其他功能。',
  fields: [
    {
      key: 'phone',
      label: '手机号码',
      initial: '13800000000',
      type: 'tel',
      pattern: '^1[0-9]{10}$',
    },
    {
      key: 'code',
      label: '短信验证码',
      initial: '',
      type: 'text',
      pattern: '^123456$',
      hint: '演示验证码为 123456。',
    },
  ],
} satisfies MockActionSpec;
