{ pkgs ? import <nixpkgs> {} }:
  pkgs.mkShell {
    # nativeBuildInputs is usually what you want -- tools you need to run
    nativeBuildInputs = with pkgs; [
      nodejs_22
      curl
      zellij # smart terminal workspace
      lazygit # git terminal
      just # task runner
    ];
}

