
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

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event));

  try {
    const method =
      event?.requestContext?.http?.method ?? event?.httpMethod;

    const taskId = event?.pathParameters?.id;

    if (method === "POST") {
      const body =
        typeof event.body === "string"
          ? JSON.parse(event.body)
          : event.body;

      const title = body?.title?.trim();

      if (!title) {
        return response(400, {
          message: "The title field is required."
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

      return response(200, { task: result.Item });
    }

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
    console.error("Error processing task request:", error);

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
