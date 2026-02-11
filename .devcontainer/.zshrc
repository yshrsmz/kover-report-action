
# npm global prefix and local bin
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

# History configuration
HISTFILE="$HOME/.shell_history/.zsh_history"
HISTSIZE=10000
SAVEHIST=10000
setopt SHARE_HISTORY
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_SPACE

eval "$(mise activate zsh)"

# Starship config (no-nerd-font preset for devcontainer portability)
export STARSHIP_CONFIG="/workspaces/kover-report-action/.devcontainer/starship.toml"
eval "$(starship init zsh)"
