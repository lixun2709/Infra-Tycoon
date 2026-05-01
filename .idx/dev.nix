{ pkgs, ... }: {
  channel = "stable-24.11"; 
  
  # This ensures Vite 8 has the engine it needs
  packages = [
    pkgs.nodejs_22
  ];

  idx = {
    extensions = [
      "vscodevim.vim" # Optional, but helpful
    ];
    previews = {
      enable = true;
      previews = {
        web = {
          # This command ensures the preview points to the right port
          command = ["npm" "run" "dev" "--" "--port" "$PORT" "--host" "0.0.0.0"];
          manager = "web";
        };
      };
    };
  };
}