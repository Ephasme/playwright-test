import { env } from "process";
import { initializeGmailAuth, getGmailClient } from "./gmail-auth.js";
import { pollForSlackCode } from "./email-fetcher.js";
import type { VerificationCodeConfig, GmailConfig } from "./types.js";

// Re-export types and utility functions
export * from "./types.js";
export { extractCodeFromMessage, getEmailBody, getSubject } from "./code-extractor.js";
export { searchEmails } from "./email-fetcher.js";

/**
 * Get Slack verification code from Gmail, searching for emails after a specific timestamp
 */
export async function getSlackVerificationCode(
  searchAfterTimestamp: Date,
  maxWaitMinutes: number = 3
): Promise<string> {
  try {
    // Gmail configuration from environment variables
    const gmailConfig: GmailConfig = {
      clientId: env.GMAIL_CLIENT_ID || "",
      clientSecret: env.GMAIL_CLIENT_SECRET || "",
      redirectUri: env.GMAIL_REDIRECT_URI || ""
    };

    // Validate required environment variables
    if (!gmailConfig.clientId || !gmailConfig.clientSecret || !gmailConfig.redirectUri) {
      throw new Error("Missing required Gmail environment variables: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI");
    }

    // Initialize OAuth2 client
    const oauth2Client = await initializeGmailAuth(gmailConfig);
    
    // Get Gmail API client
    const gmail = getGmailClient(oauth2Client);

    // Poll for verification code
    return await pollForSlackCode(gmail, searchAfterTimestamp, maxWaitMinutes);
  } catch (error) {
    console.error("Error getting Slack verification code:", error);
    throw error;
  }
}
