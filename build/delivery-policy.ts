import { MODULE_IDS, type BuildMode, type ModuleId } from '../shared/build-profile.ts';

/** Supplied by the trusted deployment target, never read from the submitted artifact. */
export interface DeliveryPolicy {
  schemaVersion: 1;
  profileId: string;
  environment: BuildMode;
  allowedModules: ModuleId[];
  minReleaseSchemaVersion: 2;
  allowedPruningRules: Array<{
    checkerVersion: string;
    ownershipPolicyVersion: number;
    ownershipPolicyDigest: string;
  }>;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, expected: string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort()))
    throw new Error(`${label} has missing or unknown fields`);
}

export function parseDeliveryPolicy(value: unknown): DeliveryPolicy {
  const data = object(value, 'Delivery policy');
  keys(
    data,
    [
      'schemaVersion',
      'profileId',
      'environment',
      'allowedModules',
      'minReleaseSchemaVersion',
      'allowedPruningRules',
    ],
    'Delivery policy',
  );
  if (data.schemaVersion !== 1 || data.minReleaseSchemaVersion !== 2)
    throw new Error('Delivery policy requires release schema version 2');
  if (
    typeof data.profileId !== 'string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u.test(data.profileId)
  )
    throw new Error('Delivery policy profileId must be a safe identifier');
  if (!['development', 'staging', 'production'].includes(data.environment as string))
    throw new Error('Delivery policy environment is invalid');
  if (
    !Array.isArray(data.allowedModules) ||
    data.allowedModules.length === 0 ||
    data.allowedModules.some((id) => !MODULE_IDS.includes(id as ModuleId)) ||
    new Set(data.allowedModules).size !== data.allowedModules.length
  )
    throw new Error('Delivery policy allowedModules must contain unique known modules');
  if (!Array.isArray(data.allowedPruningRules) || data.allowedPruningRules.length === 0)
    throw new Error('Delivery policy must explicitly allow pruning rules');
  const rules = data.allowedPruningRules.map((item) => {
    const rule = object(item, 'Allowed pruning rule');
    keys(
      rule,
      ['checkerVersion', 'ownershipPolicyVersion', 'ownershipPolicyDigest'],
      'Allowed pruning rule',
    );
    if (
      typeof rule.checkerVersion !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/u.test(rule.checkerVersion)
    )
      throw new Error('Allowed pruning checker version is invalid');
    if (
      !Number.isSafeInteger(rule.ownershipPolicyVersion) ||
      (rule.ownershipPolicyVersion as number) < 1
    )
      throw new Error('Allowed ownership policy version is invalid');
    if (
      typeof rule.ownershipPolicyDigest !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(rule.ownershipPolicyDigest)
    )
      throw new Error('Allowed ownership policy digest is invalid');
    return {
      checkerVersion: rule.checkerVersion,
      ownershipPolicyVersion: rule.ownershipPolicyVersion as number,
      ownershipPolicyDigest: rule.ownershipPolicyDigest,
    };
  });
  if (new Set(rules.map((rule) => JSON.stringify(rule))).size !== rules.length)
    throw new Error('Delivery policy pruning rules must be unique');
  return {
    schemaVersion: 1,
    profileId: data.profileId,
    environment: data.environment as BuildMode,
    allowedModules: MODULE_IDS.filter((id) => (data.allowedModules as string[]).includes(id)),
    minReleaseSchemaVersion: 2,
    allowedPruningRules: rules,
  };
}
