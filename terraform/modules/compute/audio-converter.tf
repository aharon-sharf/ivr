# Audio Converter Lambda Function
resource "aws_lambda_function" "audio_converter" {
  function_name = "${var.project_name}-audio-converter-${var.environment}"
  role          = aws_iam_role.lambda_execution.arn

  package_type = "Image"
  image_uri    = "${var.ecr_repository_url}/audio-converter:latest"

  timeout     = 300
  memory_size = 1024

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      NODE_ENV = var.environment
    }
  }

  tags = var.tags
}

# S3 trigger for audio converter
resource "aws_s3_bucket_notification" "audio_upload_notification" {
  bucket = var.audio_bucket_id

  lambda_function {
    lambda_function_arn = aws_lambda_function.audio_converter.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
  }

  depends_on = [aws_lambda_permission.s3_invoke_audio_converter]
}

resource "aws_lambda_permission" "s3_invoke_audio_converter" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.audio_converter.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = var.audio_bucket_arn
}
