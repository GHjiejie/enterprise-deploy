import { createContext, useContext } from 'react';
import type { UserAccess } from '../platform/permissions.ts';

export const AccessContext = createContext<UserAccess>({ authenticated: false, permissions: [] });
export const useAccess = () => useContext(AccessContext);
export const PageParamsContext = createContext<Readonly<Record<string, string>>>({});
export const usePageParams = () => useContext(PageParamsContext);
