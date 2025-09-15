import { gmail_v1 } from 'googleapis';
import { format, formatISO, isAfter, differenceInSeconds } from "date-fns";
import { extractCodeFromMessage, getSubject } from './code-extractor.js';
import type { EmailSearchQuery } from './types.js';

/**
 * Poll Gmail for Slack verification code that arrives after a specific timestamp
 */
export async function pollForSlackCode(
  gmail: gmail_v1.Gmail,
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
    `⏱️ Will poll for up to ${maxWaitMinutes} minutes, checking every 5 seconds`
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
            parseInt(fullMessage.data.internalDate!)
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
      console.error("❌ Error during Gmail search:", error);
      throw error;
    }
  }

  throw new Error(
    `Timeout: No Slack verification email found after ${maxWaitMinutes} minutes`
  );
}

/**
 * Search for emails with custom query
 */
export async function searchEmails(
  gmail: gmail_v1.Gmail,
  query: EmailSearchQuery
): Promise<gmail_v1.Schema$Message[]> {
  const searchQuery = `from:${query.from} subject:"${query.subject}" after:${query.after}`;
  
  const response = await gmail.users.messages.list({
    userId: "me",
    q: searchQuery,
    maxResults: 10,
  });

  const messages: gmail_v1.Schema$Message[] = [];
  
  if (response.data.messages) {
    for (const message of response.data.messages) {
      if (message.id) {
        const fullMessage = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "full",
        });
        
        if (fullMessage.data) {
          messages.push(fullMessage.data);
        }
      }
    }
  }
  
  return messages;
}
