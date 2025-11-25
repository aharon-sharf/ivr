# Messaging Module - SQS Queues and SNS Topics

# Dead Letter Queue for failed dial tasks
resource "aws_sqs_queue" "dial_tasks_dlq" {
  name                      = "${var.project_name}-dial-tasks-dlq-${var.environment}"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-dial-tasks-dlq-${var.environment}"
    }
  )
}

# Main Dial Tasks Queue
resource "aws_sqs_queue" "dial_tasks" {
  name                       = "${var.project_name}-dial-tasks-${var.environment}"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 days
  receive_wait_time_seconds  = 20     # Long polling

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dial_tasks_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-dial-tasks-${var.environment}"
    }
  )
}

# SNS Topic - Call Events
resource "aws_sns_topic" "call_events" {
  name = "${var.project_name}-call-events-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-call-events-${var.environment}"
    }
  )
}

# SNS Topic - Donation Events
resource "aws_sns_topic" "donation_events" {
  name = "${var.project_name}-donation-events-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-donation-events-${var.environment}"
    }
  )
}

# SNS Topic - Opt-out Events
resource "aws_sns_topic" "optout_events" {
  name = "${var.project_name}-optout-events-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-optout-events-${var.environment}"
    }
  )
}

# SNS Topic - Campaign Notifications
resource "aws_sns_topic" "campaign_notifications" {
  name = "${var.project_name}-campaign-notifications-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-campaign-notifications-${var.environment}"
    }
  )
}

# SNS Topic - CloudWatch Alarms
resource "aws_sns_topic" "alarms" {
  name = "${var.project_name}-alarms-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-alarms-${var.environment}"
    }
  )
}

# IAM Role for EventBridge Pipes
resource "aws_iam_role" "eventbridge_pipe_role" {
  name = "${var.project_name}-eventbridge-pipe-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "pipes.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-eventbridge-pipe-role-${var.environment}"
    }
  )
}

# IAM Policy for EventBridge Pipes to read from SQS
resource "aws_iam_role_policy" "eventbridge_pipe_sqs_policy" {
  name = "${var.project_name}-eventbridge-pipe-sqs-policy-${var.environment}"
  role = aws_iam_role.eventbridge_pipe_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.dial_tasks.arn
      }
    ]
  })
}

# IAM Policy for EventBridge Pipes to invoke Lambda functions
resource "aws_iam_role_policy" "eventbridge_pipe_lambda_policy" {
  name = "${var.project_name}-eventbridge-pipe-lambda-policy-${var.environment}"
  role = aws_iam_role.eventbridge_pipe_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          var.enrich_dial_task_lambda_arn,
          var.dialer_worker_lambda_arn
        ]
      }
    ]
  })
}

# EventBridge Pipe: SQS dial-tasks to Dialer Worker Lambda
resource "aws_pipes_pipe" "dial_tasks_to_dialer_worker" {
  name     = "${var.project_name}-dial-tasks-to-dialer-worker-${var.environment}"
  role_arn = aws_iam_role.eventbridge_pipe_role.arn

  source = aws_sqs_queue.dial_tasks.arn
  target = var.dialer_worker_lambda_arn

  source_parameters {
    sqs_queue_parameters {
      batch_size                         = 10
      maximum_batching_window_in_seconds = 5
    }

    filter_criteria {
      filter {
        pattern = jsonencode({
          phoneNumber = [{ exists = true }]
        })
      }
    }
  }

  enrichment = var.enrich_dial_task_lambda_arn

  target_parameters {
    lambda_function_parameters {
      invocation_type = "REQUEST_RESPONSE"
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-dial-tasks-to-dialer-worker-${var.environment}"
    }
  )
}
