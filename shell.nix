{
  pkgs ? import <nixpkgs> { },
}:
let
  config = import ./vendor/toolkit/shared { inherit pkgs; };
in
pkgs.mkShell {
  nativeBuildInputs =
    config.nativeBuildInputs
    ++ (with pkgs; [
    ]);

  shellHook =
    config.shellHook
    + ''
      echo "💻 Project dev shell"
    '';
}
