import { Link } from 'react-router-dom';
import type { ModuleId } from '../../shared/build-profile.ts';
import { activeRegistry } from '../app/active-modules.ts';
import { useAccess } from '../app/page-context.tsx';
import { buildProfile } from '../platform/features.ts';
import { getModuleHref } from '../platform/navigation-service.ts';

export function ModuleLink({
  moduleId,
  children,
  className = 'button',
}: {
  moduleId: ModuleId;
  children: React.ReactNode;
  className?: string;
}) {
  const access = useAccess();
  const href = getModuleHref(moduleId, buildProfile, access, activeRegistry);
  return href ? (
    <Link className={className} to={href}>
      {children}
    </Link>
  ) : null;
}
