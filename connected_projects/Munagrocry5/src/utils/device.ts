import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
export { useSmartBackButton, useSmartBackButton as useHardwareBackButton } from './backButton';

/**
 * Detect if running inside the native Capacitor Android container
 */
export const isNativeAndroidApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Configure Android status bar styling (Dark navy background #0c2340 with light icons)
 */
export const initStatusBar = async () => {
  if (isNativeAndroidApp()) {
    try {
      await StatusBar.setBackgroundColor({ color: '#0c2340' });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (e) {
      console.warn('Status bar styling unavailable:', e);
    }
  }
};
