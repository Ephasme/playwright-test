// External libraries
import axios from "axios";
import type { AxiosInstance } from "axios";
import { z } from "zod";

// Internal types
import type {
  CaptchaProvider,
  CaptchaTaskConfig,
  CreateTaskResponse,
  CaptchaTaskResult,
  CaptchaSolution,
  PollingOptions
} from "../types.js";

/**
 * Zod schema for SolveCaptcha API JSON response validation (submit captcha)
 * Using json=1 parameter returns JSON format: {"status":1,"request":"task_id"} or {"status":0,"request":"ERROR_TEXT"}
 */
const SolveCaptchaSubmitResponseSchema = z.object({
  status: z.number(),
  request: z.string(),
});

/**
 * Zod schema for SolveCaptcha API JSON response validation (get result)
 * Using json=1 parameter returns JSON format: {"status":1,"request":"solution"} or {"status":0,"request":"CAPCHA_NOT_READY"}
 */
const SolveCaptchaResultResponseSchema = z.object({
  status: z.number(),
  request: z.string(),
});

type SolveCaptchaSubmitResponse = z.infer<typeof SolveCaptchaSubmitResponseSchema>;
type SolveCaptchaResultResponse = z.infer<typeof SolveCaptchaResultResponseSchema>;

/**
 * Configuration specific to SolveCaptcha
 */
export interface SolveCaptchaConfig {
  /** SolveCaptcha API key */
  apiKey: string;
  /** Base URL for SolveCaptcha API (optional, defaults to official API) */
  baseUrl?: string;
}

/**
 * SolveCaptcha implementation of the CaptchaProvider interface
 */
export class SolveCaptchaProvider implements CaptchaProvider {
  public readonly name = "SolveCaptcha";
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  private static readonly DEFAULT_BASE_URL = "https://api.solvecaptcha.com";
  private static readonly DEFAULT_POLL_INTERVAL = 5000; // 5 seconds
  private static readonly DEFAULT_MAX_ATTEMPTS = 60; // 5 minutes with 5s intervals

  constructor(config: SolveCaptchaConfig) {
    this.apiKey = config.apiKey;
    const baseUrl = config.baseUrl || SolveCaptchaProvider.DEFAULT_BASE_URL;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Map generic task type to SolveCaptcha method parameter
   */
  private mapTaskTypeToMethod(taskType: string): string {
    const typeMapping: Record<string, string> = {
      'ReCaptchaV2Task': 'userrecaptcha',
      'ReCaptchaV2TaskProxyless': 'userrecaptcha',
      'ReCaptchaV3Task': 'userrecaptcha',
      'ReCaptchaV3TaskProxyless': 'userrecaptcha',
      'HCaptchaTask': 'hcaptcha',
      'HCaptchaTaskProxyless': 'hcaptcha',
      'FunCaptchaTask': 'funcaptcha',
      'FunCaptchaTaskProxyless': 'funcaptcha',
    };

    return typeMapping[taskType] || 'userrecaptcha';
  }


  /**
   * Create a new captcha solving task with SolveCaptcha
   */
  async createTask(config: CaptchaTaskConfig): Promise<CreateTaskResponse> {
    try {
      const method = this.mapTaskTypeToMethod(config.type);
      
      // Build form data for SolveCaptcha API
      const formData = new URLSearchParams();
      formData.append('key', this.apiKey);
      formData.append('method', method);
      formData.append('googlekey', config.websiteKey);
      formData.append('pageurl', config.websiteURL);
      formData.append('json', '1'); // Enable JSON response format

      // Handle additional parameters based on task type
      if (config.type.includes('V3')) {
        formData.append('version', 'v3');
        if (config.additionalParams?.action) {
          formData.append('action', config.additionalParams.action);
        }
        if (config.additionalParams?.min_score !== undefined) {
          formData.append('min_score', config.additionalParams.min_score.toString());
        }
      }

      if (config.type.includes('Invisible') || config.additionalParams?.invisible) {
        formData.append('invisible', '1');
      }

      // Add any other additional parameters
      if (config.additionalParams) {
        for (const [key, value] of Object.entries(config.additionalParams)) {
          if (!['action', 'min_score', 'invisible'].includes(key)) {
            formData.append(key, String(value));
          }
        }
      }

      const response = await this.client.post('/in.php', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const parsed = SolveCaptchaSubmitResponseSchema.parse(response.data);

      if (parsed.status === 1) {
        return {
          errorId: 0,
          taskId: parsed.request,
        };
      } else {
        return {
          errorId: 1,
          errorCode: 'SOLVECAPTCHA_ERROR',
          errorDescription: parsed.request,
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `SolveCaptcha API request failed: ${error.message}${
            error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ""
          }`
        );
      }
      throw new Error(`Failed to create SolveCaptcha task: ${error}`);
    }
  }


  /**
   * Get the result of a captcha solving task from SolveCaptcha
   */
  async getTaskResult(taskId: string): Promise<CaptchaTaskResult> {
    try {
      const response = await this.client.get('/res.php', {
        params: {
          key: this.apiKey,
          action: 'get',
          id: taskId,
          json: '1', // Enable JSON response format
        },
      });

      const parsed = SolveCaptchaResultResponseSchema.parse(response.data);

      if (parsed.status === 1) {
        // Task completed successfully
        return {
          errorId: 0,
          status: 'ready',
          solution: {
            gRecaptchaResponse: parsed.request,
          },
        };
      } else {
        // Check if it's still processing or an error
        if (parsed.request === 'CAPCHA_NOT_READY') {
          return {
            errorId: 0,
            status: 'processing',
          };
        } else {
          // It's an error
          return {
            errorId: 1,
            errorCode: 'SOLVECAPTCHA_ERROR',
            errorDescription: parsed.request,
            status: 'ready',
          };
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `SolveCaptcha API request failed: ${error.message}${
            error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ""
          }`
        );
      }
      throw new Error(`Failed to get SolveCaptcha task result: ${error}`);
    }
  }

  /**
   * Solve a captcha by creating a task and polling until completion
   */
  async solveCaptcha(
    config: CaptchaTaskConfig,
    options: PollingOptions = {}
  ): Promise<CaptchaSolution> {
    const {
      maxAttempts = SolveCaptchaProvider.DEFAULT_MAX_ATTEMPTS,
      pollInterval = SolveCaptchaProvider.DEFAULT_POLL_INTERVAL,
    } = options;

    // Step 1: Create the task
    console.log("Creating SolveCaptcha task...");
    const createResponse = await this.createTask(config);

    if (createResponse.errorId !== 0) {
      throw new Error(
        `Failed to create SolveCaptcha task: ${
          createResponse.errorDescription || createResponse.errorCode || "Unknown error"
        }`
      );
    }

    if (!createResponse.taskId) {
      throw new Error("No task ID returned from SolveCaptcha");
    }

    console.log(`Waiting for SolveCaptcha task ${createResponse.taskId} result...`);

    // Step 2: Poll for results
    let attempts = 0;
    while (attempts < maxAttempts) {
      const result = await this.getTaskResult(createResponse.taskId);

      if (result.status === "ready") {
        if (result.errorId === 1) {
          throw new Error(
            `SolveCaptcha task failed: ${
              result.errorDescription || result.errorCode || "Unknown error"
            }`
          );
        } else if (result.errorId === 0 && result.solution) {
          console.log(`Task ${createResponse.taskId} completed successfully`);
          return result.solution;
        }
      }

      console.log(
        `Task status: ${result.status}, attempt ${attempts + 1}/${maxAttempts}`
      );
      attempts++;

      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(
      `Task ${createResponse.taskId} timed out after ${maxAttempts} attempts`
    );
  }
}

/**
 * Factory function to create a SolveCaptcha provider instance
 */
export function createSolveCaptchaProvider(config: SolveCaptchaConfig): SolveCaptchaProvider {
  return new SolveCaptchaProvider(config);
}
