import type { BuildProfile, ModuleId } from '../../shared/build-profile.ts';

declare const __BUILD_PROFILE__: BuildProfile;

const injectedProfile = __BUILD_PROFILE__;

export const buildProfile: BuildProfile = Object.freeze({
  ...injectedProfile,
  modules: Object.freeze({ ...injectedProfile.modules }),
});

export function isModuleEnabled(moduleId: ModuleId): boolean {
  return buildProfile.modules[moduleId] === true;
}
