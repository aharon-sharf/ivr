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

# Lambda Event Source Mapping - Connect SQS to Dialer Worker
resource "aws_lambda_event_source_mapping" "dial_tasks_to_dialer_worker" {
  event_source_arn                   = aws_sqs_queue.dial_tasks.arn
  function_name                      = var.dialer_worker_lambda_arn
  batch_size                         = 10
  maximum_batching_window_in_seconds = 5

  filter_criteria {
    filter {
      pattern = jsonencode({
        body = {
          phoneNumber = [{ exists = true }]
        }
      })
    }
  }

  function_response_types = ["ReportBatchItemFailures"]
}
