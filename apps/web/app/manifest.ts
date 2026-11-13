import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "আমার পরিবার",
    short_name: "পরিবার",
    description: "পরিবারের সব হিসাব, এক জায়গায়",
    start_url: "/",
    lang: "bn",
    display: "standalone",
    theme_color: "#1B5E20",
    background_color: "#FFF8EE",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
