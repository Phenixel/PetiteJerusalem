import { Capacitor } from "@capacitor/core";

/**
 * Detection of the runtime platform (web, or the native Capacitor app).
 *
 * Frozen at load: the platform never changes during the life of the app.
 * It is used to expose the native features (offline downloads, push
 * notifications, native auth) only in the mobile app, leaving the website
 * strictly unchanged.
 */
export const isNativeApp = Capacitor.isNativePlatform();

/** "web" | "ios" | "android" */
export const appPlatform = Capacitor.getPlatform();
