//Collapsible left panel (chat history)
import { create } from "zustand";

export type AppView = "chat" | "analytics";
export type AppLayoutMode = "single" | "split" | "float";

type UiStore = {
  activeView: AppView;
  layoutMode: AppLayoutMode;
  primaryView: AppView;
  splitRatio: number;
  floatRatio: number;
  openSingleView: (view: AppView) => void;
  openSplitView: (currentView: AppView) => void;
  openFloatView: (currentView: AppView) => void;
  setSplitRatio: (ratio: number) => void;
  setFloatRatio: (ratio: number) => void;

  sidebarOpen: boolean;
  sidebarEverOpened: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  composerText: string;
  composerFocusNonce: number;
  setComposerText: (text: string) => void;
  clearComposerText: () => void;
  requestComposerFocus: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  activeView: "chat",
  layoutMode: "single",
  primaryView: "chat",
  splitRatio: 0.5,
  floatRatio: 0.42,
  openSingleView: (view) =>
    set({
      activeView: view,
      primaryView: view,
      layoutMode: "single",
    }),
  openSplitView: (currentView) =>
    set({
      activeView: currentView,
      primaryView: currentView,
      layoutMode: "split",
    }),
  openFloatView: (currentView) =>
    set({
      activeView: currentView,
      primaryView: currentView,
      layoutMode: "float",
    }),
  setSplitRatio: (ratio) =>
    set({
      splitRatio: Math.max(0.3, Math.min(0.7, ratio)),
    }),
  setFloatRatio: (ratio) =>
    set({
      floatRatio: Math.max(0.28, Math.min(0.72, ratio)),
    }),

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
  composerFocusNonce: 0,
  setComposerText: (text) => set({ composerText: text }),
  clearComposerText: () => set({ composerText: "" }),
  requestComposerFocus: () =>
    set((state) => ({
      composerFocusNonce: state.composerFocusNonce + 1,
    })),
}));
