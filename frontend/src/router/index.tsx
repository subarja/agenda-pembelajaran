import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ProfilePage from '@/pages/ProfilePage'
import PlaceholderPage from '@/pages/PlaceholderPage'
import AgendaPage from '@/pages/AgendaPage'
import AgendaFormPage from '@/pages/AgendaFormPage'
import PresensiPage from '@/pages/PresensiPage'
import PresensiFormPage from '@/pages/PresensiFormPage'
import PresensiHarianPage from '@/pages/PresensiHarianPage'
import AgendaDetailPage from '@/pages/AgendaDetailPage'
import KarakterPage from '@/pages/KarakterPage'
import EwsPage from '@/pages/EwsPage'
import EwsDetailPage from '@/pages/EwsDetailPage'
import LaporanPage from '@/pages/LaporanPage'
import TujuanPembelajaranPage from '@/pages/TujuanPembelajaranPage'
import AdminPage from '@/pages/AdminPage'
import StudentRekapPage from '@/pages/StudentRekapPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import TeacherEwsPage from '@/pages/TeacherEwsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Cek token langsung dari localStorage sebagai fallback untuk Zustand rehydration race
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated || !!s.token)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated || !!s.token)
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login"           element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset-password"  element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index                            element={<DashboardPage />} />

        <Route path="agenda"                    element={<AgendaPage />} />
        <Route path="agenda/baru"               element={<AgendaFormPage />} />
        <Route path="agenda/:id"                element={<AgendaDetailPage />} />

        <Route path="tp"                        element={<TujuanPembelajaranPage />} />

        <Route path="presensi"                  element={<PresensiPage />} />
        <Route path="presensi/:agendaId"        element={<PresensiFormPage />} />
        <Route path="presensi-harian"           element={<PresensiHarianPage />} />

        <Route path="karakter"                  element={<KarakterPage />} />

        <Route path="siswa"                     element={<PlaceholderPage title="Data Siswa" />} />
        <Route path="siswa/:studentId/rekap"    element={<StudentRekapPage />} />

        <Route path="ews"                       element={<EwsPage />} />
        <Route path="ews/:studentId"            element={<EwsDetailPage />} />

        <Route path="laporan"                   element={<LaporanPage />} />
        <Route path="admin"                     element={<AdminPage />} />
        <Route path="ews-guru"                  element={<TeacherEwsPage />} />
        <Route path="pengaturan"                element={<PlaceholderPage title="Pengaturan" />} />
        <Route path="profil"                    element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
