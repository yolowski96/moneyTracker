import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest and linked automatically by Next.
// The manifest is fetched without cookies, so middleware must let it
// through unauthenticated (see middleware.ts matcher).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bankopolis",
    short_name: "Bankopolis",
    description: "A minimal money tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f3",
    theme_color: "#f8f7f3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
