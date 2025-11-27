#!/bin/bash
# Helper script to verify you're in the correct Terraform workspace
# Usage: ./check-workspace.sh <expected-workspace>

set -e

EXPECTED_WORKSPACE=$1
CURRENT_WORKSPACE=$(terraform workspace show)

if [ -z "$EXPECTED_WORKSPACE" ]; then
    echo "Current workspace: $CURRENT_WORKSPACE"
    echo ""
    echo "All workspaces:"
    terraform workspace list
    echo ""
    echo "Usage: $0 <expected-workspace>"
    echo "Example: $0 dev"
    exit 0
fi

if [ "$CURRENT_WORKSPACE" != "$EXPECTED_WORKSPACE" ]; then
    echo "❌ ERROR: Wrong workspace!"
    echo ""
    echo "Expected: $EXPECTED_WORKSPACE"
    echo "Current:  $CURRENT_WORKSPACE"
    echo ""
    echo "To switch to the correct workspace, run:"
    echo "  terraform workspace select $EXPECTED_WORKSPACE"
    exit 1
fi

echo "✅ Correct workspace: $CURRENT_WORKSPACE"
exit 0
