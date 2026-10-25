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
    icons: [
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/favicon.png", sizes: "50x50", type: "image/png" },
    ],
  }
}
