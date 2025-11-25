# Monitoring Module - CloudWatch Dashboards and Alarms

data "aws_region" "current" {}

# ============================================================================
# CAMPAIGN OVERVIEW DASHBOARD
# ============================================================================

resource "aws_cloudwatch_dashboard" "campaign_overview" {
  dashboard_name = "${var.project_name}-${var.environment}-campaign-overview"

  dashboard_body = jsonencode({
    widgets = [
      # Active Calls Widget
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "ConcurrentExecutions", { stat = "Sum", label = "Active Calls" }]
          ]
          period = 60
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Active Calls"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 0
        y      = 0
      },
      # Queue Depth Widget
      {
        type = "metric"
        properties = {
          metrics = [
            for queue in var.sqs_queue_names : [
              "AWS/SQS",
              "ApproximateNumberOfMessagesVisible",
              "QueueName",
              queue,
              { stat = "Average", label = queue }
            ]
          ]
          period = 60
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Queue Depth"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 8
        y      = 0
      },
      # Dialing Rate Widget
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum", label = "Calls/Min" }]
          ]
          period = 60
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Dialing Rate (Calls per Minute)"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 16
        y      = 0
      },
      # Call Outcomes Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-dialer-worker'
            | fields @timestamp, outcome
            | stats count() by outcome
          EOT
          region  = data.aws_region.current.name
          title   = "Call Outcomes"
          stacked = false
        }
        width  = 12
        height = 6
        x      = 0
        y      = 6
      },
      # Campaign Progress Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-status-checker'
            | fields @timestamp, campaignId, completionPercentage
            | sort @timestamp desc
            | limit 20
          EOT
          region  = data.aws_region.current.name
          title   = "Campaign Progress"
          stacked = false
        }
        width  = 12
        height = 6
        x      = 12
        y      = 6
      }
    ]
  })

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs
  ]
}

# ============================================================================
# SYSTEM HEALTH DASHBOARD
# ============================================================================

resource "aws_cloudwatch_dashboard" "system_health" {
  dashboard_name = "${var.project_name}-${var.environment}-system-health"

  dashboard_body = jsonencode({
    widgets = [
      # Lambda Errors Widget
      {
        type = "metric"
        properties = {
          metrics = [
            for func in var.lambda_function_names : [
              "AWS/Lambda",
              "Errors",
              "FunctionName",
              func,
              { stat = "Sum", label = func }
            ]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Lambda Errors"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 0
        y      = 0
      },
      # Lambda Duration Widget
      {
        type = "metric"
        properties = {
          metrics = [
            for func in var.lambda_function_names : [
              "AWS/Lambda",
              "Duration",
              "FunctionName",
              func,
              { stat = "Average", label = func }
            ]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Lambda Duration (ms)"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 8
        y      = 0
      },
      # Lambda Throttles Widget
      {
        type = "metric"
        properties = {
          metrics = [
            for func in var.lambda_function_names : [
              "AWS/Lambda",
              "Throttles",
              "FunctionName",
              func,
              { stat = "Sum", label = func }
            ]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "Lambda Throttles"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 16
        y      = 0
      },
      # SQS Queue Backlog Widget
      {
        type = "metric"
        properties = {
          metrics = [
            for queue in var.sqs_queue_names : [
              "AWS/SQS",
              "ApproximateAgeOfOldestMessage",
              "QueueName",
              queue,
              { stat = "Maximum", label = queue }
            ]
          ]
          period = 300
          stat   = "Maximum"
          region = data.aws_region.current.name
          title  = "SQS Queue Age (seconds)"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 12
        height = 6
        x      = 0
        y      = 6
      },
      # EC2 CPU Utilization Widget
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", var.asterisk_instance_id, { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Asterisk EC2 CPU Utilization (%)"
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
        width  = 12
        height = 6
        x      = 12
        y      = 6
      },
      # RDS Connections Widget
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "RDS Database Connections"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 0
        y      = 12
      },
      # RDS CPU Widget
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "RDS CPU Utilization (%)"
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
        width  = 8
        height = 6
        x      = 8
        y      = 12
      },
      # RDS Storage Widget
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", var.rds_instance_id, { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "RDS Free Storage Space (bytes)"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 8
        height = 6
        x      = 16
        y      = 12
      }
    ]
  })

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs
  ]
}

# ============================================================================
# BUSINESS METRICS DASHBOARD
# ============================================================================

resource "aws_cloudwatch_dashboard" "business_metrics" {
  dashboard_name = "${var.project_name}-${var.environment}-business-metrics"

  dashboard_body = jsonencode({
    widgets = [
      # Answer Rate Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-dialer-worker'
            | fields @timestamp, outcome
            | filter outcome in ["answered", "busy", "failed", "no_answer"]
            | stats count() as total, 
                    sum(outcome = "answered") as answered
            | fields (answered / total * 100) as answer_rate_percent
          EOT
          region  = data.aws_region.current.name
          title   = "Answer Rate (%)"
          stacked = false
        }
        width  = 8
        height = 6
        x      = 0
        y      = 0
      },
      # Conversion Rate Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-dialer-worker'
            | fields @timestamp, outcome
            | filter outcome in ["answered", "converted"]
            | stats count() as total, 
                    sum(outcome = "converted") as converted
            | fields (converted / total * 100) as conversion_rate_percent
          EOT
          region  = data.aws_region.current.name
          title   = "Conversion Rate (%)"
          stacked = false
        }
        width  = 8
        height = 6
        x      = 8
        y      = 0
      },
      # Opt-Out Rate Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-optout-handler'
            | fields @timestamp
            | stats count() as optouts by bin(5m)
          EOT
          region  = data.aws_region.current.name
          title   = "Opt-Outs Over Time"
          stacked = false
        }
        width  = 8
        height = 6
        x      = 16
        y      = 0
      },
      # Cost Per Call Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-cdr-logger'
            | fields @timestamp, cost
            | stats avg(cost) as avg_cost_per_call, 
                    sum(cost) as total_cost,
                    count() as total_calls
          EOT
          region  = data.aws_region.current.name
          title   = "Cost Metrics"
          stacked = false
        }
        width  = 12
        height = 6
        x      = 0
        y      = 6
      },
      # Campaign Performance Comparison Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-analytics'
            | fields @timestamp, campaignId, answerRate, conversionRate
            | sort answerRate desc
            | limit 10
          EOT
          region  = data.aws_region.current.name
          title   = "Top Performing Campaigns"
          stacked = false
        }
        width  = 12
        height = 6
        x      = 12
        y      = 6
      },
      # SMS vs Voice Comparison Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-sms-gateway'
            | fields @timestamp, status
            | stats count() as sms_sent by status
          EOT
          region  = data.aws_region.current.name
          title   = "SMS Delivery Status"
          stacked = true
        }
        width  = 12
        height = 6
        x      = 0
        y      = 12
      },
      # TTS Fallback Usage Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-tts-fallback'
            | fields @timestamp
            | stats count() as tts_fallbacks by bin(5m)
          EOT
          region  = data.aws_region.current.name
          title   = "TTS Fallback Usage"
          stacked = false
        }
        width  = 12
        height = 6
        x      = 12
        y      = 12
      }
    ]
  })

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs
  ]
}

# ============================================================================
# CLOUDWATCH LOG GROUPS
# ============================================================================

resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = toset(var.lambda_function_names)

  name              = "/aws/lambda/${each.value}"
  retention_in_days = 30

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-${each.value}-logs"
    }
  )
}


# ============================================================================
# SNS TOPIC FOR ALARMS
# ============================================================================

resource "aws_sns_topic" "alarms" {
  name = "${var.project_name}-${var.environment}-alarms"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-alarms"
    }
  )
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count = length(var.alarm_email_endpoints)

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email_endpoints[count.index]
}

# ============================================================================
# CRITICAL ALARMS
# ============================================================================

# Lambda Error Rate Alarm (Critical: > 5%)
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-error-rate-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5
  alarm_description   = "Lambda ${each.value} error rate exceeds 5%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "(errors / invocations) * 100"
    label       = "Error Rate"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions = {
        FunctionName = each.value
      }
    }
  }

  metric_query {
    id = "invocations"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = 300
      stat        = "Sum"
      dimensions = {
        FunctionName = each.value
      }
    }
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-${each.value}-error-rate-critical"
      Severity = "Critical"
    }
  )
}

# SQS Queue Depth Alarm (Critical: > 10000 messages)
resource "aws_cloudwatch_metric_alarm" "sqs_queue_depth" {
  for_each = toset(var.sqs_queue_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-queue-depth-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 10000
  alarm_description   = "SQS queue ${each.value} depth exceeds 10000 messages"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-${each.value}-queue-depth-critical"
      Severity = "Critical"
    }
  )
}

# EC2 CPU Utilization Alarm (Critical: > 90%)
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_critical" {
  alarm_name          = "${var.project_name}-${var.environment}-asterisk-cpu-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 90
  alarm_description   = "Asterisk EC2 CPU utilization exceeds 90%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = var.asterisk_instance_id
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-asterisk-cpu-critical"
      Severity = "Critical"
    }
  )
}

# Lambda Throttles Alarm (Critical: Any throttles)
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-throttles-critical"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Lambda ${each.value} is being throttled"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-${each.value}-throttles-critical"
      Severity = "Critical"
    }
  )
}

# ============================================================================
# WARNING ALARMS
# ============================================================================

# Answer Rate Alarm (Warning: < 20%)
resource "aws_cloudwatch_metric_alarm" "low_answer_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-low-answer-rate-warning"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  threshold           = 20
  alarm_description   = "Campaign answer rate is below 20%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "answer_rate"
    expression  = "(answered / total_calls) * 100"
    label       = "Answer Rate"
    return_data = true
  }

  metric_query {
    id = "answered"
    metric {
      metric_name = "AnsweredCalls"
      namespace   = "${var.project_name}/${var.environment}"
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "total_calls"
    metric {
      metric_name = "TotalCalls"
      namespace   = "${var.project_name}/${var.environment}"
      period      = 300
      stat        = "Sum"
    }
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-low-answer-rate-warning"
      Severity = "Warning"
    }
  )
}

# RDS Connections Alarm (Warning: > 80% of max)
resource "aws_cloudwatch_metric_alarm" "rds_connections_warning" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-connections-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_max_connections * 0.8
  alarm_description   = "RDS connections exceed 80% of maximum"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-rds-connections-warning"
      Severity = "Warning"
    }
  )
}

# EC2 CPU Utilization Alarm (Warning: > 70%)
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_warning" {
  alarm_name          = "${var.project_name}-${var.environment}-asterisk-cpu-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 70
  alarm_description   = "Asterisk EC2 CPU utilization exceeds 70%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = var.asterisk_instance_id
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-asterisk-cpu-warning"
      Severity = "Warning"
    }
  )
}

# RDS Storage Space Alarm (Warning: < 20% free)
resource "aws_cloudwatch_metric_alarm" "rds_storage_warning" {
  alarm_name          = "${var.project_name}-${var.environment}-rds-storage-warning"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.rds_allocated_storage * 1073741824 * 0.2 # 20% of allocated storage in bytes
  alarm_description   = "RDS free storage space is below 20%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-rds-storage-warning"
      Severity = "Warning"
    }
  )
}

# Lambda Duration Alarm (Warning: approaching timeout)
resource "aws_cloudwatch_metric_alarm" "lambda_duration_warning" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-duration-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = var.lambda_timeout_ms * 0.8 # 80% of timeout
  alarm_description   = "Lambda ${each.value} duration approaching timeout"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-${each.value}-duration-warning"
      Severity = "Warning"
    }
  )
}

# SQS Dead Letter Queue Alarm (Warning: Any messages)
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  for_each = toset(var.sqs_dlq_names)

  alarm_name          = "${var.project_name}-${var.environment}-${each.value}-dlq-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "Dead letter queue ${each.value} has messages"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = each.value
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-${each.value}-dlq-warning"
      Severity = "Warning"
    }
  )
}

# High Opt-Out Rate Alarm (Warning: > 5%)
resource "aws_cloudwatch_metric_alarm" "high_optout_rate" {
  alarm_name          = "${var.project_name}-${var.environment}-high-optout-rate-warning"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5
  alarm_description   = "Opt-out rate exceeds 5%"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "optout_rate"
    expression  = "(optouts / total_calls) * 100"
    label       = "Opt-Out Rate"
    return_data = true
  }

  metric_query {
    id = "optouts"
    metric {
      metric_name = "OptOuts"
      namespace   = "${var.project_name}/${var.environment}"
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "total_calls"
    metric {
      metric_name = "TotalCalls"
      namespace   = "${var.project_name}/${var.environment}"
      period      = 300
      stat        = "Sum"
    }
  }

  tags = merge(
    var.tags,
    {
      Name     = "${var.project_name}-${var.environment}-high-optout-rate-warning"
      Severity = "Warning"
    }
  )
}


# ============================================================================
# AWS X-RAY TRACING
# ============================================================================

# X-Ray Sampling Rule - Default rule for all Lambda functions
resource "aws_xray_sampling_rule" "default" {
  rule_name      = "${var.project_name}-${var.environment}-default-sampling"
  priority       = 1000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.05 # Sample 5% of requests
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-default-sampling"
    }
  )
}

# X-Ray Sampling Rule - High priority for critical Lambda functions
resource "aws_xray_sampling_rule" "critical_functions" {
  rule_name      = "${var.project_name}-${var.environment}-critical-sampling"
  priority       = 100
  version        = 1
  reservoir_size = 5
  fixed_rate     = 0.20 # Sample 20% of requests for critical functions
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "AWS::Lambda::Function"
  service_name   = "${var.project_name}-${var.environment}-*"
  resource_arn   = "*"

  attributes = {
    FunctionName = "*dialer-worker*,*dispatcher*,*api-handler*"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-critical-sampling"
    }
  )
}

# X-Ray Sampling Rule - Error traces (100% sampling)
resource "aws_xray_sampling_rule" "error_traces" {
  rule_name      = "${var.project_name}-${var.environment}-error-sampling"
  priority       = 1
  version        = 1
  reservoir_size = 10
  fixed_rate     = 1.0 # Sample 100% of error traces
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-error-sampling"
    }
  )
}

# X-Ray Group - Campaign Execution Traces
resource "aws_xray_group" "campaign_execution" {
  group_name        = "${var.project_name}-${var.environment}-campaign-execution"
  filter_expression = "service(\"${var.project_name}-${var.environment}-dispatcher\") OR service(\"${var.project_name}-${var.environment}-dialer-worker\")"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = false
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-campaign-execution"
    }
  )
}

# X-Ray Group - API Request Traces
resource "aws_xray_group" "api_requests" {
  group_name        = "${var.project_name}-${var.environment}-api-requests"
  filter_expression = "service(\"${var.project_name}-${var.environment}-api-handler\")"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = false
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-api-requests"
    }
  )
}

# X-Ray Group - Error Traces
resource "aws_xray_group" "errors" {
  group_name        = "${var.project_name}-${var.environment}-errors"
  filter_expression = "error = true OR fault = true"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-errors"
    }
  )
}

# X-Ray Group - High Latency Traces
resource "aws_xray_group" "high_latency" {
  group_name        = "${var.project_name}-${var.environment}-high-latency"
  filter_expression = "duration >= 5"

  insights_configuration {
    insights_enabled      = true
    notifications_enabled = false
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}-high-latency"
    }
  )
}

# CloudWatch Dashboard for X-Ray Metrics
resource "aws_cloudwatch_dashboard" "xray_metrics" {
  dashboard_name = "${var.project_name}-${var.environment}-xray-metrics"

  dashboard_body = jsonencode({
    widgets = [
      # Service Map Widget
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/X-Ray", "TracesProcessed", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "X-Ray Traces Processed"
          yAxis = {
            left = {
              min = 0
            }
          }
        }
        width  = 12
        height = 6
        x      = 0
        y      = 0
      },
      # Error Rate Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-dialer-worker'
            | fields @timestamp, @message
            | filter @message like /ERROR/
            | stats count() as error_count by bin(5m)
          EOT
          region  = data.aws_region.current.name
          title   = "Error Traces Over Time"
          stacked = false
        }
        width  = 12
        height = 6
        x      = 12
        y      = 0
      },
      # Latency Distribution Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-api-handler'
            | fields @timestamp, @duration
            | stats avg(@duration) as avg_duration, 
                    max(@duration) as max_duration,
                    pct(@duration, 95) as p95_duration,
                    pct(@duration, 99) as p99_duration
          EOT
          region  = data.aws_region.current.name
          title   = "API Latency Distribution"
          stacked = false
        }
        width  = 12
        height = 6
        x      = 0
        y      = 6
      },
      # Service Dependencies Widget
      {
        type = "log"
        properties = {
          query   = <<-EOT
            SOURCE '/aws/lambda/${var.project_name}-${var.environment}-dispatcher'
            | fields @timestamp, @message
            | filter @message like /downstream/
            | stats count() as call_count by service
          EOT
          region  = data.aws_region.current.name
          title   = "Service Dependencies"
          stacked = true
        }
        width  = 12
        height = 6
        x      = 12
        y      = 6
      }
    ]
  })

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs
  ]
}
