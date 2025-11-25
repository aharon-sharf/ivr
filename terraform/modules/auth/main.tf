# Auth Module - AWS Cognito

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # Password Policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # MFA Configuration
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  sms_configuration {
    external_id    = "${var.project_name}-cognito-sms-${var.environment}"
    sns_caller_arn = aws_iam_role.cognito_sms.arn
  }

  # Account Recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 2
    }
  }

  # User Attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Auto-verified Attributes
  auto_verified_attributes = ["email"]

  # Email Configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User Pool Add-ons
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  # Username Configuration
  username_configuration {
    case_sensitive = false
  }

  # Verification Message Template
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Mass Voice Campaign System - Verify your email"
    email_message        = "Your verification code is {####}"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-user-pool-${var.environment}"
    }
  )
}

# IAM Role for Cognito SMS
resource "aws_iam_role" "cognito_sms" {
  name = "${var.project_name}-cognito-sms-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Action = "sts:AssumeRole"
        Condition = {
          StringEquals = {
            "sts:ExternalId" = "${var.project_name}-cognito-sms-${var.environment}"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-cognito-sms-role-${var.environment}"
    }
  )
}

# IAM Policy for Cognito SMS
resource "aws_iam_role_policy" "cognito_sms" {
  name = "${var.project_name}-cognito-sms-policy-${var.environment}"
  role = aws_iam_role.cognito_sms.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "*"
      }
    ]
  })
}

# User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# App Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-app-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # Token Validity
  access_token_validity  = 1  # 1 hour
  id_token_validity      = 1  # 1 hour
  refresh_token_validity = 30 # 30 days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # OAuth Configuration
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = ["http://localhost:3000/callback", "https://${var.project_name}-${var.environment}.example.com/callback"]
  logout_urls                          = ["http://localhost:3000/logout", "https://${var.project_name}-${var.environment}.example.com/logout"]

  # Supported Identity Providers
  supported_identity_providers = ["COGNITO"]

  # Prevent User Existence Errors
  prevent_user_existence_errors = "ENABLED"

  # Read/Write Attributes
  read_attributes = [
    "email",
    "email_verified",
    "name"
  ]

  write_attributes = [
    "email",
    "name"
  ]

  # Enable Token Revocation
  enable_token_revocation = true
}

# User Groups

# Campaign Manager Group
resource "aws_cognito_user_group" "campaign_manager" {
  name         = "CampaignManager"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Campaign managers can create and manage campaigns"
  precedence   = 10
}

# Administrator Group
resource "aws_cognito_user_group" "administrator" {
  name         = "Administrator"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Administrators have full system access"
  precedence   = 1
}

# Analyst Group
resource "aws_cognito_user_group" "analyst" {
  name         = "Analyst"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Analysts can view reports and analytics"
  precedence   = 20
}
