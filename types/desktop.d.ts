export interface TeaderDesktopAPI {
  isDesktop: boolean;
  version: string;
  appVersion: string;
  platform: string;
  electronVersion: string;
  downloadAndInstallUpdate?: (url?: string) => Promise<{ success: boolean; path: string }>;
  onUpdateProgress?: (callback: (progress: { percent: number; receivedBytes: number; totalBytes: number }) => void) => () => void;
}

declare global {
  interface Window {
    teaderDesktop?: TeaderDesktopAPI;
    electronWindow?: {
      minimize: () => void;
      toggleMaximize: () => void;
      close: () => void;
      retryLoad: () => void;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
    };
  }
}
