import { chromium } from "playwright";
import axios from "axios";
import { z } from "zod";
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
// Alternative approach if the first one doesn't work
// import { injectTokenComprehensive } from "./injectTokenViaScriptManipulation.js";

// Zod schema for Capsolver API response
const CapsolverResponseSchema = z.object({
  errorId: z
    .number()
    .int()
    .describe("Error message: 0 - no error, 1 - with error"),
  errorCode: z.string().optional().describe("errorCode: full list of errors"),
  errorDescription: z.string().optional().describe("Error Description"),
  status: z
    .enum(["idle", "processing", "ready"])
    .describe(
      "Task status: idle - Waiting, processing - Under identification, ready - The identification is complete"
    ),
  solution: z
    .object({
      userAgent: z.string(),
      gRecaptchaResponse: z.string(),
    })
    .optional()
    .describe("Task result data containing userAgent and gRecaptchaResponse"),
});

type CapsolverResponse = z.infer<typeof CapsolverResponseSchema>;

const client = axios.create();

const CAPSOLVER_KEY =
  "CAP-01F13ACBCB3AF5766CC3FC8D69A467D1D0B406CE6345DA10729475B457CAFBB4";
const PAGE_URL =
  "https://slack.com/get-started?entry_point=nav_menu#/createnew";
const SITE_KEY = "6LcQQiYUAAAAADxJHrihACqD5wf3lksm9jbnRY5k";

const browser = await chromium.launch();

const page = await browser.newPage();

page.on("console", (msg) => {
  console.log(`${msg.type().toUpperCase()}: ${msg.text()}`);
});

await page.goto("https://slack.com/");

await page.click("text=Sign in");

await page.fill("input[type='email']", "loup.p@padoa-group.com");

await page.click(".p-get_started_email_form__button");

await page.waitForTimeout(5000);

const recaptchaCallback = await findWorkingRecaptchaCallback(page);
console.log("Recaptcha callback:", recaptchaCallback);

const tokenSubmissionCallback = await findTokenSubmissionCallback(page);
console.log("Token submission callback:", tokenSubmissionCallback);

console.log("Creating task");
const capsolverResponse = await client.post(
  "https://api.capsolver.com/createTask",
  {
    clientKey: CAPSOLVER_KEY,
    task: {
      type: "ReCaptchaV2Task",
      websiteURL: PAGE_URL,
      websiteKey: SITE_KEY,
    },
  }
);

console.log(`Waiting for task ${capsolverResponse.data.taskId} result`);

let taskResultResponse;
let finalResult;
let attempts = 0;
const maxAttempts = 60; // Maximum number of attempts (5 minutes with 5s intervals)

while (attempts < maxAttempts) {
  taskResultResponse = await client.post(
    "https://api.capsolver.com/getTaskResult",
    {
      clientKey: CAPSOLVER_KEY,
      taskId: capsolverResponse.data.taskId,
    }
  );

  const result = CapsolverResponseSchema.parse(taskResultResponse.data);

  if (result.status === "ready") {
    if (result.errorId === 1) {
      throw new Error(
        `Capsolver task failed: ${
          result.errorDescription || result.errorCode || "Unknown error"
        }`
      );
    } else if (result.errorId === 0) {
      finalResult = result;
      console.log(
        `Task ${capsolverResponse.data.taskId} completed successfully`
      );
      break;
    }
  }

  console.log(
    `Task status: ${result.status}, attempt ${attempts + 1}/${maxAttempts}`
  );
  attempts++;

  if (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
  }
}

if (attempts >= maxAttempts) {
  throw new Error(
    `Task ${capsolverResponse.data.taskId} timed out after ${maxAttempts} attempts`
  );
}

console.log(`Task ${capsolverResponse.data.taskId} final result:`, finalResult);

// Most concise version for your specific callback
if (!finalResult?.solution?.gRecaptchaResponse) {
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
  finalResult.solution.gRecaptchaResponse
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
  { token: finalResult.solution.gRecaptchaResponse, clientId: activeClientId }
);

console.log("Captcha solved");

await page.waitForTimeout(1000);

page.click("button[type='submit']");

await page.waitForTimeout(1000);

await page.screenshot({ path: `example.png` });

// Smart function that handles both email verification and workspace selection
await handleSlackLoginFlow(page, "Padoa", 3);

await page.waitForTimeout(1000);

await page.screenshot({ path: `example2.png` });

await clickWorkspace(page, "Padoa");

await page.screenshot({ path: `example3.png` });
