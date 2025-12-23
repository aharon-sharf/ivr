# Storage Module - S3 Buckets

# Audio Files Bucket
resource "aws_s3_bucket" "audio_files" {
  bucket = "${var.project_name}-audio-files-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-audio-files-${var.environment}"
    }
  )
}

resource "aws_s3_bucket_versioning" "audio_files" {
  bucket = aws_s3_bucket.audio_files.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "audio_files" {
  bucket = aws_s3_bucket.audio_files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "audio_files" {
  bucket = aws_s3_bucket.audio_files.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "audio_files" {
  bucket = aws_s3_bucket.audio_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"] # Update with specific frontend domain in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# ML Models Bucket
resource "aws_s3_bucket" "ml_models" {
  bucket = "${var.project_name}-ml-models-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-ml-models-${var.environment}"
    }
  )
}

resource "aws_s3_bucket_versioning" "ml_models" {
  bucket = aws_s3_bucket.ml_models.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ml_models" {
  bucket = aws_s3_bucket.ml_models.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Campaign Reports Bucket
resource "aws_s3_bucket" "campaign_reports" {
  bucket = "${var.project_name}-campaign-reports-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-campaign-reports-${var.environment}"
    }
  )
}

resource "aws_s3_bucket_versioning" "campaign_reports" {
  bucket = aws_s3_bucket.campaign_reports.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "campaign_reports" {
  bucket = aws_s3_bucket.campaign_reports.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "campaign_reports" {
  bucket = aws_s3_bucket.campaign_reports.id

  rule {
    id     = "expire-old-reports"
    status = "Enabled"

    filter {}

    expiration {
      days = 365
    }
  }
}

# Contact Uploads Bucket
resource "aws_s3_bucket" "contact_uploads" {
  bucket = "${var.project_name}-contact-uploads-${var.environment}"

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-contact-uploads-${var.environment}"
    }
  )
}

resource "aws_s3_bucket_versioning" "contact_uploads" {
  bucket = aws_s3_bucket.contact_uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "contact_uploads" {
  bucket = aws_s3_bucket.contact_uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "contact_uploads" {
  bucket = aws_s3_bucket.contact_uploads.id

  rule {
    id     = "expire-old-uploads"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "contact_uploads" {
  bucket = aws_s3_bucket.contact_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["*"] # Update with specific frontend domain in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Frontend Hosting Bucket
resource "aws_s3_bucket" "frontend_hosting" {
  bucket        = "${var.project_name}-frontend-${var.environment}"
  force_destroy = true

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-frontend-${var.environment}"
    }
  )
}

resource "aws_s3_bucket_versioning" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_website_configuration" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# Block public access for all buckets except frontend
resource "aws_s3_bucket_public_access_block" "audio_files" {
  bucket = aws_s3_bucket.audio_files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "ml_models" {
  bucket = aws_s3_bucket.ml_models.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "campaign_reports" {
  bucket = aws_s3_bucket.campaign_reports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "contact_uploads" {
  bucket = aws_s3_bucket.contact_uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Identity for secure S3 access
resource "aws_cloudfront_origin_access_identity" "frontend" {
  comment = "OAI for ${var.project_name}-frontend-${var.environment}"
}

# S3 bucket policy to allow CloudFront access
resource "aws_s3_bucket_policy" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.frontend.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_hosting.arn}/*"
      }
    ]
  })
}

# CloudFront distribution for frontend
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} Frontend Distribution - ${var.environment}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # Use only North America and Europe edge locations

  origin {
    domain_name = aws_s3_bucket.frontend_hosting.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.frontend_hosting.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend_hosting.id}"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Custom error response for SPA routing
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # For custom domain with SSL, use:
    # acm_certificate_arn      = var.acm_certificate_arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-frontend-distribution-${var.environment}"
    }
  )
}
