#!/bin/bash
# Terraform deployment helper script
# Usage: ./deploy.sh <environment> <action>
# Example: ./deploy.sh dev plan
# Example: ./deploy.sh production apply

set -e

ENVIRONMENT=$1
ACTION=$2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate arguments
if [ -z "$ENVIRONMENT" ] || [ -z "$ACTION" ]; then
    echo "Usage: $0 <environment> <action>"
    echo ""
    echo "Environments: dev, staging, production"
    echo "Actions: plan, apply, destroy"
    echo ""
    echo "Examples:"
    echo "  $0 dev plan"
    echo "  $0 staging apply"
    echo "  $0 production plan"
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo "Valid environments: dev, staging, production"
    exit 1
fi

# Validate action
if [[ ! "$ACTION" =~ ^(plan|apply|destroy)$ ]]; then
    echo -e "${RED}❌ Invalid action: $ACTION${NC}"
    echo "Valid actions: plan, apply, destroy"
    exit 1
fi

# Check if tfvars file exists
TFVARS_FILE="environments/${ENVIRONMENT}.tfvars"
if [ ! -f "$TFVARS_FILE" ]; then
    echo -e "${RED}❌ Configuration file not found: $TFVARS_FILE${NC}"
    exit 1
fi

# Get current workspace
CURRENT_WORKSPACE=$(terraform workspace show)

# Check if we're in the correct workspace
if [ "$CURRENT_WORKSPACE" != "$ENVIRONMENT" ]; then
    echo -e "${YELLOW}⚠️  Current workspace: $CURRENT_WORKSPACE${NC}"
    echo -e "${YELLOW}⚠️  Target environment: $ENVIRONMENT${NC}"
    echo ""
    read -p "Switch to $ENVIRONMENT workspace? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform workspace select "$ENVIRONMENT"
        echo -e "${GREEN}✅ Switched to $ENVIRONMENT workspace${NC}"
    else
        echo -e "${RED}❌ Aborted${NC}"
        exit 1
    fi
fi

# Confirm production actions
if [ "$ENVIRONMENT" == "production" ]; then
    echo -e "${RED}⚠️  WARNING: You are about to $ACTION to PRODUCTION!${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no) " -r
    echo
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo -e "${YELLOW}Aborted${NC}"
        exit 1
    fi
fi

# Show current state
echo -e "${GREEN}Environment: $ENVIRONMENT${NC}"
echo -e "${GREEN}Action: $ACTION${NC}"
echo -e "${GREEN}Workspace: $(terraform workspace show)${NC}"
echo -e "${GREEN}Config file: $TFVARS_FILE${NC}"
echo ""

# Execute Terraform command
case $ACTION in
    plan)
        terraform plan -var-file="$TFVARS_FILE"
        ;;
    apply)
        terraform apply -var-file="$TFVARS_FILE"
        ;;
    destroy)
        echo -e "${RED}⚠️  WARNING: This will DESTROY all resources in $ENVIRONMENT!${NC}"
        terraform destroy -var-file="$TFVARS_FILE"
        ;;
esac

echo ""
echo -e "${GREEN}✅ Done!${NC}"
