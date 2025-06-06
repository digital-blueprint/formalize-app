{
  pkgs ? import <nixpkgs> { },
}:
let
  projectName = "formalize";
  config = import ./vendor/toolkit/shared { inherit pkgs projectName; };
in
pkgs.mkShell {
  nativeBuildInputs =
    config.nativeBuildInputs
    ++ (with pkgs; [
    ]);

  shellHook = config.shellHook + '''';
}
