// Plate pictures from menu item photos. Plain module: used on the server and the client.

export type PhotoSource = { src: string; alt: string }

/** Up to 4 distinct photos from a plate's foods (menu_items.image_url). */
export function platePhotos(items: { name: string; image_url: string | null }[]): PhotoSource[] {
  const seen = new Set<string>()
  const photos: PhotoSource[] = []
  for (const { name, image_url } of items) {
    const src = image_url?.trim()
    if (!src || seen.has(src)) continue
    seen.add(src)
    photos.push({ src, alt: name })
  }
  return photos.slice(0, 4)
}
