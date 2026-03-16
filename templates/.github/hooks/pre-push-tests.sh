#!/bin/bash
# Pre-push hook: run tests before pushing
# Prevents pushing broken code to remote

echo "Running test suite before push..."
npm test

if [ $? -ne 0 ]; then
  echo "Tests failed. Push aborted."
  echo "Fix failing tests and try again."
  exit 1
fi

echo "All tests passed. Proceeding with push."
