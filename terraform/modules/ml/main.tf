# ML Module - SageMaker Serverless Inference
# Provides ML-based optimal call time predictions

# IAM Role for SageMaker Execution
resource "aws_iam_role" "sagemaker_execution_role" {
  name = "${var.project_name}-${var.environment}-sagemaker-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-sagemaker-execution-role"
  })
}

# IAM Policy for SageMaker to access S3 and CloudWatch
resource "aws_iam_role_policy" "sagemaker_execution_policy" {
  name = "${var.project_name}-${var.environment}-sagemaker-execution-policy"
  role = aws_iam_role.sagemaker_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.ml_models_bucket}",
          "arn:aws:s3:::${var.ml_models_bucket}/*"
        ]
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
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# SageMaker Model
# Note: This assumes a model artifact exists in S3 at the specified path
# The model artifact should be a tar.gz file containing model.pkl and inference code
resource "aws_sagemaker_model" "optimal_call_time_predictor" {
  name               = "${var.project_name}-${var.environment}-optimal-call-time-model"
  execution_role_arn = aws_iam_role.sagemaker_execution_role.arn

  primary_container {
    # Using scikit-learn container for Python-based ML models
    # Update the image URI based on your region and model framework
    image = var.sagemaker_container_image

    # Model artifact location in S3
    # This should point to a .tar.gz file containing your trained model
    model_data_url = "s3://${var.ml_models_bucket}/models/optimal-call-time/model.tar.gz"

    environment = {
      SAGEMAKER_PROGRAM          = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY = "s3://${var.ml_models_bucket}/models/optimal-call-time/code"
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-optimal-call-time-model"
  })
}

# SageMaker Serverless Inference Endpoint Configuration
resource "aws_sagemaker_endpoint_configuration" "serverless_config" {
  name = "${var.project_name}-${var.environment}-serverless-endpoint-config"

  production_variants {
    variant_name = "AllTraffic"
    model_name   = aws_sagemaker_model.optimal_call_time_predictor.name

    serverless_config {
      memory_size_in_mb = 1024 # 1024 MB as specified in requirements
      max_concurrency   = 200  # 200 max concurrency as specified in requirements
    }
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-serverless-endpoint-config"
  })
}

# SageMaker Serverless Inference Endpoint
resource "aws_sagemaker_endpoint" "serverless_endpoint" {
  name                 = "${var.project_name}-${var.environment}-optimal-call-time-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.serverless_config.name

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-optimal-call-time-endpoint"
  })
}

# IAM Role for Lambda to invoke SageMaker endpoint
resource "aws_iam_role" "lambda_sagemaker_invoke_role" {
  name = "${var.project_name}-${var.environment}-lambda-sagemaker-invoke-role"

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

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-lambda-sagemaker-invoke-role"
  })
}

# IAM Policy for Lambda to invoke SageMaker endpoint
resource "aws_iam_role_policy" "lambda_sagemaker_invoke_policy" {
  name = "${var.project_name}-${var.environment}-lambda-sagemaker-invoke-policy"
  role = aws_iam_role.lambda_sagemaker_invoke_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = aws_sagemaker_endpoint.serverless_endpoint.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Attach AWS managed policy for Lambda VPC execution (if Lambda needs VPC access)
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.lambda_sagemaker_invoke_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}
