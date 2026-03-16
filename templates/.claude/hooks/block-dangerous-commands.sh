#!/bin/bash
# PreToolUse hook: Block dangerous shell commands
# Configure in .claude/settings.json:
#   "hooks": {
#     "PreToolUse": [{
#       "matcher": "Bash",
#       "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous-commands.sh" }]
#     }]
#   }

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Block destructive commands
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+/|mkfs\.|dd\s+if=|:(){ :|chmod\s+-R\s+777\s+/'; then
  echo "Blocked: potentially destructive command" >&2
  exit 2
fi

exit 0
