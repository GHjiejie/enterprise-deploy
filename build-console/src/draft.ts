import { MODULE_IDS } from '../../shared/build-profile.ts';
import type { BuildProfile, ModuleId } from '../../shared/build-profile.ts';
import type { ConsoleModule, ProfileEntry } from '../../shared/build-console.ts';

export interface ProfileDraft {
  readonly id: string;
  readonly modules: Readonly<Record<ModuleId, boolean>>;
  readonly defaultModule: ModuleId | '';
}

export function newDraft(): ProfileDraft {
  return {
    id: '',
    modules: { modelCatalog: false, chat: false, imageStudio: false, videoStudio: false },
    defaultModule: '',
  };
}

export function toProfile(draft: ProfileDraft): BuildProfile | null {
  if (!draft.defaultModule) return null;
  return { schemaVersion: 1, ...draft, defaultModule: draft.defaultModule };
}

export function draftMatchesProfile(draft: ProfileDraft, profile: BuildProfile): boolean {
  return (
    draft.id === profile.id &&
    draft.defaultModule === profile.defaultModule &&
    MODULE_IDS.every((id) => draft.modules[id] === profile.modules[id])
  );
}

export function validateDraft(
  draft: ProfileDraft,
  modules: readonly ConsoleModule[],
  profiles: readonly ProfileEntry[],
  isNew: boolean,
): readonly string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(draft.id)) {
    errors.push('企业标识需以小写字母开头，可包含小写字母、数字和短横线，最多 64 个字符。');
  } else if (isNew && profiles.some((entry) => entry.profile.id === draft.id)) {
    errors.push('该企业标识已存在，请选择已有配置或使用新的标识。');
  }
  if (!MODULE_IDS.some((id) => draft.modules[id])) errors.push('请至少启用一个模块。');
  if (!draft.defaultModule || !draft.modules[draft.defaultModule]) {
    errors.push('请选择一个已启用的模块作为默认页面。');
  }
  for (const module of modules) {
    if (!draft.modules[module.id]) continue;
    const missing = module.dependsOn.filter((id) => !draft.modules[id]);
    if (missing.length > 0) {
      const labels = missing.map((id) => modules.find((item) => item.id === id)?.label ?? id);
      errors.push(`${module.label}需要同时启用${labels.join('、')}。`);
    }
  }
  return errors;
}
