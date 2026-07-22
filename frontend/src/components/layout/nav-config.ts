import {
  LayoutDashboard, BookOpen, Users, ClipboardCheck, CalendarCheck,
  Star, AlertTriangle, FileBarChart, Settings, User, Target, ShieldCheck, UserCog,
  MessageSquare, Calendar, BarChart3, TrendingUp, FileText, BookOpenCheck, PlusCircle,
  FolderOpen, BellRing, UserPlus, Briefcase, Sparkles, Clock,
} from 'lucide-react'
import type { User as UserType } from '@/types'

export interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  sectionLabel?: string   // tampilkan divider + label bagian sebelum item ini
}

const allNav: Record<string, NavItem> = {
  dashboard:     { label: 'Dashboard',       path: '/',                icon: LayoutDashboard },
  agenda:        { label: 'Agenda',          path: '/agenda',          icon: BookOpen },
  tp:            { label: 'Tujuan Pemb.',    path: '/tp',              icon: Target },
  presensi:      { label: 'Presensi',        path: '/presensi',        icon: ClipboardCheck },
  presensiHarian:{ label: 'Presensi Harian', path: '/presensi-harian', icon: CalendarCheck },
  karakter:      { label: 'Karakter',        path: '/karakter',        icon: Star },
  nilaiTambah:   { label: 'Nilai Tambah',    path: '/nilai-tambah',    icon: PlusCircle },
  siswa:         { label: 'Siswa',           path: '/siswa',           icon: Users },
  ews:           { label: 'EWS Siswa',       path: '/ews',             icon: AlertTriangle },
  ewsBk:         { label: 'EWS Murid BK',    path: '/ews-bk',          icon: AlertTriangle },
  ewsGuru:       { label: 'EWS Guru',        path: '/ews-guru',        icon: UserCog },
  laporan:       { label: 'Laporan',         path: '/laporan',         icon: FileBarChart },
  rekapPerkembangan: { label: 'Rekap Perkembangan', path: '/rekap-perkembangan', icon: TrendingUp },
  admin:         { label: 'Panel Admin',     path: '/admin',           icon: ShieldCheck },
  catatanBK:     { label: 'Konseling',       path: '/catatan-bk',      icon: MessageSquare },
  kalender:      { label: 'Kalender',        path: '/kalender',        icon: Calendar },
  hariEfektif:   { label: 'Minggu Efektif', path: '/hari-efektif',    icon: BarChart3 },
  pengaturan:    { label: 'Pengaturan',      path: '/pengaturan',      icon: Settings },
  notifikasi:    { label: 'Notifikasi',      path: '/pengaturan/notifikasi', icon: BellRing },
  profil:        { label: 'Profil',          path: '/profil',          icon: User },
  jadwalSaya:    { label: 'Jadwal Saya',     path: '/jadwal-saya',     icon: FileText },
  bebanMengajar: { label: 'Beban Mengajar',  path: '/beban-mengajar',  icon: Clock },
  inval:         { label: 'Guru Inval',      path: '/inval',           icon: UserPlus },
  pkl:           { label: 'PKL',             path: '/pkl',             icon: Briefcase },
  kokurikuler:   { label: 'Kokurikuler',     path: '/kokurikuler',     icon: Sparkles },
  refleksi:      { label: 'Refleksi Mingguan', path: '/refleksi-mingguan', icon: BookOpenCheck },
  riwayatDokumen: { label: 'Riwayat Dokumen Penanganan', path: '/riwayat-dokumen-penanganan', icon: FolderOpen },
}

function withSection(item: NavItem, label: string): NavItem {
  return { ...item, sectionLabel: label }
}

export function getNavForUser(user: UserType): NavItem[] {
  const role = user.role
  const kap  = user.kapabilitas

  const items: NavItem[] = [allNav.dashboard]

  // Guru dan role LAMA 'wali_kelas'/'bk' ditangani SAMA: ketiganya akun berbasis
  // guru. Status wali kelas / BK ditentukan KAPABILITAS (penugasan nyata di TA
  // aktif — kap.is_wali_kelas/is_bk), BUKAN role. Dulu role lama punya cabang
  // terpisah yang tak lengkap → guru wali kelas kehilangan Jadwal Saya, Kalender,
  // Minggu Efektif, PKL, Kokurikuler. Akar: ImportController menaikkan role guru
  // wali kelas ke 'wali_kelas'; backend sendiri sudah murni berbasis kapabilitas.
  if (role === 'guru' || role === 'wali_kelas' || role === 'bk') {
    // Menu dasar guru (Riwayat Dokumen Penanganan SENGAJA tidak di sini — hanya
    // untuk yang wali kelas dan/atau BK, lihat cabang kapabilitas di bawah).
    items.push(allNav.agenda, allNav.tp, allNav.presensi, allNav.karakter, allNav.nilaiTambah, allNav.inval, allNav.laporan, allNav.kalender, allNav.hariEfektif, allNav.jadwalSaya, allNav.bebanMengajar)

    // Menu PKL hanya saat Mode PKL aktif DAN guru ini benar-benar seorang pembimbing.
    if (user.pkl?.mode_aktif && user.pkl?.is_pembimbing) {
      items.push(allNav.pkl)
    }

    // Menu Kokurikuler hanya saat ada projek aktif yang ia fasilitasi (fasilitator = wali kelas).
    if (user.kokurikuler?.is_fasilitator) {
      items.push(allNav.kokurikuler)
    }

    if (kap?.is_wali_kelas && kap?.is_bk) {
      // Keduanya → DUA EWS terpisah: "EWS Siswa" (kelas perwalian) di Menu Wali Kelas,
      // dan "EWS Murid BK" (kelas yang diampu BK) di Menu BK.
      items.push(
        withSection(allNav.presensiHarian, 'Menu Wali Kelas'),
        allNav.ews, allNav.siswa, allNav.refleksi,
        withSection(allNav.ewsBk, 'Menu BK'),
        allNav.catatanBK, allNav.riwayatDokumen,
      )
    } else if (kap?.is_wali_kelas) {
      items.push(
        withSection(allNav.presensiHarian, 'Menu Wali Kelas'),
        allNav.ews, allNav.siswa, allNav.refleksi, allNav.riwayatDokumen,
      )
    } else if (kap?.is_bk) {
      // BK (bukan wali kelas) TIDAK dapat allNav.siswa — halaman itu
      // (StudentPhotoManagePage, kelola foto+profil siswa) khusus wali kelas,
      // backend-nya (myClassStudents()) menolak non-wali-kelas dgn pesan "Anda bukan
      // wali kelas aktif". Dulu BK tetap dapat link ini di sidebar padahal selalu
      // berujung ditolak. EWS BK khusus kelas yang ia ampu (scope=bk).
      items.push(
        withSection(allNav.ewsBk, 'Menu BK'),
        allNav.catatanBK, allNav.riwayatDokumen,
      )
    }
  } else if (role === 'admin' || role === 'wakasek') {
    items.push(allNav.ews, allNav.ewsGuru, allNav.laporan, allNav.rekapPerkembangan, allNav.kalender, allNav.hariEfektif, allNav.riwayatDokumen, allNav.admin)
  } else if (role === 'siswa') {
    items.push(allNav.jadwalSaya)
    // Menu Kokurikuler hanya saat kelas siswa jadi peserta projek aktif.
    if (user.kokurikuler?.is_peserta) items.push(allNav.kokurikuler)
  } else if (role === 'orang_tua') {
    // minimal — hanya dashboard + profil
  }

  // Deduplikasi (is_bk dan is_wali_kelas bisa punya item yang sama)
  const seen  = new Set<string>()
  const dedup = items.filter(i => {
    if (seen.has(i.path)) return false
    seen.add(i.path)
    return true
  })

  // Semua peran (termasuk siswa & orang tua) bisa mengatur notifikasinya sendiri.
  dedup.push(allNav.notifikasi, allNav.profil)
  return dedup
}

// Backward compat
export type { UserType as UserRole }
