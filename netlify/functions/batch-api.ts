import type { Handler } from "@netlify/functions";
import { RateLimiter, batchWithConcurrency, withRateLimit } from "../lib/rate-limiter.js";
import { initSentry, captureError, summarizeErrorForLog } from "../lib/sentry.js";

initSentry();

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
} as const;

type TaskType = "optimize" | "predict-questions" | "generate-cover-letter";

type BatchTask = {
  id: string; // Client-provided ID to match responses
  type: TaskType;
  payload: any;
};

type BatchResponse = {
  id: string;
  type: TaskType;
  status: "success" | "error";
  data?: any;
  error?: string;
};

type BatchRequest = {
  tasks: BatchTask[];
  options?: {
    concurrency?: number;
    continueOnError?: boolean;
  };
};

const NETLIFY_BASE = process.env.URL || "http://localhost:8888";
const INTERNAL_ENDPOINTS: Record<TaskType, string> = {
  optimize: "/.netlify/functions/optimize",
  "predict-questions": "/.netlify/functions/predict-questions",
  "generate-cover-letter": "/.netlify/functions/generate-cover-letter",
};

const rateLimiter = new RateLimiter({
  maxConcurrent: 3,
  minDelayBetweenRequestsMs: 300,
  maxRequestsPerMinute: 15,
});

/**
 * Execute a single task by calling the appropriate internal endpoint
 */
async function executeTask(task: BatchTask, authHeader?: string): Promise<BatchResponse> {
  const endpoint = INTERNAL_ENDPOINTS[task.type];

  if (!endpoint) {
    return {
      id: task.id,
      type: task.type,
      status: "error",
      error: `Unknown task type: ${task.type}`,
    };
  }

  try {
    const url = `${NETLIFY_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Forward Authorization header if provided
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(task.payload),
    });

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        id: task.id,
        type: task.type,
        status: "error",
        error: data.error || data.message || `Request failed with status ${response.status}`,
      };
    }

    return {
      id: task.id,
      type: task.type,
      status: "success",
      data,
    };
  } catch (error) {
    console.error("[batch-api] Task execution failed:", summarizeErrorForLog(error));
    return {
      id: task.id,
      type: task.type,
      status: "error",
      error: "Batch item failed",
    };
  }
}

/**
 * Validate batch request
 */
function validateBatchRequest(body: any): { valid: boolean; error?: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  if (!Array.isArray(body.tasks)) {
    return { valid: false, error: "tasks must be an array" };
  }

  if (body.tasks.length === 0) {
    return { valid: false, error: "tasks array cannot be empty" };
  }

  if (body.tasks.length > 10) {
    return { valid: false, error: "Maximum 10 tasks allowed per batch" };
  }

  for (let i = 0; i < body.tasks.length; i++) {
    const task = body.tasks[i];

    if (!task || typeof task !== "object") {
      return { valid: false, error: `Task at index ${i} must be an object` };
    }

    if (!task.id || typeof task.id !== "string") {
      return { valid: false, error: `Task at index ${i} must have a string 'id'` };
    }

    if (!task.type || typeof task.type !== "string") {
      return { valid: false, error: `Task at index ${i} must have a string 'type'` };
    }

    if (!INTERNAL_ENDPOINTS[task.type as TaskType]) {
      return {
        valid: false,
        error: `Task at index ${i} has invalid type '${task.type}'. Valid types: ${Object.keys(INTERNAL_ENDPOINTS).join(", ")}`,
      };
    }

    if (!task.payload) {
      return { valid: false, error: `Task at index ${i} must have a 'payload' property` };
    }
  }

  return { valid: true };
}

const baseHandler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Extract auth header from headers
  const authHeader = event.headers["authorization"] || event.headers["Authorization"];

  // Note: No separate batch quota check needed here.
  // Child tasks (extract, match, etc.) consume their own quotas when called.

  try {
    const body: BatchRequest = event.body ? JSON.parse(event.body) : {};

    // Validate request
    const validation = validateBatchRequest(body);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: HEADERS,
        body: JSON.stringify({ error: validation.error }),
      };
    }

    const { tasks, options = {} } = body;
    const { concurrency = 3, continueOnError = true } = options;

    console.log(`[batch-api] Processing ${tasks.length} tasks with concurrency ${concurrency}`);

    // Execute tasks with rate limiting and concurrency control
    const results = await batchWithConcurrency(
      tasks,
      async (task) => {
        const result = await executeTask(task, authHeader);

        // If continueOnError is false and we hit an error, throw to stop batch
        if (!continueOnError && result.status === "error") {
          throw new Error(result.error || "Task failed");
        }

        return result;
      },
      {
        concurrency,
        rateLimiter,
        onProgress: (completed, total) => {
          console.log(`[batch-api] Progress: ${completed}/${total} tasks completed`);
        },
      }
    );

    // Convert PromiseSettledResult to BatchResponse
    const responses: BatchResponse[] = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        // This happens if continueOnError is false and a task failed
        return {
          id: tasks[index].id,
          type: tasks[index].type,
          status: "error",
          error: result.reason?.message || "Task execution failed",
        };
      }
    });

    // Calculate summary stats
    const successCount = responses.filter((r) => r.status === "success").length;
    const errorCount = responses.filter((r) => r.status === "error").length;

    console.log(`[batch-api] Completed: ${successCount} success, ${errorCount} errors`);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        results: responses,
        summary: {
          total: tasks.length,
          successful: successCount,
          failed: errorCount,
        },
      }),
    };
  } catch (error) {
    console.error("[batch-api] Fatal error:", summarizeErrorForLog(error));
    captureError(error, {
      function: 'batch-api',
      errorMessage: error instanceof Error ? error.message : "Batch processing failed",
    });

    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({
        error: "Batch processing failed",
        hint: "Check that all task payloads are valid for their respective endpoints",
      }),
    };
  }
};

export const handler = withRateLimit("batch-api", baseHandler);
