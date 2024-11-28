# Use `just <recipe>` to run a recipe
# https://just.systems/man/en/

# By default, run the `--list` command
default:
    @just --list

# Variables

zellijSession := "formalize-app"

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

# Format all justfiles
[group('linter')]
just-format:
    #!/usr/bin/env bash
    # Find all files named "justfile" recursively and run just --fmt --unstable on them
    find . -type f -name "justfile" -print0 | while IFS= read -r -d '' file; do
        echo "Formatting $file"
        just --fmt --unstable -f "$file"
    done
