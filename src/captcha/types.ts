/**
 * Generic CAPTCHA Provider Interface
 * This interface defines the contract that all captcha solving providers must implement
 */

/**
 * Configuration for creating a captcha solving task
 */
export interface CaptchaTaskConfig {
  /** The URL of the website containing the captcha */
  websiteURL: string;
  /** The site key of the reCAPTCHA widget */
  websiteKey: string;
  /** The type of captcha task (e.g., 'ReCaptchaV2Task', 'ReCaptchaV3Task') */
  type: string;
  /** Additional optional parameters specific to the task type */
  additionalParams?: Record<string, any>;
}

/**
 * The solution data returned by the captcha provider
 */
export interface CaptchaSolution {
  /** The solved captcha response token */
  gRecaptchaResponse: string;
  /** User agent used during solving (optional) */
  userAgent?: string;
  /** Additional solution data specific to the provider */
  additionalData?: Record<string, any>;
}

/**
 * The status of a captcha solving task
 */
export type CaptchaTaskStatus = 'idle' | 'processing' | 'ready';

/**
 * Response from a captcha provider when checking task status
 */
export interface CaptchaTaskResult {
  /** Error ID: 0 = no error, 1 = error occurred */
  errorId: number;
  /** Error code if an error occurred */
  errorCode?: string;
  /** Human-readable error description */
  errorDescription?: string;
  /** Current status of the task */
  status: CaptchaTaskStatus;
  /** The solution data (only available when status is 'ready' and errorId is 0) */
  solution?: CaptchaSolution;
}

/**
 * Response when creating a new captcha task
 */
export interface CreateTaskResponse {
  /** Error ID: 0 = success, 1 = error */
  errorId: number;
  /** Error code if task creation failed */
  errorCode?: string;
  /** Error description if task creation failed */
  errorDescription?: string;
  /** The unique task ID for polling results */
  taskId?: string;
}

/**
 * Configuration options for polling task results
 */
export interface PollingOptions {
  /** Maximum number of polling attempts (default: 60) */
  maxAttempts?: number;
  /** Interval between polling attempts in milliseconds (default: 5000) */
  pollInterval?: number;
}

/**
 * Generic interface that all captcha solving providers must implement
 */
export interface CaptchaProvider {
  /** The name/identifier of this provider */
  readonly name: string;
  
  /**
   * Create a new captcha solving task
   * @param config The task configuration
   * @returns Promise that resolves to the task creation response
   */
  createTask(config: CaptchaTaskConfig): Promise<CreateTaskResponse>;
  
  /**
   * Get the result of a captcha solving task
   * @param taskId The unique task ID
   * @returns Promise that resolves to the task result
   */
  getTaskResult(taskId: string): Promise<CaptchaTaskResult>;
  
  /**
   * Poll for task completion and return the final result
   * This is a convenience method that combines createTask and repeated getTaskResult calls
   * @param config The task configuration
   * @param options Optional polling configuration
   * @returns Promise that resolves to the final solved captcha solution
   * @throws Error if the task fails or times out
   */
  solveCaptcha(config: CaptchaTaskConfig, options?: PollingOptions): Promise<CaptchaSolution>;
}

