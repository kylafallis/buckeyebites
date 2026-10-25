"use client"

import { useState } from "react"
import { BowlFoodIcon } from "@phosphor-icons/react"
import type { PhotoSource } from "@/lib/plate-photos"

/**
 * A plate's picture: one full photo, or a 2x2 collage of up to 4. Each photo
 * is shown whole (object-contain) so the food is never cropped off-center,
 * over a blurred copy of itself that fills the rest of the frame. Photos that
 * fail to load drop out; with none left it's an off-white block with a bowl.
 */
export function PlatePhoto({ photos, className = "" }: { photos: PhotoSource[]; className?: string }) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set())
  const shown = photos.filter((p) => !failed.has(p.src)).slice(0, 4)
  const drop = (src: string) => setFailed((f) => new Set(f).add(src))

  if (shown.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-[#FAF7F2] text-[#6B4423]/50 ${className}`} aria-hidden>
        <BowlFoodIcon className="size-10" weight="duotone" />
      </div>
    )
  }

  const img = (p: PhotoSource, cell = "") => (
    <div key={p.src} className={`relative h-full w-full overflow-hidden bg-white ${cell}`}>
      {/* Menu photos come from external hosts, so skip next/image's domain allowlist. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.src}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-50 blur-2xl"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.src}
        alt={p.alt}
        loading="lazy"
        onError={() => drop(p.src)}
        className="relative h-full w-full object-contain"
      />
    </div>
  )

  return (
    <div className={`grid gap-0.5 overflow-hidden bg-[#FAF7F2] ${shown.length > 1 ? "grid-cols-2 grid-rows-2" : ""} ${className}`}>
      {shown.length === 1 && img(shown[0])}
      {/* 2 photos: side by side. 3: one tall on the left. 4: a 2x2 grid. */}
      {shown.length === 2 && shown.map((p) => img(p, "row-span-2"))}
      {shown.length === 3 && [img(shown[0], "row-span-2"), img(shown[1]), img(shown[2])]}
      {shown.length === 4 && shown.map((p) => img(p))}
    </div>
  )
}
