import Image from "next/image"

/**
 * The BuckeyeBites logo (public/logo.png). The file is 1200x400 with an opaque
 * white background and wide padding, so it's shown in a 4.8:1 frame (object-cover
 * trims the empty top and bottom) and multiplied onto the page so the white
 * takes the background color. Size it with a height class, e.g. "h-9".
 */
export function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="BuckeyeBites"
      width={1200}
      height={400}
      priority={priority}
      className={`aspect-[4.8/1] w-auto object-cover mix-blend-multiply ${className}`}
    />
  )
}
