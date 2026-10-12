// src/lib/legal.ts
// The public pages the backend serves for the Play listing (AUDIT B4). One place
// for the URLs so Settings, the account screen and the store listing agree.

import { openBrowserAsync } from 'expo-web-browser';
import { Linking } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const PRIVACY_URL = `${API_URL}/privacy`;
export const TERMS_URL = `${API_URL}/terms`;
export const DELETE_ACCOUNT_URL = `${API_URL}/delete-account`;

/** Open a legal page in the in-app browser, falling back to the system one. */
export async function openLegal(url: string): Promise<void> {
  try {
    await openBrowserAsync(url);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      // Nothing can open a URL on this device; there is no better fallback.
    }
  }
}
