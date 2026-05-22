// HamburgerContext — KAN-76
//
// Global open/close state for the hamburger slide-in panel. Provider
// wraps the App root INSIDE AuthProvider but OUTSIDE NavigationContainer
// — that way the panel (mounted alongside NavigationContainer) can read
// `isOpen` from this context and dispatch close from the panel itself,
// while top-bar triggers in any tab call `open()`.
//
// One global source of truth for the panel state — Hamburger triggers
// on Home / The Church / Persecuted / Prayer Wall / Connect all dispatch
// the same `open()`; the panel is a single mounted component.

import React, { createContext, useCallback, useContext, useState } from 'react';

interface HamburgerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const HamburgerContext = createContext<HamburgerState>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function HamburgerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return (
    <HamburgerContext.Provider value={{ isOpen, open, close }}>
      {children}
    </HamburgerContext.Provider>
  );
}

export function useHamburger(): HamburgerState {
  return useContext(HamburgerContext);
}
