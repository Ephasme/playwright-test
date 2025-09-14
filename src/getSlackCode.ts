import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs/promises";
import * as path from "path";
import * as readline from "readline";
// import { fromZonedTime } from "date-fns-tz"; // Not needed for simple timestamp comparison
import {
  format,
  formatISO,
  addMinutes,
  isAfter,
  differenceInSeconds,
} from "date-fns";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = path.join(process.cwd(), "gmail-token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "gmail-credentials.json");

/**
 * Get Slack verification code from Gmail, searching for emails after a specific timestamp
 */
export async function getSlackVerificationCode(
  searchAfterTimestamp: Date,
  maxWaitMinutes: number = 3
): Promise<string> {
  try {
    // Load credentials
    const credentialsContent = await fs.readFile(CREDENTIALS_PATH, "utf8");
    const credentials = JSON.parse(credentialsContent);
    const credData = credentials.web || credentials.installed;
    if (!credData) {
      throw new Error(
        "Invalid credentials format - missing web or installed section"
      );
    }
    const { client_id, client_secret, redirect_uris } = credData;

    // Setup OAuth2 client with loopback for desktop apps (current Google recommendation)
    const redirectUri = "http://127.0.0.1:3000";
    const oauth2Client = new OAuth2Client(
      client_id,
      client_secret,
      redirectUri
    );

    // Load or get tokens
    let token;
    try {
      const tokenContent = await fs.readFile(TOKEN_PATH, "utf8");
      token = JSON.parse(tokenContent);
      oauth2Client.setCredentials(token);
    } catch (error) {
      // First time - need to authenticate
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
      });

      // Start local server to handle OAuth callback
      console.log("🔄 Starting OAuth flow...");
      const { code } = await startLocalServerAndGetCode(authUrl);
      console.log(
        `🔑 Got OAuth code: ${code ? code.substring(0, 20) + "..." : "null"}`
      );

      console.log("🔄 Exchanging code for tokens...");
      const { tokens } = await oauth2Client.getToken(code);
      console.log("✅ Successfully got tokens");
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      oauth2Client.setCredentials(tokens);
    }

    // Initialize Gmail API
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    return await pollForSlackCode(gmail, searchAfterTimestamp, maxWaitMinutes);
  } catch (error) {
    console.error("Error getting Slack verification code:", error);
    throw error;
  }
}

/**
 * Extract verification code from email message
 */
function extractCodeFromMessage(messageData: any): string | null {
  const body = getEmailBody(messageData.payload);
  if (!body) {
    console.log("⚠️ No email body found");
    return null;
  }

  console.log(`📄 Email body sample: ${body.substring(0, 200)}...`);

  // Slack verification code format: QGI-T68 (3 letters, dash, 2-3 alphanumeric)
  const slackCodePattern = /([A-Z]{3}-[A-Z0-9]{2,3})/;

  const match = body.match(slackCodePattern);
  if (match && match[1]) {
    console.log(`✅ Found Slack code: ${match[1]}`);
    return match[1];
  }

  return null;
}

/**
 * Extract email body from message payload
 */
function getEmailBody(payload: any): string | null {
  let body = "";

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" || part.mimeType === "text/html") {
        if (part.body?.data) {
          body += Buffer.from(part.body.data, "base64").toString("utf8");
        }
      } else if (part.parts) {
        const nestedBody = getEmailBody(part);
        if (nestedBody) body += nestedBody;
      }
    }
  } else if (payload.body?.data) {
    body = Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  return body || null;
}

/**
 * Poll Gmail for Slack verification code that arrives after a specific timestamp
 */
async function pollForSlackCode(
  gmail: any,
  searchAfterTimestamp: Date,
  maxWaitMinutes: number
): Promise<string> {
  const startTime = new Date();
  const maxWaitMinutes_ms = maxWaitMinutes * 60 * 1000;
  const pollIntervalMs = 5000; // Poll every 5 seconds

  console.log(
    `🔍 Polling for Slack verification emails after: ${formatISO(
      searchAfterTimestamp
    )}`
  );
  console.log(
    `⏱️ Will wait up to ${maxWaitMinutes} minutes, checking every 5 seconds`
  );

  while (
    differenceInSeconds(new Date(), startTime) * 1000 <
    maxWaitMinutes_ms
  ) {
    try {
      // Convert timestamp to Gmail search format (YYYY/MM/DD)
      const searchDateString = format(searchAfterTimestamp, "yyyy/MM/dd");
      const query = `from:slack.com subject:"confirmation code" after:${searchDateString}`;

      console.log(
        `🔄 Searching Gmail... (${differenceInSeconds(
          new Date(),
          startTime
        )}s elapsed)`
      );

      const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 10,
      });

      const messages = response.data.messages;
      console.log(`📧 Found ${messages?.length || 0} emails matching search`);

      if (messages && messages.length > 0) {
        // Check each message to see if it's newer than our timestamp
        for (const message of messages) {
          if (!message.id) continue;

          const fullMessage = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "full",
          });

          if (!fullMessage.data) continue;

          // Check if this email was sent after our timestamp
          // Gmail's internalDate is always in UTC (milliseconds since epoch)
          const emailTimestamp = new Date(
            parseInt(fullMessage.data.internalDate)
          );

          // Debug: Show timestamp comparison
          console.log(`🕐 Timestamp comparison:`);
          console.log(`   Search after: ${formatISO(searchAfterTimestamp)}`);
          console.log(`   Email sent at: ${formatISO(emailTimestamp)}`);
          console.log(
            `   Email is newer: ${isAfter(
              emailTimestamp,
              searchAfterTimestamp
            )}`
          );

          if (isAfter(emailTimestamp, searchAfterTimestamp)) {
            console.log(
              `📨 ✅ Processing fresh email from: ${formatISO(emailTimestamp)}`
            );

            // Debug: show subject line
            const subject = getSubject(fullMessage.data.payload?.headers || []);
            console.log(`📋 Subject: ${subject}`);

            const code = extractCodeFromMessage(fullMessage.data);
            console.log(`🔍 Extracted code: ${code || "none"}`);

            if (code) {
              console.log(`✅ Found fresh verification code: ${code}`);
              return code;
            }
          } else {
            console.log(
              `⏭️ ❌ Skipping old email from: ${formatISO(emailTimestamp)}`
            );
          }
        }
      }

      // Wait before next poll
      console.log(
        `⏳ No new emails found, waiting 5 seconds before next check...`
      );
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    } catch (error) {
      console.error("Error during polling:", error);
      // Continue polling despite errors
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  const elapsedMinutes = Math.round(
    differenceInSeconds(new Date(), startTime) / 60
  );
  throw new Error(
    `No Slack verification code received within ${maxWaitMinutes} minutes (waited ${elapsedMinutes} minutes)`
  );
}

/**
 * Extract subject from email headers
 */
function getSubject(headers: any[]): string | null {
  if (!headers) return null;
  const subjectHeader = headers.find(
    (header) => header.name?.toLowerCase() === "subject"
  );
  return subjectHeader?.value || null;
}

/**
 * Start local server and handle OAuth2 callback
 */
async function startLocalServerAndGetCode(
  authUrl: string
): Promise<{ code: string }> {
  const http = await import("http");
  const { parse } = await import("url");
  const { exec } = await import("child_process");

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      console.log(`📥 Received callback: ${req.url}`);

      if (req.url) {
        const parsedUrl = parse(req.url, true);
        console.log(`📋 Parsed URL:`, {
          pathname: parsedUrl.pathname,
          query: parsedUrl.query,
        });

        if (parsedUrl.query.code) {
          // Success page
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <head><title>Authorization Success</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">✅ Authorization Successful!</h1>
                <p>You can now close this browser window and return to your application.</p>
              </body>
            </html>
          `);

          console.log(
            `✅ Successfully extracted code: ${parsedUrl.query.code}`
          );
          server.close();
          resolve({ code: parsedUrl.query.code as string });
        } else if (parsedUrl.query.error) {
          // Error page
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <head><title>Authorization Error</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Authorization Failed</h1>
                <p>Error: ${parsedUrl.query.error}</p>
                <p>Description: ${
                  parsedUrl.query.error_description || "Unknown error"
                }</p>
              </body>
            </html>
          `);

          server.close();
          reject(new Error(`OAuth error: ${parsedUrl.query.error}`));
        } else {
          // Show what we received for debugging
          console.log(`⚠️ No code or error found in callback`);
          console.log(`📋 Full query:`, parsedUrl.query);

          // Send a basic response to show the callback was received
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <head><title>OAuth Callback</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>OAuth Callback Received</h1>
                <p>URL: ${req.url}</p>
                <p>Query: ${JSON.stringify(parsedUrl.query)}</p>
              </body>
            </html>
          `);
        }
      } else {
        console.log(`⚠️ No URL received in callback`);
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("No URL received");
      }
    });

    server.listen(3000, "127.0.0.1", () => {
      console.log("\n🔐 Gmail Authorization Required");
      console.log("📱 Opening browser for authentication...");
      console.log("🌐 If browser doesn't open automatically, visit:");
      console.log(authUrl);

      // Try to open browser automatically
      const platform = process.platform;
      let command = "";

      if (platform === "darwin") command = `open "${authUrl}"`;
      else if (platform === "win32") command = `start "" "${authUrl}"`;
      else command = `xdg-open "${authUrl}"`;

      exec(command, (error) => {
        if (error) {
          console.log("⚠️ Could not open browser automatically");
        }
      });
    });

    server.on("error", (err) => {
      reject(new Error(`Server error: ${err.message}`));
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(
        new Error(
          "Authorization timeout - no response received within 5 minutes"
        )
      );
    }, 5 * 60 * 1000);
  });
}

/**
 * Smart function that handles both email verification and workspace selection
 * Detects which page we're on and proceeds accordingly
 */
export async function handleSlackLoginFlow(
  page: any,
  workspaceName: string,
  maxWaitMinutes: number = 3
): Promise<void> {
  console.log("🚀 Starting smart Slack login flow detection...");

  // Wait a bit for the page to load and determine which state we're in
  await page.waitForTimeout(2000);

  try {
    // Check if we're on the workspace selection page (email verification was skipped)
    const workspaceListExists =
      (await page.locator(".p-workspaces_list__panel").count()) > 0;
    const workspaceLinksExist =
      (await page.locator('[data-qa="current_workspaces_open_link"]').count()) >
      0;

    if (workspaceListExists && workspaceLinksExist) {
      console.log(
        "✅ Detected workspace selection page - email verification was skipped"
      );
      console.log("🎯 Proceeding directly to workspace selection...");
      await page.screenshot({ path: "workspace-selection-page.png" });

      await clickWorkspace(page, workspaceName);
      return;
    }

    // Check if we're on the email verification page
    const emailInputExists =
      (await page.locator('input[aria-label="digit 1 of 6"]').count()) > 0;
    const confirmationCodeExists =
      (await page.locator('[data-qa="confirmation_code_input"]').count()) > 0;

    if (emailInputExists || confirmationCodeExists) {
      console.log(
        "✅ Detected email verification page - proceeding with code verification..."
      );
      await page.screenshot({ path: "email-verification-page.png" });
      const code = await waitForVerificationPageAndGetCode(
        page,
        maxWaitMinutes
      );
      await enterSlackCode(page, code);

      // After entering code, we should reach workspace selection page
      console.log(
        "🎯 Waiting for workspace selection page after verification..."
      );
      await page.waitForSelector('[data-qa="current_workspaces_open_link"]', {
        timeout: 10000,
      });
      await clickWorkspace(page, workspaceName);
      return;
    }

    // If neither page is detected, wait a bit more and try to detect again
    console.log("🔍 Page state unclear, waiting a bit more...");
    await page.waitForTimeout(3000);

    // Re-check after waiting
    const delayedWorkspaceCheck =
      (await page.locator('[data-qa="current_workspaces_open_link"]').count()) >
      0;
    const delayedVerificationCheck =
      (await page.locator('input[aria-label="digit 1 of 6"]').count()) > 0;

    if (delayedWorkspaceCheck) {
      console.log("✅ Now detected workspace selection page");
      await clickWorkspace(page, workspaceName);
      return;
    } else if (delayedVerificationCheck) {
      console.log("✅ Now detected email verification page");
      const code = await waitForVerificationPageAndGetCode(
        page,
        maxWaitMinutes
      );
      await enterSlackCode(page, code);
      await page.waitForSelector('[data-qa="current_workspaces_open_link"]', {
        timeout: 10000,
      });
      await clickWorkspace(page, workspaceName);
      return;
    }

    throw new Error(
      "❌ Could not detect current Slack page state (neither workspace selection nor email verification)"
    );
  } catch (error) {
    console.error("❌ Error in Slack login flow:", error);

    // Debug: Take a screenshot and show current page info
    await page.screenshot({ path: "slack-login-flow-error.png" });
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`📄 Page title: ${pageTitle}`);

    throw error;
  }
}

/**
 * Wait for Slack verification page to load and then get the verification code
 */
export async function waitForVerificationPageAndGetCode(
  page: any,
  maxWaitMinutes: number = 3
): Promise<string> {
  // Wait for verification page to load
  console.log("⏳ Waiting for verification page to load...");
  await page.waitForSelector('input[aria-label="digit 1 of 6"]', {
    timeout: 30000,
  });

  // Record the timestamp when verification page loads
  // No timezone conversion needed - Date objects represent moments in time
  const pageLoadTime = new Date();

  console.log(`📅 Verification page loaded at: ${formatISO(pageLoadTime)}`);

  // Fetch verification code that arrives AFTER this time
  console.log("📧 Waiting for verification email...");
  const code = await getSlackVerificationCode(pageLoadTime, maxWaitMinutes);

  return code;
}

/**
 * Find and click on a specific Slack workspace by name
 */
export async function clickWorkspace(
  page: any,
  workspaceName: string
): Promise<void> {
  console.log(`🔍 Looking for workspace: ${workspaceName}`);

  try {
    // Wait for workspace list to load
    await page.waitForSelector('[data-qa="current_workspaces_open_link"]', {
      timeout: 10000,
    });

    // Option 1: Try to find by aria-label (most specific)
    const workspaceByAriaLabel = page.locator(
      `[aria-label="Open ${workspaceName}"]`
    );
    if ((await workspaceByAriaLabel.count()) > 0) {
      console.log(`✅ Found workspace by aria-label: Open ${workspaceName}`);
      await workspaceByAriaLabel.click();
      return;
    }

    // Option 2: Find by workspace title within the workspace info
    const workspaceByTitle = page
      .locator(".p-workspace_info__title")
      .filter({ hasText: workspaceName });
    if ((await workspaceByTitle.count()) > 0) {
      console.log(`✅ Found workspace by title: ${workspaceName}`);
      // Click on the parent workspace link
      await workspaceByTitle
        .locator(
          'xpath=ancestor::a[contains(@class, "p-workspaces_list__link")]'
        )
        .click();
      return;
    }

    // Option 3: Find authenticate button within the specific workspace
    const workspaceContainer = page
      .locator(".p-workspace_info__title")
      .filter({ hasText: workspaceName })
      .locator("xpath=ancestor::a");
    const authenticateButton = workspaceContainer.locator(
      'button:has-text("Authenticate")'
    );
    if ((await authenticateButton.count()) > 0) {
      console.log(
        `✅ Found authenticate button for workspace: ${workspaceName}`
      );
      await authenticateButton.click();
      return;
    }

    // If none of the above work, list available workspaces for debugging
    const allWorkspaces = await page
      .locator(".p-workspace_info__title")
      .allTextContents();
    console.log(
      `❌ Workspace "${workspaceName}" not found. Available workspaces:`,
      allWorkspaces
    );

    throw new Error(
      `Workspace "${workspaceName}" not found. Available: ${allWorkspaces.join(
        ", "
      )}`
    );
  } catch (error) {
    console.error(`❌ Error clicking workspace "${workspaceName}":`, error);
    throw error;
  }
}

/**
 * Enter verification code into Slack's split input fields
 */
export async function enterSlackCode(page: any, code: string): Promise<void> {
  // Slack codes are in format QGI-T68 (7 characters: 3 letters, dash, 2-3 chars)
  if (!/^[A-Z]{3}-[A-Z0-9]{2,3}$/.test(code)) {
    throw new Error(
      `Invalid Slack code format, expected XXX-XXX, got: ${code}`
    );
  }

  // Remove the dash: QGI-T68 becomes QGIT68
  const codeWithoutDash = code.replace("-", "");
  const characters = codeWithoutDash.split("");

  // Fill each of the 6 input fields
  for (let i = 0; i < 6; i++) {
    const digitNumber = i + 1;
    const selector = `input[aria-label="digit ${digitNumber} of 6"]`;

    try {
      await page.fill(selector, characters[i]);
    } catch (error) {
      throw new Error(`Failed to fill digit ${digitNumber}: ${error}`);
    }
  }

  console.log(
    `✅ Entered Slack verification code: ${code} (as ${codeWithoutDash})`
  );
}

// Usage examples:
/*

// NEW: Smart all-in-one approach (RECOMMENDED)
import { handleSlackLoginFlow } from './getSlackCode.js';

// This handles BOTH scenarios automatically:
// - If email verification page: waits for email, enters code, then selects workspace
// - If workspace selection page: directly selects workspace
await handleSlackLoginFlow(page, 'Padoa', 3);

// MANUAL: Individual functions for specific scenarios
import { clickWorkspace, waitForVerificationPageAndGetCode, enterSlackCode } from './getSlackCode.js';

// Scenario 1: Already on workspace selection page
await clickWorkspace(page, 'Padoa');

// Scenario 2: On email verification page
const code = await waitForVerificationPageAndGetCode(page, 3);
await enterSlackCode(page, code);

// Scenario 3: Manual timing approach
await page.waitForSelector('input[aria-label="digit 1 of 6"]');
const verificationPageLoadTime = new Date();
const code = await getSlackVerificationCode(verificationPageLoadTime, 3);
await enterSlackCode(page, code);
*/
