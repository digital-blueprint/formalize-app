#!/usr/bin/env bash
# pre-commit hook script

echo "Running pre-commit hook with npm run check"

# Check if eslint and prettier are happy with the code
# We can't just use `npm run fix` and `git diff --check --exit-code`, because git will also complain about not yet staged changes
if ! npm run check; then
  echo -e "\nEslint or Prettier complained about the code. Please fix the issues and commit again. Often running 'npm run fix' will fix the issues."
  exit 1
fi
