import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function AppLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile top bar */}
      <TopBar />

      {/* Main content — pb-24 (bukan pb-16) beri ruang ekstra utk bottom nav yang kini
          punya padding safe-area-inset-bottom (notch/home-indicator HP), supaya konten
          terakhir tidak ketutup nav di iPhone/Android bezel-less. */}
      <main className="md:pl-64 pb-24 md:pb-0">
        <div className="p-4 md:p-6">
          {/* Boundary di-key oleh path: kalau satu halaman crash, sidebar/nav tetap
              tampil dan pindah menu otomatis mereset error (tak perlu refresh manual). */}
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
