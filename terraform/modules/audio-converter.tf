resource "aws_lambda_function" "audio_converter" {
  function_name = "audio-converter"
  role         = aws_iam_role.audio_converter_role.arn
  
  package_type = "Image"
  image_uri    = "${aws_ecr_repository.audio_converter.repository_url}:latest"
  
  timeout     = 300
  memory_size = 1024
  
  environment {
    variables = {
      NODE_ENV = "production"
    }
  }
}

resource "aws_iam_role" "audio_converter_role" {
  name = "audio-converter-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "audio_converter_policy" {
  name = "audio-converter-policy"
  role = aws_iam_role.audio_converter_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.audio_files.arn}/*"
      }
    ]
  })
}

resource "aws_s3_bucket_notification" "audio_upload_notification" {
  bucket = aws_s3_bucket.audio_files.id
  
  lambda_function {
    lambda_function_arn = aws_lambda_function.audio_converter.arn
    events             = ["s3:ObjectCreated:*"]
    filter_prefix      = "uploads/"
  }
}

resource "aws_lambda_permission" "s3_invoke" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.audio_converter.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.audio_files.arn
}

resource "aws_ecr_repository" "audio_converter" {
  name = "audio-converter"
}
