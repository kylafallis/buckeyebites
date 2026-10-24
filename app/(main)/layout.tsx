import { BottomNav } from "@/components/bottom-nav"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
      <BottomNav />
    </>
  )
}
