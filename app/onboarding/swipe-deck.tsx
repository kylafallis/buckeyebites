"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion"
import { HeartIcon, XIcon } from "@phosphor-icons/react"
import type { MenuItem } from "@/lib/menu-shared"
import { Badge } from "@/components/ui/badge"
import { PlateDrawing } from "@/components/plate-drawing"
import { PlatePhoto } from "@/components/plate-photo"
import { Button } from "@/components/ui/button"
import { loadSwipeItems } from "./actions"

const SWIPE_DISTANCE = 100
const SWIPE_VELOCITY = 500

/** Shows the deck and reports each swipe; the parent saves them all on Finish. */
export function SwipeDeck({ onSwipe }: { onSwipe: (menuItemId: number, liked: boolean) => void }) {
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSwipeItems()
      .then(setItems)
      .catch(() => setError("Couldn't load menu items."))
  }, [])

  function swipe(liked: boolean) {
    const item = items?.[index]
    if (!item) return
    setDirection(liked ? 1 : -1)
    setIndex((i) => i + 1)
    onSwipe(item.id, liked)
  }

  if (error && !items) return <Message title="Menu loading soon" body={error} />
  if (!items) return <p className="py-12 text-center text-sm text-muted-foreground">Loading menu…</p>
  if (items.length === 0) {
    return (
      <Message
        title="Menu loading soon"
        body="Scott's menu isn't in yet. Tap Finish and you can rate dishes later."
      />
    )
  }

  const current = items[index]
  const upNext = items[index + 1]

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {current ? `${index + 1} of ${items.length}` : `All ${items.length} rated`}
      </p>

      <div className="relative h-[22rem] w-full">
        {upNext && <FoodCard item={upNext} className="scale-95 opacity-60" />}
        <AnimatePresence custom={direction}>
          {current ? (
            <SwipeCard key={current.id} item={current} direction={direction} onSwipe={swipe} />
          ) : (
            <Message
              key="done"
              title="Nice, that's everything."
              body="Tap Finish to see your dashboard."
            />
          )}
        </AnimatePresence>
      </div>

      {current && (
        <div className="flex gap-6">
          <Button
            variant="outline"
            className="size-14 rounded-full"
            aria-label={`Pass on ${current.name}`}
            onClick={() => swipe(false)}
          >
            <XIcon className="size-6" weight="bold" />
          </Button>
          <Button
            className="size-14 rounded-full"
            aria-label={`Like ${current.name}`}
            onClick={() => swipe(true)}
          >
            <HeartIcon className="size-6" weight="fill" />
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function SwipeCard({
  item,
  direction,
  onSwipe,
}: {
  item: MenuItem
  direction: number
  onSwipe: (liked: boolean) => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  const likeOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1])
  const passOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0])

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) onSwipe(true)
        else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) onSwipe(false)
      }}
      custom={direction}
      initial={{ scale: 0.95, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      variants={{
        exit: (d: number) => ({ x: d * 480, rotate: d * 25, opacity: 0, transition: { duration: 0.3 } }),
      }}
      exit="exit"
    >
      <FoodCard item={item} />
      <motion.span
        style={{ opacity: likeOpacity }}
        className="absolute top-4 left-4 rounded-full bg-sage px-3 py-1.5 text-sm font-bold text-white shadow"
        aria-hidden
      >
        Like
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="absolute top-4 right-4 rounded-full bg-foreground px-3 py-1.5 text-sm font-bold text-background shadow"
        aria-hidden
      >
        Pass
      </motion.span>
    </motion.div>
  )
}

function FoodCard({ item, className = "" }: { item: MenuItem; className?: string }) {
  const tags = item.diet_tags.filter((t) => !t.startsWith("contains_"))
  return (
    <div className={`absolute inset-0 flex flex-col overflow-hidden rounded-3xl bg-card shadow-[0_10px_30px_rgba(31,42,35,0.10)] select-none ${className}`}>
      {/* Whole photo over a blurred copy, like plate photos; a drawn plate when there's no photo. */}
      <div className="pointer-events-none h-52 w-full">
        {item.image_url ? (
          <PlatePhoto photos={[{ src: item.image_url, alt: "" }]} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center bg-muted" aria-hidden>
            <PlateDrawing foods={[{ name: item.name, food_group: item.food_group, calories: item.calories, servings: 1 }]} size={150} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-xl leading-tight font-extrabold">{item.name}</h2>
        <p className="text-sm text-muted-foreground">
          {[item.station?.name, item.serving_size].filter(Boolean).join(" · ")}
        </p>
        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="capitalize">
                {t.replaceAll("_", " ")}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-input p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
