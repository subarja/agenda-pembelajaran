import {
  LayoutDashboard, BookOpen, Users, ClipboardCheck, CalendarCheck,
  Star, AlertTriangle, FileBarChart, Settings, User, Target, ShieldCheck, UserCog,
} from 'lucide-react'
import type { UserRole } from '@/types'

export interface NavItem {
  label: string
  path: string
  icon: React.ElementType
}

const allNav: Record<string, NavItem> = {
  dashboard:  { label: 'Dashboard',      path: '/',           icon: LayoutDashboard },
  agenda:     { label: 'Agenda',         path: '/agenda',     icon: BookOpen },
  tp:         { label: 'Tujuan Pemb.',   path: '/tp',         icon: Target },
  presensi:      { label: 'Presensi',         path: '/presensi',        icon: ClipboardCheck },
  presensiHarian:{ label: 'Presensi Harian', path: '/presensi-harian', icon: CalendarCheck },
  karakter:   { label: 'Karakter',       path: '/karakter',   icon: Star },
  siswa:      { label: 'Siswa',          path: '/siswa',      icon: Users },
  ews:        { label: 'EWS Siswa',      path: '/ews',        icon: AlertTriangle },
  ewsGuru:    { label: 'EWS Guru',       path: '/ews-guru',   icon: UserCog },
  laporan:    { label: 'Laporan',        path: '/laporan',    icon: FileBarChart },
  admin:      { label: 'Panel Admin',    path: '/admin',      icon: ShieldCheck },
  pengaturan: { label: 'Pengaturan',     path: '/pengaturan', icon: Settings },
  profil:     { label: 'Profil',         path: '/profil',     icon: User },
}

export const navByRole: Record<UserRole, NavItem[]> = {
  admin: [
    allNav.dashboard, allNav.ews, allNav.ewsGuru, allNav.laporan, allNav.admin, allNav.profil,
  ],
  guru: [
    allNav.dashboard, allNav.agenda, allNav.tp,
    allNav.presensi, allNav.karakter, allNav.laporan, allNav.profil,
  ],
  wali_kelas: [
    allNav.dashboard, allNav.agenda, allNav.tp,
    allNav.presensi, allNav.presensiHarian, allNav.karakter, allNav.ews, allNav.siswa, allNav.laporan, allNav.profil,
  ],
  wakasek: [
    allNav.dashboard, allNav.ews, allNav.ewsGuru, allNav.laporan, allNav.admin, allNav.profil,
  ],
  bk: [
    allNav.dashboard, allNav.siswa, allNav.ews, allNav.laporan, allNav.profil,
  ],
  siswa: [
    allNav.dashboard, allNav.profil,
  ],
  orang_tua: [
    allNav.dashboard, allNav.profil,
  ],
}
