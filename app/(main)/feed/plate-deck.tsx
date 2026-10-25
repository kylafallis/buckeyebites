"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowsClockwiseIcon, CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react"
import type { MealPeriod } from "@/lib/menu-shared"
import { PlateDrawing, PlateLegend, type DrawnFood } from "@/components/plate-drawing"
import { buttonVariants } from "@/components/ui/button"

export type DeckPlate = {
  id: number
  title: string
  blurb: string | null
  stations: string[]
  protein: number
  foods: DrawnFood[]
}

/**
 * Feed me, layout B: safe plates drawn from above, one per slide. Swipe (or
 * use the arrows) to look through them, then choose one to see its route.
 */
export function PlateDeck({ plates, meal }: { plates: DeckPlate[]; meal: MealPeriod }) {
  const router = useRouter()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const current = plates[Math.min(index, plates.length - 1)]

  const onScroll = () => {
    const el = track.current
    if (el && el.clientWidth > 0) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }
  const go = (i: number) => {
    const el = track.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
  }

  return (
    <section aria-roledescription="carousel" aria-label="Plates that fit you" className="mt-4">
      <div className="relative">
        <div
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {plates.map((plate, i) => (
            <div
              key={plate.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`Plate ${i + 1} of ${plates.length}: ${plate.title}`}
              aria-hidden={i !== index}
              className="flex w-full shrink-0 snap-center justify-center pt-3 pb-9"
            >
              <PlateDrawing foods={plate.foods} size={260} />
            </div>
          ))}
        </div>
        {plates.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label="Previous plate"
              className="absolute top-1/2 left-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-sm disabled:opacity-0"
            >
              <CaretLeftIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === plates.length - 1}
              aria-label="Next plate"
              className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-sm disabled:opacity-0"
            >
              <CaretRightIcon className="size-5" />
            </button>
          </>
        )}
      </div>

      {plates.length > 1 && (
        <div className="-mt-5 flex justify-center gap-2" aria-hidden>
          {plates.map((p, i) => (
            <span
              key={p.id}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-foreground" : "w-2 bg-input"}`}
            />
          ))}
        </div>
      )}

      <div className="mt-4" aria-live="polite">
        <h2 className="text-2xl leading-tight font-extrabold">{current.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {current.stations.length === 1 ? "One stop" : `${current.stations.length} stops`}: {current.stations.join(", ")}
          {current.protein > 0 && ` · ${current.protein} g protein`}
        </p>
        <PlateLegend foods={current.foods} className="mt-3" />
        {current.blurb && <p className="mt-3 text-sm leading-relaxed">{current.blurb}</p>}
      </div>

      <div className="mt-5 flex gap-2">
        <Link
          href={`/plate/${current.id}?meal=${meal}`}
          className={buttonVariants({ className: "h-12 flex-1 rounded-xl text-base font-bold" })}
        >
          Take me there
        </Link>
        <button
          type="button"
          onClick={() => {
            track.current?.scrollTo({ left: 0 })
            setIndex(0)
            router.refresh()
          }}
          className="flex h-12 items-center gap-2 rounded-xl border-2 border-foreground px-4 text-base font-bold"
        >
          <ArrowsClockwiseIcon className="size-5" aria-hidden />
          Shuffle
        </button>
      </div>
      {plates.length > 1 && <p className="mt-3 text-center text-sm text-muted-foreground">Swipe the plate to see another.</p>}
    </section>
  )
}
