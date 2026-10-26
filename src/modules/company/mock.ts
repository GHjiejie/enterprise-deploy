import logo from './assets/logo.svg';

export const company = Object.freeze({
  brand: __BUILD_INFO__.brandName,
  filing: 'MOCK 备案号 20260001（演示）',
  domain: `${__BUILD_INFO__.enterpriseId}.example.invalid`,
  docs: `https://${__BUILD_INFO__.enterpriseId}.example.invalid/docs`,
  logo,
});
