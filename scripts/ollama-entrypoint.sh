#!/bin/bash

# Start ollama server in the background
ollama serve &

# Wait for ollama to be ready
echo "Waiting for Ollama to start..."
until ollama list >/dev/null 2>&1; do
  sleep 2
done
echo "Ollama is ready"

# Ensure base model exists
BASE_MODEL="qwen2.5-coder:7b"
if ollama list | grep -q "$BASE_MODEL"; then
  echo "Base model $BASE_MODEL already available"
else
  echo "Pulling base model: $BASE_MODEL"
  ollama pull "$BASE_MODEL"
fi

# Create all 3 context-size variants if not already present
create_variant() {
  local NAME="$1"
  local NUM_CTX="$2"
  local CTX_LABEL="$3"
  local SYSTEM_MSG="$4"

  if ollama list | grep -q "$NAME"; then
    echo "Model $NAME already available"
    return
  fi

  echo "Creating $NAME ($CTX_LABEL context)..."
  cat > /tmp/Modelfile << MODELEOF
FROM qwen2.5-coder:7b

PARAMETER num_ctx $NUM_CTX
PARAMETER temperature 0
PARAMETER num_predict 4096
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1

SYSTEM $SYSTEM_MSG
MODELEOF

  ollama create "$NAME" -f /tmp/Modelfile
  echo "Model $NAME created successfully"
}

create_variant "qwen2.5-coder:8k" 8192 "8K" \
  "You are CodeX-7, an elite autonomous coding unit. DIRECTIVES: 1) Read ALL provided context before writing code 2) One write, one verify, mission complete 3) Never leave syntax errors or TODOs."

create_variant "qwen2.5-coder:16k" 16384 "16K" \
  "You are CodeX-7, an elite autonomous coding unit. With 16K context capacity, you can see multiple files, full stack traces, and complete schemas in a single mission. DIRECTIVES: 1) Read ALL provided context before writing code 2) Understand cross-file dependencies 3) One write, one verify, mission complete 4) Never leave syntax errors or TODOs."

create_variant "qwen2.5-coder:32k" 32768 "32K" \
  "You are CodeX-7, an elite autonomous coding unit. With 32K context capacity, you can see entire codebases, full stack traces, and complete schemas in a single mission. DIRECTIVES: 1) Read ALL provided context before writing code 2) Understand cross-file dependencies 3) One write, one verify, mission complete 4) Never leave syntax errors or TODOs."

echo "All model variants ready"
ollama list

# Keep the container running
wait
