{
  description = "Murmur – local-first voice dictation";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          murmur = pkgs.callPackage ./nix/package.nix { };
        in
        {
          default = murmur;
          murmur = murmur;
        }
      );

      overlays.default = _final: _prev: {
        murmur = self.packages.x86_64-linux.murmur;
      };

      nixosModules.default = import ./nix/module.nix self;
    };
}
