import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
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
import NilaiTambahPage from '@/pages/NilaiTambahPage'
import EwsPage from '@/pages/EwsPage'
import EwsDetailPage from '@/pages/EwsDetailPage'
import LaporanPage from '@/pages/LaporanPage'
import TujuanPembelajaranPage from '@/pages/TujuanPembelajaranPage'
import AdminPage from '@/pages/AdminPage'
import StudentRekapPage from '@/pages/StudentRekapPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import TeacherEwsPage from '@/pages/TeacherEwsPage'
import TeacherEwsDetailPage from '@/pages/TeacherEwsDetailPage'
import StudentPhotoManagePage from '@/pages/StudentPhotoManagePage'
import StudentCaseNotesPage from '@/pages/StudentCaseNotesPage'
import KalenderPage from '@/pages/KalenderPage'
import HariEfektifPage from '@/pages/HariEfektifPage'
import PilihTahunAjaranPage from '@/pages/PilihTahunAjaranPage'
import RekapPerkembanganPage from '@/pages/RekapPerkembanganPage'
import JadwalSayaPage from '@/pages/JadwalSayaPage'
import RefleksiMingguanPage from '@/pages/RefleksiMingguanPage'
import RiwayatDokumenPenangananPage from '@/pages/RiwayatDokumenPenangananPage'

// Spinner penuh-layar — dipakai SELAMA `hasHydrated` masih false, supaya tidak pernah
// ada window blank putih ataupun sempat "kelihatan" redirect ke /login yang salah
// (isAuthenticated masih nilai awal false sebelum rehidrasi selesai baca localStorage).
function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!hasHydrated) return <FullScreenLoader />
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!hasHydrated) return <FullScreenLoader />
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}

function RequireAcademicYear({ children }: { children: React.ReactNode }) {
  const currentAcademicYear = useAuthStore((s) => s.currentAcademicYear)
  const role = useAuthStore((s) => s.user?.role)
  // Admin boleh masuk tanpa tahun ajaran terpilih saat instalasi baru (belum ada
  // tahun ajaran sama sekali) — supaya bisa membuat tahun ajaran pertama di AdminPage.
  // Backend hanya mengizinkan login tanpa academic_year_id untuk admin dalam kondisi ini,
  // jadi kasus ini eksklusif untuk bootstrap awal.
  if (!currentAcademicYear && role !== 'admin') return <Navigate to="/pilih-tahun-ajaran" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login"           element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
      <Route path="/reset-password"  element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
      <Route path="/pilih-tahun-ajaran" element={<ProtectedRoute><PilihTahunAjaranPage /></ProtectedRoute>} />

      <Route element={<ProtectedRoute><RequireAcademicYear><AppLayout /></RequireAcademicYear></ProtectedRoute>}>
        <Route index                            element={<DashboardPage />} />

        <Route path="agenda"                    element={<AgendaPage />} />
        <Route path="agenda/baru"               element={<AgendaFormPage />} />
        <Route path="agenda/:id"                element={<AgendaDetailPage />} />

        <Route path="tp"                        element={<TujuanPembelajaranPage />} />

        <Route path="presensi"                  element={<PresensiPage />} />
        <Route path="presensi/:agendaId"        element={<PresensiFormPage />} />
        <Route path="presensi-harian"           element={<PresensiHarianPage />} />

        <Route path="karakter"                  element={<KarakterPage />} />
        <Route path="nilai-tambah"              element={<NilaiTambahPage />} />

        <Route path="catatan-bk"                element={<StudentCaseNotesPage />} />
        <Route path="siswa"                     element={<StudentPhotoManagePage />} />
        <Route path="siswa/:studentId/rekap"    element={<StudentRekapPage />} />

        <Route path="ews"                       element={<EwsPage />} />
        <Route path="ews/:studentId"            element={<EwsDetailPage />} />

        <Route path="kalender"                  element={<KalenderPage />} />
        <Route path="hari-efektif"              element={<HariEfektifPage />} />
        <Route path="jadwal-saya"               element={<JadwalSayaPage />} />
        <Route path="refleksi-mingguan"         element={<RefleksiMingguanPage />} />
        <Route path="riwayat-dokumen-penanganan" element={<RiwayatDokumenPenangananPage />} />

        <Route path="laporan"                   element={<LaporanPage />} />
        <Route path="rekap-perkembangan"        element={<RekapPerkembanganPage />} />
        <Route path="admin"                     element={<AdminPage />} />
        <Route path="ews-guru"                  element={<TeacherEwsPage />} />
        <Route path="ews-guru/:teacherId"       element={<TeacherEwsDetailPage />} />
        <Route path="pengaturan"                element={<PlaceholderPage title="Pengaturan" />} />
        <Route path="profil"                    element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
