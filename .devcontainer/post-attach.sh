#!/bin/bash
set -e

# Configure git signing key path for devcontainer
# Host's ~/.gitconfig is synced by VS Code, but signingkey path needs remapping
if signing_key=$(git config --global --get user.signingkey 2>/dev/null); then
  # Convert host path to container path (e.g., /Users/xxx/.ssh/... -> /home/vscode/.ssh/...)
  container_key_path=$(echo "$signing_key" | sed 's|^/[^/]*/[^/]*/|/home/vscode/|')
  if [[ -f "$container_key_path" ]]; then
    git config --global user.signingkey "$container_key_path"
    echo "Git signing key configured: $container_key_path"
  else
    echo "Warning: Signing key not found at $container_key_path, disabling commit signing"
    git config --global commit.gpgSign false
  fi
else
  echo "No git signing key configured, skipping."
fi
