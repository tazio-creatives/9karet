import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { AuthModal } from './AuthModal';

interface AuthModalContextValue {
  isOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

// Mounted once at the app root (see App.tsx) so any component — the header's
// Sign In link, or a guarded route like /checkout or /account/* — can pop
// the same login dialog on top of wherever the user currently is, instead
// of navigating to a separate /login page.
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const value = useMemo<AuthModalContextValue>(
    () => ({
      isOpen,
      openLoginModal: () => setIsOpen(true),
      closeLoginModal: () => setIsOpen(false),
    }),
    [isOpen],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      {isOpen && <AuthModal onClose={value.closeLoginModal} />}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within an AuthModalProvider');
  return ctx;
}
