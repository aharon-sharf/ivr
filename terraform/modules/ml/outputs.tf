# ML Module Outputs

output "endpoint_name" {
  description = "SageMaker Serverless Inference endpoint name"
  value       = aws_sagemaker_endpoint.serverless_endpoint.name
}

output "endpoint_arn" {
  description = "SageMaker Serverless Inference endpoint ARN"
  value       = aws_sagemaker_endpoint.serverless_endpoint.arn
}

output "model_name" {
  description = "SageMaker model name"
  value       = aws_sagemaker_model.optimal_call_time_predictor.name
}

output "sagemaker_execution_role_arn" {
  description = "IAM role ARN for SageMaker execution"
  value       = aws_iam_role.sagemaker_execution_role.arn
}

output "lambda_sagemaker_invoke_role_arn" {
  description = "IAM role ARN for Lambda to invoke SageMaker endpoint"
  value       = aws_iam_role.lambda_sagemaker_invoke_role.arn
}

output "lambda_sagemaker_invoke_role_name" {
  description = "IAM role name for Lambda to invoke SageMaker endpoint"
  value       = aws_iam_role.lambda_sagemaker_invoke_role.name
}
