/**
 * Main library exports for the Playwright automation tools
 */

// Email verification module exports
export {
  getSlackVerificationCode,
  extractCodeFromMessage,
  getEmailBody,
  getSubject,
  searchEmails,
  type EmailMessage,
  type VerificationCodeConfig,
  type GmailConfig,
  type EmailSearchQuery
} from "./email-verification/index.js";

// Slack interaction exports
export {
  handleSlackLoginFlow,
  waitForVerificationPageAndGetCode,
  enterSlackCode,
  clickWorkspace
} from "./getSlackCode.js";

// Captcha solving exports
export {
  CapsolverProvider,
  createCapsolverProvider,
  SolveCaptchaProvider,
  createSolveCaptchaProvider,
  type CaptchaTaskConfig,
  type CapsolverConfig,
  type SolveCaptchaConfig,
  type CaptchaProvider,
  type CaptchaSolution
} from "./captcha/index.js";

// ReCaptcha utilities exports
export { findWorkingRecaptchaCallback } from "./findWorkingRecaptchaCallback.js";
export { findTokenSubmissionCallback } from "./findTokenSubmissionCallback.js";
export { injectTokenIntoGrecaptcha } from "./injectTokenIntoGrecaptcha.js";
export {
  findAllClientIds,
  getActiveClientId,
  debugClientStructure
} from "./findClientIds.js";
