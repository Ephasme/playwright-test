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
 * Zod schema for Capsolver API response validation
 */
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

/**
 * Zod schema for Capsolver create task response
 */
const CapsolverCreateTaskSchema = z.object({
  errorId: z.number().int(),
  errorCode: z.string().optional(),
  errorDescription: z.string().optional(),
  taskId: z.string().optional(),
});

type CapsolverResponse = z.infer<typeof CapsolverResponseSchema>;
type CapsolverCreateTaskResponse = z.infer<typeof CapsolverCreateTaskSchema>;

/**
 * Configuration specific to Capsolver
 */
export interface CapsolverConfig {
  /** Capsolver API key */
  apiKey: string;
  /** Base URL for Capsolver API (optional, defaults to official API) */
  baseUrl?: string;
}

/**
 * Capsolver implementation of the CaptchaProvider interface
 */
export class CapsolverProvider implements CaptchaProvider {
  public readonly name = "Capsolver";
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  private static readonly DEFAULT_BASE_URL = "https://api.capsolver.com";
  private static readonly DEFAULT_POLL_INTERVAL = 5000; // 5 seconds
  private static readonly DEFAULT_MAX_ATTEMPTS = 60; // 5 minutes with 5s intervals

  constructor(config: CapsolverConfig) {
    this.apiKey = config.apiKey;
    const baseUrl = config.baseUrl || CapsolverProvider.DEFAULT_BASE_URL;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 second timeout
    });
  }

  /**
   * Create a new captcha solving task with Capsolver
   */
  async createTask(config: CaptchaTaskConfig): Promise<CreateTaskResponse> {
    try {
      const response = await this.client.post("/createTask", {
        clientKey: this.apiKey,
        task: {
          type: config.type,
          websiteURL: config.websiteURL,
          websiteKey: config.websiteKey,
          ...config.additionalParams,
        },
      });

      const parsed = CapsolverCreateTaskSchema.parse(response.data);

      return {
        errorId: parsed.errorId,
        ...(parsed.errorCode !== undefined && { errorCode: parsed.errorCode }),
        ...(parsed.errorDescription !== undefined && { errorDescription: parsed.errorDescription }),
        ...(parsed.taskId !== undefined && { taskId: parsed.taskId }),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Capsolver API request failed: ${error.message}${
            error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ""
          }`
        );
      }
      throw new Error(`Failed to create Capsolver task: ${error}`);
    }
  }

  /**
   * Get the result of a captcha solving task from Capsolver
   */
  async getTaskResult(taskId: string): Promise<CaptchaTaskResult> {
    try {
      const response = await this.client.post("/getTaskResult", {
        clientKey: this.apiKey,
        taskId: taskId,
      });

      const parsed = CapsolverResponseSchema.parse(response.data);

      return {
        errorId: parsed.errorId,
        ...(parsed.errorCode !== undefined && { errorCode: parsed.errorCode }),
        ...(parsed.errorDescription !== undefined && { errorDescription: parsed.errorDescription }),
        status: parsed.status,
        ...(parsed.solution !== undefined && {
          solution: {
            gRecaptchaResponse: parsed.solution.gRecaptchaResponse,
            userAgent: parsed.solution.userAgent,
          }
        }),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Capsolver API request failed: ${error.message}${
            error.response?.data ? ` - ${JSON.stringify(error.response.data)}` : ""
          }`
        );
      }
      throw new Error(`Failed to get Capsolver task result: ${error}`);
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
      maxAttempts = CapsolverProvider.DEFAULT_MAX_ATTEMPTS,
      pollInterval = CapsolverProvider.DEFAULT_POLL_INTERVAL,
    } = options;

    // Step 1: Create the task
    console.log("Creating Capsolver task...");
    const createResponse = await this.createTask(config);

    if (createResponse.errorId !== 0) {
      throw new Error(
        `Failed to create Capsolver task: ${
          createResponse.errorDescription || createResponse.errorCode || "Unknown error"
        }`
      );
    }

    if (!createResponse.taskId) {
      throw new Error("No task ID returned from Capsolver");
    }

    console.log(`Waiting for Capsolver task ${createResponse.taskId} result...`);

    // Step 2: Poll for results
    let attempts = 0;
    while (attempts < maxAttempts) {
      const result = await this.getTaskResult(createResponse.taskId);

      if (result.status === "ready") {
        if (result.errorId === 1) {
          throw new Error(
            `Capsolver task failed: ${
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
 * Factory function to create a Capsolver provider instance
 */
export function createCapsolverProvider(config: CapsolverConfig): CapsolverProvider {
  return new CapsolverProvider(config);
}
