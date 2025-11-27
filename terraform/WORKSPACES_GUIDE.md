# Terraform Workspaces - Quick Guide

## מה זה Workspaces?

Terraform Workspaces מאפשרים לנהל מספר סביבות (dev, staging, production) עם אותו קוד Terraform.

כל workspace שומר state file נפרד ב-S3, כך שהמשאבים של כל סביבה מבודדים לחלוטין.

## Setup ראשוני

### 1. צור את ה-S3 bucket (פעם אחת בלבד)

```bash
cd terraform
./backend-setup.sh
```

### 2. אתחל Terraform

```bash
terraform init
```

### 3. צור workspaces

```bash
# צור workspace לכל סביבה
terraform workspace new dev
terraform workspace new staging
terraform workspace new production

# בדוק שהם נוצרו
terraform workspace list
```

פלט:
```
  default
* dev
  production
  staging
```

הכוכבית (*) מציינת את ה-workspace הנוכחי.

## שימוש יומיומי

### בדוק באיזה workspace אתה נמצא

```bash
terraform workspace show
```

או:

```bash
terraform workspace list
```

### החלף workspace

```bash
terraform workspace select dev
```

### Deploy לסביבת dev

```bash
# ודא שאתה ב-workspace הנכון
terraform workspace select dev

# Plan
terraform plan -var-file=environments/dev.tfvars

# Apply
terraform apply -var-file=environments/dev.tfvars
```

### Deploy לסביבת production

```bash
# החלף ל-production workspace
terraform workspace select production

# Plan
terraform plan -var-file=environments/production.tfvars

# Apply (זהירות!)
terraform apply -var-file=environments/production.tfvars
```

## איך זה עובד מאחורי הקלעים?

כאשר אתה משתמש ב-workspaces, Terraform שומר את ה-state files כך:

```
S3 Bucket: mass-voice-campaign-terraform-state
├── env:/dev/terraform.tfstate
├── env:/staging/terraform.tfstate
└── env:/production/terraform.tfstate
```

כל workspace מבודד לחלוטין - אתה יכול להריס את dev מבלי להשפיע על production.

## שימוש ב-workspace name בקוד

אתה יכול להשתמש ב-`terraform.workspace` בקוד Terraform:

```hcl
# שם משאב עם workspace
resource "aws_instance" "asterisk" {
  tags = {
    Name        = "asterisk-${terraform.workspace}"
    Environment = terraform.workspace
  }
}

# הגדרות שונות לפי workspace
locals {
  instance_type = terraform.workspace == "production" ? "c5.xlarge" : "t3.medium"
  multi_az      = terraform.workspace == "production" ? true : false
}
```

## Best Practices

### ✅ תמיד בדוק את ה-workspace לפני פעולה

```bash
# הוסף alias ל-.bashrc או .zshrc
alias tfws='terraform workspace show'
alias tfwl='terraform workspace list'
```

### ✅ השתמש ב-tfvars files נפרדים

```bash
terraform/environments/
├── dev.tfvars
├── staging.tfvars
└── production.tfvars
```

### ✅ הוסף workspace name לשמות משאבים

```hcl
name = "${var.project_name}-${terraform.workspace}"
```

### ❌ אל תשתמש ב-workspace "default"

ה-workspace "default" נוצר אוטומטית, אבל עדיף ליצור workspaces עם שמות ברורים.

## פקודות שימושיות

```bash
# הצג workspace נוכחי
terraform workspace show

# רשימת כל ה-workspaces
terraform workspace list

# החלף workspace
terraform workspace select dev

# צור workspace חדש
terraform workspace new test

# מחק workspace (רק אם אין בו משאבים!)
terraform workspace delete test

# הצג outputs של workspace נוכחי
terraform output

# הצג state של workspace נוכחי
terraform state list
```

## Troubleshooting

### שגיאה: "Workspace already exists"

```bash
# אם ה-workspace כבר קיים, פשוט עבור אליו
terraform workspace select dev
```

### שגיאה: "Cannot delete current workspace"

```bash
# עבור ל-workspace אחר לפני מחיקה
terraform workspace select default
terraform workspace delete old-workspace
```

### איך לראות את ה-state files ב-S3?

```bash
aws s3 ls s3://mass-voice-campaign-terraform-state/ --recursive
```

### איך לשחזר state ישן?

S3 bucket עם versioning מאפשר שחזור:

```bash
# רשימת גרסאות
aws s3api list-object-versions \
  --bucket mass-voice-campaign-terraform-state \
  --prefix env:/dev/terraform.tfstate

# שחזר גרסה ספציפית (זהירות!)
aws s3api get-object \
  --bucket mass-voice-campaign-terraform-state \
  --key env:/dev/terraform.tfstate \
  --version-id VERSION_ID \
  terraform.tfstate.backup
```

## דוגמה מלאה: Deploy של dev environment

```bash
# 1. ודא שאתה בתיקיית terraform
cd terraform

# 2. בדוק workspace נוכחי
terraform workspace show

# 3. אם לא ב-dev, החלף
terraform workspace select dev

# 4. Plan עם dev variables
terraform plan -var-file=environments/dev.tfvars

# 5. אם הכל נראה טוב, Apply
terraform apply -var-file=environments/dev.tfvars

# 6. הצג outputs
terraform output

# 7. בדוק משאבים שנוצרו
terraform state list
```

## סיכום

- ✅ Workspace אחד = סביבה אחת (dev/staging/production)
- ✅ State files מבודדים ב-S3
- ✅ אותו קוד Terraform לכל הסביבות
- ✅ משתנים שונים לכל סביבה (tfvars files)
- ✅ תמיד בדוק את ה-workspace לפני פעולה!
