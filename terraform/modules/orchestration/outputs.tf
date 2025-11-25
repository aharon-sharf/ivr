# Orchestration Module Outputs

output "state_machine_arn" {
  description = "Campaign execution Step Functions state machine ARN"
  value       = aws_sfn_state_machine.campaign_execution.arn
}

output "state_machine_name" {
  description = "Campaign execution Step Functions state machine name"
  value       = aws_sfn_state_machine.campaign_execution.name
}

output "step_functions_role_arn" {
  description = "IAM role ARN for Step Functions"
  value       = aws_iam_role.step_functions_role.arn
}

output "eventbridge_scheduler_rule_name" {
  description = "EventBridge rule name for campaign scheduler"
  value       = aws_cloudwatch_event_rule.campaign_scheduler.name
}
