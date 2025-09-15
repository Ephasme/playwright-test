/**
 * Captcha Provider Exports
 * This file provides a centralized way to access all captcha providers
 */

// Re-export Capsolver provider
export { 
  CapsolverProvider,
  createCapsolverProvider,
  type CapsolverConfig 
} from "./capsolver-provider.js";

// Re-export SolveCaptcha provider
export {
  SolveCaptchaProvider,
  createSolveCaptchaProvider,
  type SolveCaptchaConfig
} from "./solvecaptcha-provider.js";

// Re-export the base interfaces
export * from "../types.js";
