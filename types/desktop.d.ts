export interface TeaderDesktopAPI {
  isDesktop: boolean;
  version: string;
  appVersion: string;
  platform: string;
  electronVersion: string;
}

declare global {
  interface Window {
    teaderDesktop?: TeaderDesktopAPI;
  }
}
