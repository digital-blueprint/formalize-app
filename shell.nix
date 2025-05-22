{
  pkgs ? import <nixpkgs> { },
}:
pkgs.mkShell {
  # nativeBuildInputs is usually what you want -- tools you need to run
  nativeBuildInputs = with pkgs; [
    nodejs_22
    curl
    zellij # smart terminal workspace
    lazygit # git terminal
    just # task runner
    fzf # fuzzy finder, for "just watch"
  ];

  shellHook = ''
    export CHROMIUM_BIN=${pkgs.chromium}/bin/chromium
    export FIREFOX_BIN=${pkgs.firefox}/bin/firefox

    echo "Using chromium at $CHROMIUM_BIN and firefox at $FIREFOX_BIN for karma tests"

    # Determine the repository root
    REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

    # Check if we are in the repository root
    if [ "$REPO_ROOT" = "$(pwd)" ]; then
      # Symlink the pre-commit hook into the .git/hooks directory
      ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
    fi
  '';
}
