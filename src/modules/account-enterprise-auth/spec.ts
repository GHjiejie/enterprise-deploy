import type { MockActionSpec } from '../../contracts/mock';
export const spec = {
  id: 'account-enterprise-auth',
  service: 'resource-cloudauth',
  title: '企业认证',
  description: '验证企业主体与法定代表人身份。',
  button: '开始人脸核验',
  message: '企业认证已通过。',
  fields: [
    { key: 'company', label: '企业名称', initial: '', type: 'text' },
    {
      key: 'credit',
      label: '统一社会信用代码',
      initial: '',
      type: 'text',
      pattern: '^[A-Z0-9]{18}$',
      hint: '请输入 18 位统一社会信用代码。',
    },
    { key: 'name', label: '法定代表人姓名', initial: '', type: 'text' },
  ],
} satisfies MockActionSpec;
