// External library imports
import { chromium } from "playwright";
import env from "env-var";

// Internal module imports
import { findWorkingRecaptchaCallback } from "./findWorkingRecaptchaCallback.js";
import { findTokenSubmissionCallback } from "./findTokenSubmissionCallback.js";
import { injectTokenIntoGrecaptcha } from "./injectTokenIntoGrecaptcha.js";
import {
  findAllClientIds,
  getActiveClientId,
  debugClientStructure,
} from "./findClientIds.js";
import {
  handleSlackLoginFlow,
  waitForVerificationPageAndGetCode,
  enterSlackCode,
  clickWorkspace,
} from "./getSlackCode.js";

// Captcha provider imports
import { 
  CapsolverProvider,
  createCapsolverProvider,
  SolveCaptchaProvider,
  createSolveCaptchaProvider
} from "./captcha/index.js";
import type { 
  CaptchaTaskConfig,
  CapsolverConfig,
  SolveCaptchaConfig
} from "./captcha/index.js";

// Configuration from environment variables
const SOLVECAPTCHA_KEY = env.get('SOLVECAPTCHA_API_KEY').required().asString();
const PAGE_URL = env.get('PAGE_URL').required().asString();
const SITE_KEY = env.get('SITE_KEY').required().asString();
const USER_EMAIL = env.get('USER_EMAIL').required().asString();

const browser = await chromium.launch();

const page = await browser.newPage();

page.on("console", (msg) => {
  console.log(`${msg.type().toUpperCase()}: ${msg.text()}`);
});

await page.goto("https://slack.com/");

await page.click("text=Sign in");

await page.fill("input[type='email']", USER_EMAIL);

await page.click(".p-get_started_email_form__button");

await page.waitForTimeout(5000);

const recaptchaCallback = await findWorkingRecaptchaCallback(page);
console.log("Recaptcha callback:", recaptchaCallback);

const tokenSubmissionCallback = await findTokenSubmissionCallback(page);
console.log("Token submission callback:", tokenSubmissionCallback);

// Create captcha provider instance

// Option 1: Using Capsolver (current)
 const solveCaptchaConfig: SolveCaptchaConfig = {
   apiKey: SOLVECAPTCHA_KEY,
 };
const captchaProvider = new SolveCaptchaProvider(solveCaptchaConfig);
// Or alternatively: const captchaProvider = createCapsolverProvider(capsolverConfig);

// Option 2: Using SolveCaptcha (alternative)
// const captchaProvider = new SolveCaptchaProvider(solveCaptchaConfig);
// Or alternatively: const captchaProvider = createSolveCaptchaProvider(solveCaptchaConfig);

// Configure captcha task
const taskConfig: CaptchaTaskConfig = {
  type: "ReCaptchaV2Task",
  websiteURL: PAGE_URL,
  websiteKey: SITE_KEY,
};

console.log(`Solving captcha using ${captchaProvider.name} provider...`);

// Solve the captcha using the provider
const solution = await captchaProvider.solveCaptcha(taskConfig, {
  maxAttempts: 60, // 5 minutes with 5s intervals
  pollInterval: 5000, // 5 seconds
});

console.log("Captcha solved successfully!");

if (!solution.gRecaptchaResponse) {
  throw new Error("No gRecaptchaResponse found in the solution");
}

// Step 1: Find all available client IDs
console.log("🔍 Finding reCAPTCHA client IDs...");
const allClientIds = await findAllClientIds(page);
console.log("Found client IDs:", allClientIds);

// Step 2: Get the active client ID
const activeClientId = await getActiveClientId(page);
console.log("Active client ID:", activeClientId);

if (!activeClientId) {
  throw new Error("No active reCAPTCHA client found");
}

// Step 3: Debug the structure of the active client
console.log(`🔍 Debugging client ${activeClientId} structure...`);
await debugClientStructure(page, activeClientId);

// Step 4: Use the comprehensive injection approach
const injectionSuccess = await injectTokenIntoGrecaptcha(
  page,
  solution.gRecaptchaResponse
);
console.log("Token injection successful:", injectionSuccess);

await page.evaluate(
  ({ token, clientId }: { token: string; clientId: string }) => {
    console.log(`🎯 Attempting to call callback on client ${clientId}`);

    try {
      const config = (window as any).___grecaptcha_cfg;
      const client = config.clients[clientId];

      if (!client) {
        console.error(`Client ${clientId} not found`);
        return;
      }

      // Try different callback paths
      let func = null;
      let callbackPath = "";

      // Path 1: client.u.u.callback (your original path)
      if (client.u && client.u.u && client.u.u.callback) {
        func = client.u.u.callback;
        callbackPath = `clients.${clientId}.u.u.callback`;
      }
      // Path 2: client.callback (direct callback)
      else if (client.callback) {
        func = client.callback;
        callbackPath = `clients.${clientId}.callback`;
      }
      // Path 3: client.u.callback
      else if (client.u && client.u.callback) {
        func = client.u.callback;
        callbackPath = `clients.${clientId}.u.callback`;
      }
      // Path 4: client.i.callback
      else if (client.i && client.i.callback) {
        func = client.i.callback;
        callbackPath = `clients.${clientId}.i.callback`;
      }

      if (func && typeof func === "function") {
        console.log(`✅ Found callback at: ${callbackPath}`);
        console.log("Calling callback with token...");
        const result = func(token);
        console.log("Callback result:", result);
        return result;
      } else {
        console.error("❌ No callback function found in client");
        console.log("Available client properties:", Object.keys(client));

        // Let's explore the structure a bit more
        if (client.u) {
          console.log("client.u properties:", Object.keys(client.u));
          if (client.u.u) {
            console.log("client.u.u properties:", Object.keys(client.u.u));
          }
        }
      }
    } catch (error) {
      console.error("Error calling callback:", error);
    }
  },
  { token: solution.gRecaptchaResponse, clientId: activeClientId }
);

console.log("Captcha solved");

await page.waitForTimeout(1000);

// Capture timestamp BEFORE clicking the continue button
// This ensures we don't miss emails that arrive while the page is loading
const searchConfirmationMailAfter = new Date();
console.log(`🕐 Capturing timestamp before continue button click: ${searchConfirmationMailAfter.toISOString()}`);

await page.click("button[type='submit']");

await page.waitForTimeout(1000);

await page.screenshot({ path: `screenshots/example.png` });

// Smart function that handles both email verification and workspace selection
// Pass the timestamp from when we clicked the continue button
await handleSlackLoginFlow({
  page,
  workspaceName: "Padoa",
  maxWaitMinutes: 3,
  searchConfirmationMailAfter
});

await page.waitForTimeout(1000);

await page.screenshot({ path: `screenshots/example2.png` });

await clickWorkspace(page, "Padoa");

await page.waitForTimeout(3000);

await page.screenshot({ path: `screenshots/example3.png` });
