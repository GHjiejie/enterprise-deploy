import type { ModuleDefinition } from '../../shared/module-definition.ts';

export interface UserAccess {
  readonly authenticated: boolean;
  readonly permissions: readonly string[];
}

/** Adapt the authenticated user's server-provided permissions at this boundary. */
export function canViewModule(module: ModuleDefinition, access: UserAccess): boolean {
  return (
    access.authenticated &&
    (access.permissions.includes('*') || access.permissions.includes(module.viewPermission))
  );
}

/** Explicit demo identities; replace with verified identity data in an integration. */
export const DEMO_ACCESS = {
  admin: { authenticated: true, permissions: ['*'] },
  member: {
    authenticated: true,
    permissions: ['modelCatalog.view', 'chat.view', 'imageStudio.view', 'videoStudio.view'],
  },
  chatOnly: { authenticated: true, permissions: ['chat.view'] },
  noAccess: { authenticated: true, permissions: [] },
  anonymous: { authenticated: false, permissions: [] },
} as const satisfies Record<string, UserAccess>;
