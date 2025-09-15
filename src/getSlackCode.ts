import { formatISO } from "date-fns";
import { getSlackVerificationCode } from "./email-verification/index.js";
import type { Page, Locator } from 'playwright';

/**
 * Handle cookie acceptance banners that might block workspace clicks
 * Optimized for Slack: OneTrust banners (based on HTML analysis) + Slack-specific patterns
 */
export async function dismissCookieBanners(page: Page): Promise<void> {
  console.log("🍪 Checking for cookie banners...");
  
  // Take initial screenshot to see what's on the page before banner detection
  await page.screenshot({ 
    path: `screenshots/before-cookie-banner-detection-${Date.now()}.png`,
    fullPage: true 
  });
  
  // First, check if OneTrust banner is present (more targeted approach)
  const oneTrustBanner = page.locator('#onetrust-banner-sdk');
  console.log("🔍 Checking for OneTrust banner (#onetrust-banner-sdk)...");
  
  const oneTrustVisible = await oneTrustBanner.isVisible({ timeout: 2000 });
  console.log(`   → OneTrust banner visible: ${oneTrustVisible}`);
  
  if (oneTrustVisible) {
    console.log("✅ Detected OneTrust cookie banner");
    await page.screenshot({ 
      path: `screenshots/found-onetrust-banner-${Date.now()}.png`,
      fullPage: true 
    });
    
    // Try the accept button first
    const acceptBtn = oneTrustBanner.locator('#onetrust-accept-btn-handler');
    const acceptVisible = await acceptBtn.isVisible({ timeout: 1000 });
    console.log(`   → OneTrust accept button visible: ${acceptVisible}`);
    
    if (acceptVisible) {
      console.log("✅ Clicking OneTrust 'Accept All Cookies' button");
      await acceptBtn.click();
      console.log("✅ OneTrust cookie banner dismissed");
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: `screenshots/after-onetrust-accept-${Date.now()}.png`,
        fullPage: true 
      });
      return;
    }
    
    // Fallback to reject if accept isn't available
    const rejectBtn = oneTrustBanner.locator('#onetrust-reject-all-handler');
    const rejectVisible = await rejectBtn.isVisible({ timeout: 1000 });
    console.log(`   → OneTrust reject button visible: ${rejectVisible}`);
    
    if (rejectVisible) {
      console.log("⚠️ Accept button not found, clicking 'Reject All Cookies' button");
      await rejectBtn.click();
      console.log("✅ OneTrust cookie banner dismissed (rejected)");
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: `screenshots/after-onetrust-reject-${Date.now()}.png`,
        fullPage: true 
      });
      return;
    }
    
    console.log("⚠️ OneTrust banner found but no clickable buttons detected");
  }
  
  // Fallback to Slack-specific cookie banners (if not OneTrust)
  const slackCookieSelectors = [
    '[data-qa="banner_acknowledge_button"]',
    '.p-banner__acknowledge',
    '[data-qa="cookie_banner_accept"]'
  ];

  console.log("🔍 Checking for Slack-specific cookie banners...");
  for (const selector of slackCookieSelectors) {
    try {
      console.log(`🔍 Checking selector: ${selector}`);
      const cookieButton = page.locator(selector).first();
      const isVisible = await cookieButton.isVisible({ timeout: 1000 });
      console.log(`   → Visible: ${isVisible}`);
      
      if (isVisible) {
        console.log(`✅ Found Slack cookie banner with selector: ${selector}`);
        await page.screenshot({ 
          path: `screenshots/found-slack-banner-${selector.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.png`,
          fullPage: true 
        });
        await cookieButton.click();
        console.log("✅ Slack cookie banner dismissed");
        await page.waitForTimeout(1000);
        await page.screenshot({ 
          path: `screenshots/after-slack-banner-dismissed-${Date.now()}.png`,
          fullPage: true 
        });
        return;
      }
    } catch (error) {
      console.log(`   → Error checking selector ${selector}:`, error instanceof Error ? error.message : String(error));
      continue;
    }
  }
  
  // Take screenshot showing what's on the page when no banners are detected
  await page.screenshot({ 
    path: `screenshots/no-cookie-banners-found-${Date.now()}.png`,
    fullPage: true 
  });
  
  // Debug: List all elements that might be related to cookies/banners
  console.log("🔍 Debug: Searching for any elements that might be cookie-related...");
  const cookieRelatedSelectors = [
    '*[id*="cookie"]',
    '*[class*="cookie"]',
    '*[data-qa*="cookie"]',
    '*[id*="banner"]',
    '*[class*="banner"]',
    '*[data-qa*="banner"]',
    '*[id*="consent"]',
    '*[class*="consent"]',
    'button[type="button"]:has-text("Accept")',
    'button[type="button"]:has-text("Allow")',
    'button[type="button"]:has-text("OK")',
    'button[type="button"]:has-text("Got it")'
  ];
  
  for (const debugSelector of cookieRelatedSelectors) {
    try {
      const elements = page.locator(debugSelector);
      const count = await elements.count();
      if (count > 0) {
        console.log(`🔍 Found ${count} elements matching: ${debugSelector}`);
        // Get text content of first few elements
        for (let i = 0; i < Math.min(count, 3); i++) {
          const text = await elements.nth(i).textContent();
          const isVisible = await elements.nth(i).isVisible();
          console.log(`   → Element ${i + 1}: "${text?.trim()}" (visible: ${isVisible})`);
        }
      }
    } catch (error) {
      // Ignore errors for debug selectors
    }
  }
  
  console.log("ℹ️ No cookie banners found (checked OneTrust and Slack-specific patterns)");
}

/**
 * Verify that workspace click succeeded by checking for navigation/page changes
 */
/**
 * Debug function to analyze all authenticate buttons on the page
 */
export async function debugAuthenticateButtons(page: Page, workspaceName: string): Promise<void> {
  console.log(`🔍 === DEBUGGING AUTHENTICATE BUTTONS FOR WORKSPACE: ${workspaceName} ===`);
  
  // Check all button elements that might contain "Authenticate"
  const allButtons = page.locator('button');
  const buttonCount = await allButtons.count();
  console.log(`📊 Total buttons on page: ${buttonCount}`);
  
  // Analyze each button
  for (let i = 0; i < Math.min(buttonCount, 10); i++) { // Limit to 10 buttons to avoid spam
    const button = allButtons.nth(i);
    try {
      const text = await button.textContent();
      const isVisible = await button.isVisible();
      const isEnabled = await button.isEnabled();
      const classList = await button.getAttribute('class');
      const dataQa = await button.getAttribute('data-qa');
      
      if (text && text.toLowerCase().includes('auth')) {
        console.log(`🔘 AUTHENTICATE BUTTON FOUND:
   → Index: ${i}
   → Text: "${text?.trim()}"
   → Visible: ${isVisible}
   → Enabled: ${isEnabled}
   → Classes: ${classList || 'none'}
   → Data-QA: ${dataQa || 'none'}`);
      }
    } catch (error) {
      console.log(`   → Error analyzing button ${i}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Check specific selectors we use
  const selectors = [
    'button.p-get_started_email_form__button:has-text("Authenticate")',
    'button:has-text("Authenticate")',
    '[data-qa*="auth" i]:has-text("Authenticate")'
  ];
  
  console.log(`🔍 Testing specific selectors:`);
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      const count = await element.count();
      if (count > 0) {
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();
        const text = await element.textContent();
        console.log(`✅ Selector "${selector}":
   → Count: ${count}
   → Text: "${text?.trim()}"
   → Visible: ${isVisible}
   → Enabled: ${isEnabled}`);
      } else {
        console.log(`❌ Selector "${selector}": No elements found`);
      }
    } catch (error) {
      console.log(`❌ Selector "${selector}": Error - ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Check workspace-specific context
  try {
    const workspaceContainer = page
      .locator(".p-workspace_info__title")
      .filter({ hasText: workspaceName });
    const workspaceCount = await workspaceContainer.count();
    console.log(`🏢 Workspace "${workspaceName}" containers found: ${workspaceCount}`);
    
    if (workspaceCount > 0) {
      const contextualButtons = workspaceContainer.locator('xpath=ancestor::*').locator('button');
      const contextualCount = await contextualButtons.count();
      console.log(`🔘 Buttons in workspace context: ${contextualCount}`);
      
      for (let i = 0; i < Math.min(contextualCount, 3); i++) {
        const button = contextualButtons.nth(i);
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        console.log(`   → Button ${i}: "${text?.trim()}" (visible: ${isVisible}, enabled: ${isEnabled})`);
      }
    }
  } catch (error) {
    console.log(`❌ Error analyzing workspace context: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  console.log(`🔍 === END AUTHENTICATE BUTTONS DEBUG ===`);
}

export async function verifyWorkspaceClickSucceeded(page: Page, workspaceName: string): Promise<boolean> {
  console.log("🔍 Verifying workspace click succeeded...");
  
  const startUrl = page.url();
  console.log(`📍 Current URL: ${startUrl}`);
  
  try {
    // Wait for one of these success indicators:
    await Promise.race([
      // URL change (most reliable)
      page.waitForURL(url => url.toString() !== startUrl, { timeout: 10000 }),
      
      // Slack workspace loading indicators
      page.waitForSelector('.p-workspace_sidebar', { timeout: 10000 }),
      page.waitForSelector('[data-qa="workspace_name"]', { timeout: 10000 }),
      page.waitForSelector('.p-channel_sidebar', { timeout: 10000 }),
      
      // Loading state indicators
      page.waitForSelector('.p-loading_screen', { timeout: 10000 }),
    ]);
    
    const newUrl = page.url();
    console.log(`✅ Navigation detected! New URL: ${newUrl}`);
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: `screenshots/workspace-${workspaceName}-success.png`,
      fullPage: false 
    });
    
    return true;
  } catch (error) {
    console.log(`⚠️ No navigation detected within 10 seconds`);
    
    // Take debugging screenshot
    await page.screenshot({ 
      path: `screenshots/workspace-${workspaceName}-stuck.png`,
      fullPage: true 
    });
    
    const finalUrl = page.url();
    console.log(`📍 Final URL (unchanged): ${finalUrl}`);
    
    return false;
  }
}

/**
 * Configuration for Slack login flow handling
 */
export interface SlackLoginFlowConfig {
  page: Page;
  workspaceName: string;
  maxWaitMinutes?: number;
  searchConfirmationMailAfter?: Date;
}

/**
 * Enter the Slack verification code into the 6 input fields
 */
export async function enterSlackCode(page: Page, code: string): Promise<void> {
  console.log(`🔑 Entering Slack code: ${code}`);

  // Slack code should be in format ABC-DEF
  const cleanCode = code.replace("-", "");
  
  if (cleanCode.length !== 6) {
    throw new Error(`Invalid Slack code length: expected 6 characters, got ${cleanCode.length}`);
  }

  // Fill each digit input
  for (let i = 0; i < 6; i++) {
    const digitInput = page.locator(`input[aria-label="digit ${i + 1} of 6"]`);
    const digit = cleanCode[i];
    if (!digit) {
      throw new Error(`Missing digit at position ${i + 1}`);
    }
    await digitInput.fill(digit);
    await page.waitForTimeout(100); // Small delay between inputs
  }

  console.log("✅ Code entered successfully");
}

/**
 * Smart function that handles both email verification and workspace selection
 * Detects which page we're on and proceeds accordingly
 */
export async function handleSlackLoginFlow(
  config: SlackLoginFlowConfig
): Promise<void> {
  const { page, workspaceName, maxWaitMinutes = 3, searchConfirmationMailAfter } = config;
  console.log("🚀 Starting smart Slack login flow detection...");

  // Handle cookie banners first before anything else
  await dismissCookieBanners(page);

  // Wait a bit for the page to load and determine which state we're in
  await page.waitForTimeout(2000);
  
  // Track if we've already attempted workspace selection to avoid duplicates
  let workspaceSelectionAttempted = false;

  try {
    // Check if we're on the workspace selection page (email verification was skipped)
    const workspaceListExists =
      (await page.locator(".p-workspaces_list__panel").count()) > 0;
    const workspaceLinksExist =
      (await page.locator('[data-qa="current_workspaces_open_link"]').count()) >
      0;

    if (workspaceListExists && workspaceLinksExist && !workspaceSelectionAttempted) {
      console.log(
        "✅ Detected workspace selection page - email verification was skipped"
      );
      console.log("🎯 Proceeding directly to workspace selection...");
      await page.screenshot({ path: "screenshots/workspace-selection-page.png" });

      workspaceSelectionAttempted = true;
      console.log("📍 Attempting workspace selection (first attempt)");
      await clickWorkspace(page, workspaceName);
      return;
    } else if (workspaceListExists && workspaceLinksExist && workspaceSelectionAttempted) {
      console.log("⚠️ Workspace selection already attempted, skipping duplicate on initial detection");
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
      // Take screenshot when deciding to look for emails in mailbox
      console.log("📸 Taking screenshot to verify the screen is asking for a code...");
      await page.screenshot({ 
        path: `screenshots/email-verification-decision-${Date.now()}.png`,
        fullPage: true 
      });
      const code = await waitForVerificationPageAndGetCode(
        page,
        maxWaitMinutes,
        searchConfirmationMailAfter
      );
      await enterSlackCode(page, code);

      // After entering code, we should reach workspace selection page
      console.log(
        "🎯 Waiting for workspace selection page after verification..."
      );
      await page.waitForSelector('[data-qa="current_workspaces_open_link"]', {
        timeout: 10000,
      });
      workspaceSelectionAttempted = true;
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

    if (delayedWorkspaceCheck && !workspaceSelectionAttempted) {
      console.log("✅ Now detected workspace selection page");
      workspaceSelectionAttempted = true;
      await clickWorkspace(page, workspaceName);
      return;
    } else if (delayedWorkspaceCheck && workspaceSelectionAttempted) {
      console.log("⚠️ Workspace selection already attempted, skipping duplicate call");
      return;
    } else if (delayedVerificationCheck && !workspaceSelectionAttempted) {
      console.log("✅ Now detected email verification page");
      // Take screenshot when deciding to look for emails in mailbox (delayed detection)
      console.log("📸 Taking screenshot to verify the screen is asking for a code (delayed detection)...");
      await page.screenshot({ 
        path: `screenshots/email-verification-delayed-decision-${Date.now()}.png`,
        fullPage: true 
      });
      const code = await waitForVerificationPageAndGetCode(
        page,
        maxWaitMinutes,
        searchConfirmationMailAfter
      );
      await enterSlackCode(page, code);
      await page.waitForSelector('[data-qa="current_workspaces_open_link"]', {
        timeout: 10000,
      });
      workspaceSelectionAttempted = true;
      await clickWorkspace(page, workspaceName);
      return;
    }

    throw new Error(
      "❌ Could not detect current Slack page state (neither workspace selection nor email verification)"
    );
  } catch (error) {
    console.error("❌ Error in Slack login flow:", error);

    // Debug: Take a screenshot and show current page info
    await page.screenshot({ path: "screenshots/slack-login-flow-error.png" });
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`📄 Page title: ${pageTitle}`);

    throw error;
  }
}

/**
 * Wait for Slack verification page to load and then get the verification code
 * @param searchConfirmationMailAfter - Optional timestamp from when the continue button was clicked
 */
export async function waitForVerificationPageAndGetCode(
  page: Page,
  maxWaitMinutes: number = 3,
  searchConfirmationMailAfter?: Date
): Promise<string> {
  // Wait for verification page to load
  console.log("⏳ Waiting for verification page to load...");
  await page.waitForSelector('input[aria-label="digit 1 of 6"]', {
    timeout: 30000,
  });

  // Use the provided timestamp if available, otherwise capture it now
  // This ensures we don't miss emails that arrived while the page was loading
  const searchAfterTimestamp = searchConfirmationMailAfter || new Date();

  console.log(`📅 Searching for emails after: ${formatISO(searchAfterTimestamp)}`);
  if (searchConfirmationMailAfter) {
    console.log("✅ Using timestamp from continue button click");
  } else {
    console.log("⚠️ No button click timestamp provided, using current time");
  }

  // Fetch verification code that arrives AFTER this time
  console.log("📧 Waiting for verification email...");
  const code = await getSlackVerificationCode(searchAfterTimestamp, maxWaitMinutes);

  return code;
}

/**
 * Find and click on a specific Slack workspace by name with verification
 */
export async function clickWorkspace(
  page: Page,
  workspaceName: string
): Promise<void> {
  console.log(`🔍 Looking for workspace: ${workspaceName}`);

  try {
    // Step 1: Handle cookie banners before attempting to click
    await dismissCookieBanners(page);
    
    // Step 2: Wait for workspace list to load
    await page.waitForSelector('[data-qa="current_workspaces_open_link"]', {
      timeout: 10000,
    });

    let clickSucceeded = false;
    
    // Option 1: Try to find by aria-label (most specific)
    const workspaceByAriaLabel = page.locator(
      `[aria-label="Open ${workspaceName}"]`
    );
    if ((await workspaceByAriaLabel.count()) > 0) {
      console.log(`✅ Found workspace by aria-label: Open ${workspaceName}`);
      await workspaceByAriaLabel.click();
      clickSucceeded = await verifyWorkspaceClickSucceeded(page, workspaceName);
      console.log(`✅ Click succeeded: ${clickSucceeded}`);
      if (clickSucceeded) return;
    }

    // Option 2: Find by workspace title within the workspace info
    if (!clickSucceeded) {
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
        clickSucceeded = await verifyWorkspaceClickSucceeded(page, workspaceName);
        console.log(`✅ Click succeeded: ${clickSucceeded}`);
        if (clickSucceeded) return;
      }
    }

    // Option 3: Find authenticate button (try multiple approaches with proper waiting)
    if (!clickSucceeded) {
      console.log(`🔍 Looking for Authenticate button for workspace: ${workspaceName}`);
      
      // Try 3a: Direct button selection with specific classes
      console.log(`🔍 Attempting direct class selector approach...`);
      const directAuthButton = page.locator('button.p-get_started_email_form__button:has-text("Authenticate")');
      try {
        await directAuthButton.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`✅ Found authenticate button using direct class selector - checking if enabled`);
        
        // Check if button is enabled
        const isEnabled = await directAuthButton.isEnabled();
        console.log(`   → Button enabled: ${isEnabled}`);
        
        if (isEnabled) {
          // Take screenshot before clicking for debugging
          await page.screenshot({ 
            path: `screenshots/before-auth-click-direct-${workspaceName}-${Date.now()}.png`,
            fullPage: true 
          });
          
          console.log(`🔘 Clicking authenticate button (direct selector)`);
          await directAuthButton.click({ timeout: 10000 });
          clickSucceeded = await verifyWorkspaceClickSucceeded(page, workspaceName);
          console.log(`✅ Click succeeded: ${clickSucceeded}`);
          if (clickSucceeded) return;
        } else {
          console.log(`⚠️ Direct authenticate button found but is disabled`);
        }
      } catch (error) {
        console.log(`   → Direct selector failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Try 3b: Generic authenticate button
      if (!clickSucceeded) {
        console.log(`🔍 Attempting generic selector approach...`);
        const genericAuthButton = page.locator('button:has-text("Authenticate")').first();
        try {
          await genericAuthButton.waitFor({ state: 'visible', timeout: 5000 });
          console.log(`✅ Found authenticate button using generic selector - checking if enabled`);
          
          // Check if button is enabled
          const isEnabled = await genericAuthButton.isEnabled();
          console.log(`   → Button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            // Take screenshot before clicking for debugging
            await page.screenshot({ 
              path: `screenshots/before-auth-click-generic-${workspaceName}-${Date.now()}.png`,
              fullPage: true 
            });
            
            console.log(`🔘 Clicking authenticate button (generic selector)`);
            await genericAuthButton.click({ timeout: 10000 });
            clickSucceeded = await verifyWorkspaceClickSucceeded(page, workspaceName);
            console.log(`✅ Click succeeded: ${clickSucceeded}`);
            if (clickSucceeded) return;
          } else {
            console.log(`⚠️ Generic authenticate button found but is disabled`);
          }
        } catch (error) {
          console.log(`   → Generic selector failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Try 3c: Authenticate button within workspace context (original approach)
      if (!clickSucceeded) {
        console.log(`🔍 Attempting contextual selector approach...`);
        const workspaceContainer = page
          .locator(".p-workspace_info__title")
          .filter({ hasText: workspaceName })
          .locator("xpath=ancestor::*");
        const contextualAuthButton = workspaceContainer.locator('button:has-text("Authenticate")');
        try {
          await contextualAuthButton.waitFor({ state: 'visible', timeout: 5000 });
          console.log(`✅ Found authenticate button within workspace context - checking if enabled`);
          
          // Check if button is enabled
          const isEnabled = await contextualAuthButton.isEnabled();
          console.log(`   → Button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            // Take screenshot before clicking for debugging
            await page.screenshot({ 
              path: `screenshots/before-auth-click-contextual-${workspaceName}-${Date.now()}.png`,
              fullPage: true 
            });
            
            console.log(`🔘 Clicking authenticate button (contextual selector)`);
            await contextualAuthButton.click({ timeout: 10000 });
            clickSucceeded = await verifyWorkspaceClickSucceeded(page, workspaceName);
            console.log(`✅ Click succeeded: ${clickSucceeded}`);
            if (clickSucceeded) return;
          } else {
            console.log(`⚠️ Contextual authenticate button found but is disabled`);
          }
        } catch (error) {
          console.log(`   → Contextual selector failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // Try 3d: Alternative selector approaches if all above failed
      if (!clickSucceeded) {
        console.log(`🔍 Trying alternative selector approaches...`);
        
        // Try by role first (most accessible approach)
        try {
          const roleAuthButton = page.getByRole('button', { name: /authenticate/i });
          await roleAuthButton.waitFor({ state: 'visible', timeout: 5000 });
          console.log(`✅ Found authenticate button using role selector`);
          
          const isEnabled = await roleAuthButton.isEnabled();
          console.log(`   → Button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            await page.screenshot({ 
              path: `screenshots/before-auth-click-role-${workspaceName}-${Date.now()}.png`,
              fullPage: true 
            });
            
            console.log(`🔘 Clicking authenticate button (role selector)`);
            await roleAuthButton.click({ timeout: 10000 });
            clickSucceeded = await verifyWorkspaceClickSucceeded(page, workspaceName);
            console.log(`✅ Click succeeded: ${clickSucceeded}`);
            if (clickSucceeded) return;
          }
        } catch (error) {
          console.log(`   → Role selector failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Try data-qa attributes
        try {
          const qaAuthButton = page.locator('[data-qa*="auth" i]:has-text("Authenticate"), [data-qa*="button" i]:has-text("Authenticate")').first();
          await qaAuthButton.waitFor({ state: 'visible', timeout: 5000 });
          console.log(`✅ Found authenticate button using data-qa selector`);
          
          const isEnabled = await qaAuthButton.isEnabled();
          console.log(`   → Button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            await page.screenshot({ 
              path: `screenshots/before-auth-click-qa-${workspaceName}-${Date.now()}.png`,
              fullPage: true 
            });
            
            console.log(`🔘 Clicking authenticate button (data-qa selector)`);
            await qaAuthButton.click({ timeout: 10000 });
            clickSucceeded = await verifyWorkspaceClickSucceeded(page, workspaceName);
            console.log(`✅ Click succeeded: ${clickSucceeded}`);
            if (clickSucceeded) return;
          }
        } catch (error) {
          console.log(`   → Data-qa selector failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // If we reach here, either workspace wasn't found or clicks didn't work
    if (!clickSucceeded) {
      // Enhanced debugging: let's understand what authenticate buttons are available
      console.log(`🔍 DEBUG: Analyzing all authenticate buttons on the page...`);
      await debugAuthenticateButtons(page, workspaceName);
      
      // Take a debug screenshot
      await page.screenshot({ 
        path: `screenshots/workspace-${workspaceName}-debug.png`,
        fullPage: true 
      });
      
      // List available workspaces for debugging
      const allWorkspaces = await page
        .locator(".p-workspace_info__title")
        .allTextContents();
      console.log(
        `❌ Workspace click failed or workspace "${workspaceName}" not found. Available workspaces:`,
        allWorkspaces
      );

      throw new Error(
        `Failed to successfully click workspace "${workspaceName}". This could be due to:\n` +
        `1. Cookie banner or overlay blocking the click\n` +
        `2. Workspace name mismatch\n` +
        `3. Page navigation issues\n` +
        `Available workspaces: ${allWorkspaces.join(", ")}\n` +
        `Check the debug screenshot: workspace-${workspaceName}-debug.png`
      );
    }
  } catch (error) {
    console.error(`❌ Error clicking workspace "${workspaceName}":`, error);
    throw error;
  }
}

// Function that combines everything
// - If on workspace page: clicks the workspace
// - If email verification page: waits for email, enters code, then selects workspace
// USAGE:
//   await handleSlackLoginFlow(page, 'Your Workspace Name');
// That's it! It automatically detects which page you're on and does the right thing

// Example:
// Scenario 1: Already logged in, on workspace selection page
//   - It will click the workspace directly
// Scenario 2: On email verification page
//   - It will wait for email, enter code, then click workspace