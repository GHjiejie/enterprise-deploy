import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'billing-recharge',
  service: 'resource-pay',
  title: '账户充值',
  description: '使用微信支付为账户余额充值。',
  button: '确认充值',
  message: '已成功充值 {{amount}} 元。',
  fields: [
    {
      key: 'amount',
      label: '充值金额（元）',
      initial: '100',
      type: 'number',
      pattern: '^(?:[1-9][0-9]*)(?:[.][0-9]{1,2})?$',
      hint: '请输入大于零的金额，最多两位小数。',
    },
  ],
} satisfies MockActionSpec;
