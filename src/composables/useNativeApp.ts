/**
 * Historical entry point of the platform constants: they live in
 * `config/platform`, which services import directly so that they do not
 * depend on `composables/`. Components and views keep importing from here.
 */
export { appPlatform, isNativeApp } from "../config/platform";
