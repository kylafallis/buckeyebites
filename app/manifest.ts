import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuckeyeBite",
    short_name: "BuckeyeBite",
    description: "Your plate, planned.",
    start_url: "/dashboard",
    display: "standalone",
    theme_color: "#BB0000",
    background_color: "#FAF7F2",
    // Placeholders until the real logo is ready.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
