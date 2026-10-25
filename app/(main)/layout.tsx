import { BottomNav, TopNav } from "@/components/bottom-nav"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {/* Bottom padding keeps content clear of the phone tab bar. */}
      <div className="flex flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      <BottomNav />
    </>
  )
}
