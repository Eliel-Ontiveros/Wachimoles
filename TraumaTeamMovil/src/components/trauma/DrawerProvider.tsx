import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { DrawerContext } from './drawer-context';
import { HexDrawer } from './HexDrawer';

/** Envuelve la app y monta el drawer hexagonal encima de las pantallas. */
export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);

  return (
    <DrawerContext.Provider value={value}>
      {/* style (no className) para que el layout nunca colapse a altura 0 */}
      <View style={{ flex: 1 }}>
        {children}
        <HexDrawer />
      </View>
    </DrawerContext.Provider>
  );
}

