
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
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

const tableName = process.env.TASKS_TABLE;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const handler = async (event) => {
  try {
    const method =
      event?.requestContext?.http?.method ?? event?.httpMethod;

    const taskId = event?.pathParameters?.id;

    // Ensure the Lambda environment is configured.
    if (!tableName) {
      console.error("TASKS_TABLE environment variable is missing.");

      return response(500, {
        message: "Internal server error."
      });
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
