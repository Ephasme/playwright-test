import { chromium } from 'playwright';
import { Storage } from '@google-cloud/storage';
import { makeCookiesLoader } from './cookies/index.js';
import { config } from './config.js';
import { interceptSlackAuthWithCookies, SlackApiFactory } from './slack-api/index.js';

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

  console.log('✅ client.userBoot SUCCESS!');
  console.log('📊 Response structure:');
  console.log(`  - ok: ${userBootData.ok}`);
  console.log(`  - self.id: ${userBootData.self?.id}`);
  console.log(`  - self.name: ${userBootData.self?.name}`);
  console.log(`  - team.name: ${userBootData.team?.name}`);

  if (userBootData.channels) {
    console.log(`📋 Found ${userBootData.channels.length} channels:`);
    userBootData.channels.slice(0, 5).forEach((channel: any) => {
      console.log(`  - ${channel.name} (${channel.id}) [${channel.is_private ? 'private' : 'public'}]`);
    });
    if (userBootData.channels.length > 5) {
      console.log(`  ... and ${userBootData.channels.length - 5} more channels`);
    }
  }

  console.log('🎉 SUCCESS! Real client.userBoot API works with intercepted token!');

} catch (error) {
  console.error('❌ client.userBoot failed:', error);
}

await browser.close();