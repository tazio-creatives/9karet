import { createContext, useContext } from 'react';

interface SidebarContextValue {
  isCollapsed: boolean;
  collapseSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

// Lets a page reached via <Outlet /> (e.g. opening the Orders detail panel)
// collapse the shared AdminLayout sidebar for more room, without AdminLayout
// needing to know about that page's own interactions.
export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within AdminLayout');
  return ctx;
}
