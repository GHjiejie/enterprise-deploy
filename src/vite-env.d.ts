/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
declare const __BUILD_MODE__: import('../shared/build-profile.ts').BuildMode;

declare module 'virtual:enterprise-modules' {
  export const activeRegistry: import('./app/active-module-types.ts').ActiveModuleAssembly['activeRegistry'];
  export const pageLoaders: import('./app/active-module-types.ts').ActiveModuleAssembly['pageLoaders'];
  export const activatorLoaders: import('./app/active-module-types.ts').ActiveModuleAssembly['activatorLoaders'];
  export const activeModuleIds: import('./app/active-module-types.ts').ActiveModuleAssembly['activeModuleIds'];
}
