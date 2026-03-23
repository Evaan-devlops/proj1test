//Collapsible left panel (chat history)
import { create } from "zustand";

type UiStore = {
  sidebarOpen: boolean;
  sidebarEverOpened: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  composerText: string;
  setComposerText: (text: string) => void;
  clearComposerText: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  sidebarOpen: true,
  sidebarEverOpened: true,
  toggleSidebar: () =>
    set((s) => {
      const nextOpen = !s.sidebarOpen;
      return {
        sidebarOpen: nextOpen,
        sidebarEverOpened: s.sidebarEverOpened || nextOpen,
      };
    }),
  setSidebarOpen: (open) =>
    set((s) => ({
      sidebarOpen: open,
      sidebarEverOpened: s.sidebarEverOpened || open,
    })),

  composerText: "",
  setComposerText: (text) => set({ composerText: text }),
  clearComposerText: () => set({ composerText: "" }),
}));
