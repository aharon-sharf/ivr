# Orchestration Module - Step Functions and EventBridge

# IAM Role for Step Functions
resource "aws_iam_role" "step_functions_role" {
  name = "${var.project_name}-step-functions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for Step Functions to invoke Lambda and publish to SNS
resource "aws_iam_role_policy" "step_functions_policy" {
  name = "${var.project_name}-step-functions-policy"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          var.validate_campaign_lambda_arn,
          var.dispatcher_lambda_arn,
          var.status_checker_lambda_arn,
          var.report_generator_lambda_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = var.campaign_notifications_topic_arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Log Group for Step Functions
resource "aws_cloudwatch_log_group" "step_functions_log_group" {
  name              = "/aws/stepfunctions/${var.project_name}-campaign-execution"
  retention_in_days = var.log_retention_days

  tags = var.tags
}

# Step Functions State Machine for Campaign Execution
resource "aws_sfn_state_machine" "campaign_execution" {
  name     = "${var.project_name}-campaign-execution"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = templatefile("${path.module}/campaign-execution-state-machine.json", {
    validate_campaign_lambda_arn     = var.validate_campaign_lambda_arn
    dispatcher_lambda_arn            = var.dispatcher_lambda_arn
    status_checker_lambda_arn        = var.status_checker_lambda_arn
    report_generator_lambda_arn      = var.report_generator_lambda_arn
    campaign_notifications_topic_arn = var.campaign_notifications_topic_arn
  })

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.step_functions_log_group.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }

  tags = var.tags
}

# EventBridge Rule to trigger Step Functions on campaign schedule
resource "aws_cloudwatch_event_rule" "campaign_scheduler" {
  name                = "${var.project_name}-campaign-scheduler"
  description         = "Triggers campaign execution at scheduled time"
  schedule_expression = "rate(1 minute)" # This will be overridden by dynamic rules per campaign

  tags = var.tags
}

# EventBridge Target to invoke Step Functions
resource "aws_cloudwatch_event_target" "campaign_execution_target" {
  rule      = aws_cloudwatch_event_rule.campaign_scheduler.name
  target_id = "CampaignExecutionStateMachine"
  arn       = aws_sfn_state_machine.campaign_execution.arn
  role_arn  = aws_iam_role.eventbridge_role.arn

  input_transformer {
    input_paths = {
      campaignId = "$.detail.campaignId"
    }
    input_template = <<EOF
{
  "campaignId": <campaignId>,
  "executionSource": "scheduled"
}
EOF
  }
}

# IAM Role for EventBridge to invoke Step Functions
resource "aws_iam_role" "eventbridge_role" {
  name = "${var.project_name}-eventbridge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for EventBridge to invoke Step Functions
resource "aws_iam_role_policy" "eventbridge_policy" {
  name = "${var.project_name}-eventbridge-policy"
  role = aws_iam_role.eventbridge_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "states:StartExecution"
        ]
        Resource = aws_sfn_state_machine.campaign_execution.arn
      }
    ]
  })
}

# CloudWatch Alarms for Step Functions monitoring
resource "aws_cloudwatch_metric_alarm" "step_functions_failed_executions" {
  alarm_name          = "${var.project_name}-step-functions-failed-executions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ExecutionsFailed"
  namespace           = "AWS/States"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "Alert when Step Functions executions fail"
  alarm_actions       = [var.alarm_sns_topic_arn]

  dimensions = {
    StateMachineArn = aws_sfn_state_machine.campaign_execution.arn
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "step_functions_execution_time" {
  alarm_name          = "${var.project_name}-step-functions-execution-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ExecutionTime"
  namespace           = "AWS/States"
  period              = "300"
  statistic           = "Average"
  threshold           = "3600000" # 1 hour in milliseconds
  alarm_description   = "Alert when Step Functions execution time exceeds 1 hour"
  alarm_actions       = [var.alarm_sns_topic_arn]

  dimensions = {
    StateMachineArn = aws_sfn_state_machine.campaign_execution.arn
  }

  tags = var.tags
}
