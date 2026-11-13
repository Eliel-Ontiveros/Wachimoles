import { createContext, useContext } from 'react';

export type DrawerCtx = { isOpen: boolean; open: () => void; close: () => void };

export const DrawerContext = createContext<DrawerCtx | null>(null);

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer debe usarse dentro de <DrawerProvider>');
  return ctx;
}

