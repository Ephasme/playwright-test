import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import * as fs from "fs/promises";
import * as path from "path";
import * as http from "http";
import * as url from "url";
import { execSync } from "child_process";
import type { GmailConfig } from "./types.js";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = path.join(process.cwd(), "gmail-token.json");

/**
 * Initialize OAuth2 client with Gmail credentials
 */
export async function initializeGmailAuth(config: GmailConfig): Promise<OAuth2Client> {
  const oauth2Client = new OAuth2Client(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );

  // Try to load existing tokens
  try {
    const tokenContent = await fs.readFile(TOKEN_PATH, "utf8");
    const token = JSON.parse(tokenContent);
    oauth2Client.setCredentials(token);
    console.log("✅ Using existing Gmail tokens");
  } catch (error) {
    // Need to authenticate for the first time
    console.log("🔄 Starting OAuth flow for Gmail...");
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });

    // Get authorization code via local server
    const { code } = await startLocalServerAndGetCode(authUrl);
    console.log(
      `🔑 Got OAuth code: ${code ? code.substring(0, 20) + "..." : "null"}`
    );

    // Exchange code for tokens
    console.log("🔄 Exchanging code for tokens...");
    const { tokens } = await oauth2Client.getToken(code);
    console.log("✅ Successfully got tokens");
    
    // Save tokens for future use
    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    oauth2Client.setCredentials(tokens);
  }

  return oauth2Client;
}

/**
 * Get Gmail API client
 */
export function getGmailClient(oauth2Client: OAuth2Client) {
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * Start a local server to handle OAuth callback and get the authorization code
 */
async function startLocalServerAndGetCode(authUrl: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        reject(new Error("No URL in request"));
        return;
      }

      const parsedUrl = url.parse(req.url, true);
      const code = parsedUrl.query.code as string;

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body>
              <h1>✅ Authorization successful!</h1>
              <p>You can close this window and return to the terminal.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);
        server.close();
        resolve({ code });
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("No authorization code received");
        server.close();
        reject(new Error("No authorization code received"));
      }
    });

    const PORT = 3000;
    server.listen(PORT, () => {
      console.log(`🌐 Local server listening on http://localhost:${PORT}`);
      console.log("\n🔐 Gmail Authorization Required");
      console.log("📋 Opening browser to authorize Gmail access...");
      console.log(`🔗 Auth URL: ${authUrl}\n`);

      // Try to open the browser
      try {
        if (process.platform === "darwin") {
          execSync(`open "${authUrl}"`);
        } else if (process.platform === "win32") {
          execSync(`start "${authUrl}"`);
        } else {
          execSync(`xdg-open "${authUrl}"`);
        }
      } catch (error) {
        console.log("⚠️ Could not open browser automatically.");
        console.log(`Please open this URL manually: ${authUrl}`);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}
