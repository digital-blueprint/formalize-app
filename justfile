# Use `just <recipe>` to run a recipe
# https://just.systems/man/en/

# By default, run the `--list` command
default:
    @just --list

# Variables

zellijSession := "formalize-app"

# Aliases

alias fmt := format

# Open a terminal with the formalize-app session
[group('dev')]
term-run:
    zellij --layout term.kdl attach {{ zellijSession }} -c

# Kill the formalize-app session
[group('dev')]
term-kill:
    -zellij delete-session {{ zellijSession }} -f

# Kill and run a terminal with the formalize-app session
[group('dev')]
term: term-kill term-run

# Open a browser with the application
[group('dev')]
open-browser:
    xdg-open https://127.0.0.1:8001/dist/de/welcome

# Interactive npm watch script selector
[group('dev')]
watch:
    #!/usr/bin/env bash
    set -euo pipefail

    # Define the watch scripts with descriptions
    watch_scripts=(
        "watch: Whitelabel app"
        "watch-custom: TU Graz app"
    )

    # Use fzf to select a script
    selected_script=$(printf '%s\n' "${watch_scripts[@]}" | fzf \
        --height 40% \
        --layout=reverse \
        --border \
        --prompt='Select NPM watch script > ' \
        --preview='echo "Will run: npm run $(echo {} | cut -d: -f1)"' \
        --preview-window=up:1 \
        | cut -d: -f1)

    # Check if a script was selected
    if [[ -n "$selected_script" ]]; then
        # Get the full line for the selected script
        full_text=$(printf '%s\n' "${watch_scripts[@]}" | grep "^$selected_script:")

        # Set Zellij pane name
        if command -v zellij &> /dev/null; then
            zellij action rename-pane "$full_text"
        fi

        echo "Running: npm run $selected_script"
        npm run "$selected_script"
    else
        echo "No script selected. Exiting."
        exit 1
    fi

# Format all justfiles
[group('linter')]
just-format:
    #!/usr/bin/env bash
    # Find all files named "justfile" recursively and run just --fmt --unstable on them
    find . -type f -name "justfile" -print0 | while IFS= read -r -d '' file; do
        echo "Formatting $file"
        just --fmt --unstable -f "$file"
    done

# Format all files
[group('linter')]
format args='':
    nix-shell -p treefmt nodePackages.prettier nixfmt-rfc-style statix taplo --run "treefmt {{ args }}"
