#!/usr/bin/env bash
# pre-commit hook script

# Exit if any command fails
set -e

echo "Running pre-commit hook with npm run format"

npm run format

# Check if there are any changes after formatting
if ! git diff --check --exit-code; then
  echo -e "\nCode may have been formatted. Please review the changes and commit again."
  exit 1
fi
