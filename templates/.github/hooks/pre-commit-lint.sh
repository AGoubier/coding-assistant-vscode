#!/bin/bash
# Pre-commit hook: lint staged files before committing
# Runs ESLint on staged .ts/.js files

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js)$')

if [ -n "$STAGED_FILES" ]; then
  echo "Running ESLint on staged files..."
  npx eslint $STAGED_FILES --fix
  if [ $? -ne 0 ]; then
    echo "ESLint found errors. Fix them before committing."
    exit 1
  fi
  git add $STAGED_FILES
fi
