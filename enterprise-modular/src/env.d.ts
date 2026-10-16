/// <reference types="vite/client" />
declare const __BUILD_INFO__: {
  readonly enterpriseId: string;
  readonly brandName: string;
  readonly modules: readonly string[];
  readonly mode: string;
  readonly releaseId: string;
};
declare module 'virtual:enterprise-modules' {
  const modules: readonly import('./contracts/feature').FeatureModule[];
  export default modules;
}
declare module 'virtual:enterprise-brand' {}
