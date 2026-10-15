import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BuildProfile } from '../shared/build-profile.ts';
import { validateModuleAssembly } from '../src/app/module-registry.ts';
import { loadBuildProfile, resolveProfilesDirectory } from './load-profile.ts';

/** Every checked-in JSON profile is a supported delivery configuration. */
export function validateProfiles(
  profilesDir = resolveProfilesDirectory(),
): readonly BuildProfile[] {
  const profileIds = readdirSync(profilesDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();

  if (profileIds.length === 0) {
    throw new Error(`没有可校验的企业配置：${profilesDir}`);
  }

  return Object.freeze(
    profileIds.map((profileId) => {
      const profile = loadBuildProfile(profileId, profilesDir);
      validateModuleAssembly(profile);
      return profile;
    }),
  );
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    const profiles = validateProfiles();
    console.log(`企业配置与模块装配校验通过：${profiles.map(({ id }) => id).join(', ')}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
