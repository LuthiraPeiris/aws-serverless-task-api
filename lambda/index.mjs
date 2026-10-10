
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BedrockRuntimeClient,
  ConverseCommand
} from "@aws-sdk/client-bedrock-runtime";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  GetCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";


const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "ap-south-1"
});

const modelId =
  process.env.BEDROCK_MODEL_ID || "google.gemma-3-4b-it";

const tableName = process.env.TASKS_TABLE;


const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const handler = async (event) => {
  try {
    const method =
      event?.requestContext?.http?.method ?? event?.httpMethod;

    const taskId = event?.pathParameters?.id;
    const rawPath = event?.rawPath ?? event?.path ?? "";
    const path = rawPath.replace(/\/+$/, "") || "/";

    // Ensure the Lambda environment is configured.
    if (!tableName) {
      console.error("TASKS_TABLE environment variable is missing.");

      return response(500, {
        message: "Internal server error."
      });
    }

    // Create a task.
    // Generate an AI task plan.
if (method === "POST" && path.endsWith("/plan")) {
  let body;

  try {
    body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event.body;
  } catch {
    return response(400, {
      message: "Request body must contain valid JSON."
    });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.goal !== "string" ||
    !body.goal.trim()
  ) {
    return response(400, {
      message: "Provide a non-empty goal."
    });
  }

  const goal = body.goal.trim();

  if (goal.length > 500) {
    return response(400, {
      message: "The goal must not exceed 500 characters."
    });
  }

  const command = new ConverseCommand({
    modelId,
    system: [
      {
        text: "You are a friendly productivity planning assistant. Create realistic, actionable task plans suited to the user's goal. Return only valid JSON, with no Markdown fences or extra text."
      }
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            text: `Create exactly 5 tasks for this goal: "${goal}". Return a JSON object with "planTitle" and "tasks". Each task must contain "title", "description", and "day". Use day numbers 1 through 5.`
          }
        ]
      }
    ],
    inferenceConfig: {
      maxTokens: 1500,
      temperature: 0.3
    }
  });

  const result = await bedrock.send(command);
  const outputText = result.output?.message?.content
    ?.find((item) => item.text)?.text;

  if (!outputText) {
    return response(502, {
      message: "The AI returned an empty response. Please try again."
    });
  }
  
let plan;

try {
  // Small models sometimes wrap their output in Markdown code fences
  // (e.g. ```json ... ```) despite being instructed not to.
  // Strip a single leading and trailing fence before parsing.
  const cleaned = outputText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  plan = JSON.parse(cleaned);
} catch (error) {
  console.error("Bedrock response could not be parsed:", {
    error: error.message,
    output: outputText.slice(0, 500)
  });

  return response(502, {
    message: "The AI returned an invalid plan. Please try again."
  });
}

  // Step 1: Validate the top-level shape before touching tasks.
  if (
    !plan ||
    typeof plan !== "object" ||
    Array.isArray(plan) ||
    typeof plan.planTitle !== "string" ||
    !plan.planTitle.trim() ||
    !Array.isArray(plan.tasks) ||
    plan.tasks.length !== 5
  ) {
    return response(502, {
      message: "The AI returned a plan in an unexpected format. Please try again."
    });
  }

  // Step 2: Sort by day, then verify each day is a unique integer 1–5
  // and that every task has non-empty title and description.
  const sortedTasks = [...plan.tasks].sort((a, b) => a.day - b.day);

  const validTasks = sortedTasks.every(
    (task, index) =>
      task !== null &&
      typeof task === "object" &&
      typeof task.title === "string" &&
      task.title.trim().length > 0 &&
      typeof task.description === "string" &&
      task.description.trim().length > 0 &&
      Number.isInteger(task.day) &&
      task.day === index + 1   // after sort: must be 1, 2, 3, 4, 5 with no gaps or duplicates
  );

  if (!validTasks) {
    return response(502, {
      message: "The AI returned a plan in an unexpected format. Please try again."
    });
  }

  // Return tasks in ascending day order regardless of how the model produced them.
  return response(200, { plan: { planTitle: plan.planTitle, tasks: sortedTasks } });
}

// Create a task.
if (method === "POST") {
      let body;

      try {
        body =
          typeof event.body === "string"
            ? JSON.parse(event.body)
            : event.body;
      } catch {
        return response(400, {
          message: "Request body must contain valid JSON."
        });
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return response(400, {
          message: "Request body must be a JSON object."
        });
      }

      if (typeof body.title !== "string") {
        return response(400, {
          message: "The title field must be a string."
        });
      }

      const title = body.title.trim();

      if (!title) {
        return response(400, {
          message: "The title field is required."
        });
      }

      if (title.length > 200) {
        return response(400, {
          message: "The title must not exceed 200 characters."
        });
      }

      const task = {
        id: randomUUID(),
        title,
        createdAt: new Date().toISOString()
      };

      await dynamodb.send(
        new PutCommand({
          TableName: tableName,
          Item: task
        })
      );

      return response(201, {
        message: "Task created successfully.",
        task
      });
    }

    // Validate task IDs before retrieving or deleting tasks.
    if (
      (method === "GET" || method === "DELETE") &&
      taskId &&
      !UUID_PATTERN.test(taskId)
    ) {
      return response(400, {
        message: "The task ID must be a valid UUID."
      });
    }

    // Retrieve one task.
    if (method === "GET" && taskId) {
      const result = await dynamodb.send(
        new GetCommand({
          TableName: tableName,
          Key: { id: taskId }
        })
      );

      if (!result.Item) {
        return response(404, {
          message: "Task not found."
        });
      }

      return response(200, {
        task: result.Item
      });
    }

    // Retrieve all tasks.
    if (method === "GET") {
      const result = await dynamodb.send(
        new ScanCommand({
          TableName: tableName
        })
      );

      return response(200, {
        tasks: result.Items ?? []
      });
    }

    // Delete one task.
    if (method === "DELETE" && taskId) {
      await dynamodb.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { id: taskId }
        })
      );

      return response(200, {
        message: "Task deleted successfully.",
        id: taskId
      });
    }

    return response(400, {
      message:
        "Unsupported request. Use POST, GET /tasks, GET /tasks/{id}, or DELETE /tasks/{id}."
    });
  } catch (error) {
    // Log diagnostic information without logging the full request.
    console.error("Error processing task request:", {
      name: error?.name,
      message: error?.message
    });

    return response(500, {
      message: "Internal server error."
    });
  }
};

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  };
}
