import { gmail_v1 } from 'googleapis';

/**
 * Extract verification code from email message
 */
export function extractCodeFromMessage(messageData: gmail_v1.Schema$Message): string | null {
  const body = getEmailBody(messageData.payload);
  if (!body) {
    console.log("⚠️ No email body found");
    return null;
  }

  console.log(`📄 Email body sample: ${body.substring(0, 200)}...`);

  // Slack verification code format: QGI-T68 or RY3-QAD (3 alphanumeric, dash, 2-3 alphanumeric)
  const slackCodePattern = /([A-Z0-9]{3}-[A-Z0-9]{2,3})/;

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
export function getEmailBody(payload?: gmail_v1.Schema$MessagePart): string | null {
  if (!payload) return null;

  let body = "";

  // Handle single part messages
  if (payload.body?.data) {
    body = Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Handle multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.body?.data) {
        body += Buffer.from(part.body.data, "base64").toString("utf-8");
      } else if (part.parts) {
        // Recursive call for nested parts
        const nestedBody = getEmailBody(part);
        if (nestedBody) body += nestedBody;
      }
    }
  }

  return body || null;
}

/**
 * Extract subject from email headers
 */
export function getSubject(headers: gmail_v1.Schema$MessagePartHeader[]): string | null {
  const subjectHeader = headers.find(
    (header) => header.name?.toLowerCase() === "subject"
  );
  return subjectHeader?.value || null;
}
