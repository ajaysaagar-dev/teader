export interface TeaderDesktopAPI {
  isDesktop: boolean;
  version: string;
  appVersion: string;
  platform: string;
  electronVersion: string;
  getVersion?: () => Promise<string>;
  getGpuInfo?: () => Promise<{
    available: boolean;
    gpuInfo?: any;
    featureStatus?: any;
    isHardwareAccelerated?: boolean;
    webgpu?: string;
    platform?: string;
    error?: string;
  }>;
  downloadAndInstallUpdate?: (url?: string) => Promise<{ success: boolean; path: string }>;
  onUpdateProgress?: (callback: (progress: { percent: number; receivedBytes: number; totalBytes: number }) => void) => () => void;
}

export interface ElectronWindowAPI {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  retryLoad: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
}

export interface ElectronAPI {
  getVersion: () => Promise<string>;
  minimize: () => void;
  maximize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (isMax: boolean) => void) => () => void;
}

declare global {
  interface Window {
    teaderDesktop?: TeaderDesktopAPI;
    electronWindow?: ElectronWindowAPI;
    electron?: ElectronAPI;
  }
}
