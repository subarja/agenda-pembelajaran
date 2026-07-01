import {
  LayoutDashboard, BookOpen, Users, ClipboardCheck, CalendarCheck,
  Star, AlertTriangle, FileBarChart, Settings, User, Target, ShieldCheck, UserCog,
  MessageSquare, Calendar, BarChart3, TrendingUp,
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
  siswa:         { label: 'Siswa',           path: '/siswa',           icon: Users },
  ews:           { label: 'EWS Siswa',       path: '/ews',             icon: AlertTriangle },
  ewsGuru:       { label: 'EWS Guru',        path: '/ews-guru',        icon: UserCog },
  laporan:       { label: 'Laporan',         path: '/laporan',         icon: FileBarChart },
  rekapPerkembangan: { label: 'Rekap Perkembangan', path: '/rekap-perkembangan', icon: TrendingUp },
  admin:         { label: 'Panel Admin',     path: '/admin',           icon: ShieldCheck },
  catatanBK:     { label: 'Catatan BK',      path: '/catatan-bk',      icon: MessageSquare },
  kalender:      { label: 'Kalender',        path: '/kalender',        icon: Calendar },
  hariEfektif:   { label: 'Minggu Efektif', path: '/hari-efektif',    icon: BarChart3 },
  pengaturan:    { label: 'Pengaturan',      path: '/pengaturan',      icon: Settings },
  profil:        { label: 'Profil',          path: '/profil',          icon: User },
}

function withSection(item: NavItem, label: string): NavItem {
  return { ...item, sectionLabel: label }
}

export function getNavForUser(user: UserType): NavItem[] {
  const role = user.role
  const kap  = user.kapabilitas

  const items: NavItem[] = [allNav.dashboard]

  if (role === 'guru') {
    items.push(allNav.agenda, allNav.tp, allNav.presensi, allNav.karakter, allNav.laporan, allNav.kalender, allNav.hariEfektif)

    if (kap?.is_wali_kelas && kap?.is_bk) {
      // keduanya
      items.push(
        withSection(allNav.presensiHarian, 'Menu Wali Kelas'),
        allNav.ews, allNav.siswa,
        withSection(allNav.catatanBK, 'Menu BK'),
      )
    } else if (kap?.is_wali_kelas) {
      items.push(
        withSection(allNav.presensiHarian, 'Menu Wali Kelas'),
        allNav.ews, allNav.siswa,
      )
    } else if (kap?.is_bk) {
      items.push(
        withSection(allNav.siswa, 'Menu BK'),
        allNav.ews, allNav.catatanBK,
      )
    }
  } else if (role === 'wali_kelas') {
    // Legacy role — backward compat
    items.push(allNav.agenda, allNav.tp, allNav.presensi, allNav.karakter, allNav.laporan)
    items.push(
      withSection(allNav.presensiHarian, 'Menu Wali Kelas'),
      allNav.ews, allNav.siswa,
    )
  } else if (role === 'bk') {
    // Legacy role — backward compat
    items.push(allNav.laporan)
    items.push(
      withSection(allNav.siswa, 'Menu BK'),
      allNav.ews, allNav.catatanBK,
    )
  } else if (role === 'admin' || role === 'wakasek') {
    items.push(allNav.ews, allNav.ewsGuru, allNav.laporan, allNav.rekapPerkembangan, allNav.kalender, allNav.hariEfektif, allNav.admin)
  } else if (role === 'siswa' || role === 'orang_tua') {
    // minimal — hanya dashboard + profil
  }

  // Deduplikasi (is_bk dan is_wali_kelas bisa punya item yang sama)
  const seen  = new Set<string>()
  const dedup = items.filter(i => {
    if (seen.has(i.path)) return false
    seen.add(i.path)
    return true
  })

  dedup.push(allNav.profil)
  return dedup
}

// Backward compat
export type { UserType as UserRole }
