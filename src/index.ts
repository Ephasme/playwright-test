import { chromium } from 'playwright';
import { Storage } from '@google-cloud/storage';
import { makeCookiesLoader } from './cookie-management/index.js';
import { config } from './config/index.js';
import { interceptSlackAuthWithCookies, SlackApiFactory } from './slack-api/index.js';
import fs from 'fs';
import path from 'path';
import removeMarkdown from 'remove-markdown';

// Simplified - no complex types or extraction functions needed

// Create Google Cloud Storage instance with service account credentials
// Using environment variables for secure configuration
const storage = new Storage({
  projectId: config.gcp.projectId,
  keyFilename: config.gcp.credentialsPath,
});

// Load and transform cookies from GCP
const loadCookies = makeCookiesLoader(storage, {
  bucketName: config.gcs.bucketName,
  fileName: config.gcs.cookiesFileName,
});

const browser = await chromium.launch();

// Get workspace URL from config
const workspaceUrl = `${config.slack.baseUrl}/${config.slack.teamId}`;

const slackApiFactory = new SlackApiFactory(loadCookies, workspaceUrl, browser);
const slackApi = await slackApiFactory.createSlackApi();

// Test the clientUserBoot function with internal API
console.log('🚀 Testing Slack REAL client.userBoot API with intercepted token...');

try {
  const userBootData = await slackApi.clientUserBoot(workspaceUrl);

  console.log(`📋 Channels found: ${userBootData.channels.length}`);
  console.log(`📋 First 5 channels: ${userBootData.channels.slice(0, 5).map(channel => channel.name).join(', ')}`);

  const recentMessages = await slackApi.getRecentMessages(workspaceUrl);
  console.log('📋 Recent messages:');
  recentMessages.sample_channels.forEach((channel) => {
    console.log(`  - ${channel.channel.name}: ${channel.messages.length} messages`);

    // Just display basic message info
    console.log(`\n📋 Latest messages in #${channel.channel.name}:`);
    const messagesToProcess = channel.messages.slice(0, 3); // Process first 3 messages

    messagesToProcess.forEach((message, index: number) => {
      console.log(`\n  Message ${index + 1}:`);
      console.log(`\n  Message keys: ${Object.keys(message)}`);
      console.log(`\n  Message text: ${removeMarkdown(message.text)}`);
    });
  });

  fs.writeFileSync(path.join('exports', 'recentMessages.json'), JSON.stringify(recentMessages, null, 2));


} catch (error) {
  console.error('❌ client.userBoot failed:', error);
}

await browser.close();