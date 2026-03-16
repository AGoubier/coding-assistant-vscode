#!/bin/bash
# PostToolUse hook: Run style checks after file writes/edits
# Configure in .claude/settings.json:
#   "hooks": {
#     "PostToolUse": [{
#       "matcher": "Write|Edit",
#       "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/check-style.sh" }]
#     }]
#   }

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Skip non-source files
case "$FILE_PATH" in
  *.ts|*.js|*.tsx|*.jsx)
    npx eslint --fix "$FILE_PATH" 2>&1
    ;;
  *.py)
    ruff check --fix "$FILE_PATH" 2>&1
    ;;
  *)
    exit 0
    ;;
esac

exit 0
