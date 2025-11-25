# Storage Module Outputs

output "audio_files_bucket" {
  description = "Audio files S3 bucket name"
  value       = aws_s3_bucket.audio_files.id
}

output "audio_files_bucket_arn" {
  description = "Audio files S3 bucket ARN"
  value       = aws_s3_bucket.audio_files.arn
}

output "ml_models_bucket" {
  description = "ML models S3 bucket name"
  value       = aws_s3_bucket.ml_models.id
}

output "ml_models_bucket_arn" {
  description = "ML models S3 bucket ARN"
  value       = aws_s3_bucket.ml_models.arn
}

output "campaign_reports_bucket" {
  description = "Campaign reports S3 bucket name"
  value       = aws_s3_bucket.campaign_reports.id
}

output "campaign_reports_bucket_arn" {
  description = "Campaign reports S3 bucket ARN"
  value       = aws_s3_bucket.campaign_reports.arn
}

output "contact_uploads_bucket" {
  description = "Contact uploads S3 bucket name"
  value       = aws_s3_bucket.contact_uploads.id
}

output "contact_uploads_bucket_arn" {
  description = "Contact uploads S3 bucket ARN"
  value       = aws_s3_bucket.contact_uploads.arn
}

output "frontend_hosting_bucket" {
  description = "Frontend hosting S3 bucket name"
  value       = aws_s3_bucket.frontend_hosting.id
}

output "frontend_hosting_bucket_arn" {
  description = "Frontend hosting S3 bucket ARN"
  value       = aws_s3_bucket.frontend_hosting.arn
}

output "frontend_website_endpoint" {
  description = "Frontend S3 website endpoint"
  value       = aws_s3_bucket_website_configuration.frontend_hosting.website_endpoint
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.frontend.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront distribution hosted zone ID"
  value       = aws_cloudfront_distribution.frontend.hosted_zone_id
}
