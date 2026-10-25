import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuckeyeBites",
    short_name: "BuckeyeBites",
    description: "Your plate, planned.",
    start_url: "/dashboard",
    display: "standalone",
    theme_color: "#C92C20",
    background_color: "#F5F6F1",
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon.png", sizes: "50x50", type: "image/png" },
    ],
  }
}
