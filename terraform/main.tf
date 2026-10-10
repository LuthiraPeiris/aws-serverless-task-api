// Terraform configuration for AWS provider and resources
terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }

  required_version = ">= 1.14.0"
}

// AWS provider configuration
provider "aws" {
  region = "ap-south-1"
}

// DynamoDB table for tasks
resource "aws_dynamodb_table" "tasks" {
  name         = "serverless-tasks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

// Lambda execution role
resource "aws_iam_role" "lambda_execution_role" {
  name = "serverless-task-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "lambda.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}

// IAM policy for Lambda to access DynamoDB
resource "aws_iam_role_policy" "dynamodb_access" {
  name = "serverless-task-dynamodb-access"
  role = aws_iam_role.lambda_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:DeleteItem",
          "dynamodb:UpdateItem"
        ]

        Resource = aws_dynamodb_table.tasks.arn
      }
    ]
  })
}

// Attach AWSLambdaBasicExecutionRole policy to the Lambda execution role
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role = aws_iam_role.lambda_execution_role.name

  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

// Lambda function for the task API
resource "aws_lambda_function" "task_api" {
  function_name = "serverless-task-api"
  role          = aws_iam_role.lambda_execution_role.arn

  runtime = "nodejs24.x"
  handler = "index.handler"

  filename         = "${path.module}/../lambda/function.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambda/function.zip")

  timeout     = 10
  memory_size = 128

environment {
  variables = {
    TASKS_TABLE     = aws_dynamodb_table.tasks.name
    BEDROCK_MODEL_ID = "google.gemma-3-4b-it"
  }
}
}


# API Gateway HTTP API
resource "aws_apigatewayv2_api" "task_api" {
  name          = "serverless-task-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://luthirapeiris.github.io"
    ]


    
    allow_methods = ["GET", "POST", "DELETE", "PATCH", "OPTIONS"]
    allow_headers = ["content-type"]
  }
}

# Connect API Gateway to the existing Lambda function
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.task_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.task_api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# POST /tasks
resource "aws_apigatewayv2_route" "create_task" {
  api_id    = aws_apigatewayv2_api.task_api.id
  route_key = "POST /tasks"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# POST /plan - Generate an AI task plan
resource "aws_apigatewayv2_route" "generate_plan" {
  api_id    = aws_apigatewayv2_api.task_api.id
  route_key = "POST /plan"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# GET /tasks
resource "aws_apigatewayv2_route" "list_tasks" {
  api_id    = aws_apigatewayv2_api.task_api.id
  route_key = "GET /tasks"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# GET /tasks/{id}
resource "aws_apigatewayv2_route" "get_task" {
  api_id    = aws_apigatewayv2_api.task_api.id
  route_key = "GET /tasks/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# PATCH /tasks/{id}
resource "aws_apigatewayv2_route" "update_task" {
  api_id    = aws_apigatewayv2_api.task_api.id
  route_key = "PATCH /tasks/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}
# DELETE /tasks/{id}
resource "aws_apigatewayv2_route" "delete_task" {
  api_id    = aws_apigatewayv2_api.task_api.id
  route_key = "DELETE /tasks/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# Automatically deploy API changes
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.task_api.id
  name        = "$default"
  auto_deploy = true
}

# Allow only this API Gateway API to invoke the Lambda function
resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.task_api.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.task_api.execution_arn}/*/*/*"
}

# Display the API endpoint after deployment
output "api_gateway_url" {
  description = "Base URL for the Serverless Task API"
  value       = aws_apigatewayv2_api.task_api.api_endpoint
}
