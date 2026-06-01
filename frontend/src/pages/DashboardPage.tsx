import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, ClipboardCheck, Star, AlertTriangle,
  Users, GraduationCap, School, ShieldCheck,
  ChevronRight, TrendingUp, Bell,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ─────────────────────────────────────────────────────────────────────────────
// Shared: stat card kecil
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color, bg, onClick,
}: {
  icon: React.ElementType; label: string; value: string | number
  color: string; bg: string; onClick?: () => void
}) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={onClick}>
      <CardContent className="p-4">
        <div className={`inline-flex rounded-lg p-2 ${bg} mb-3`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}

// Badge level EWS
const LEVEL_BADGE: Record<string, string> = {
  hijau:  'bg-green-100 text-green-800',
  kuning: 'bg-yellow-100 text-yellow-800',
  oranye: 'bg-orange-100 text-orange-800',
  merah:  'bg-red-100 text-red-800',
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const navigate = useNavigate()

  const { data: teachers }  = useQuery({ queryKey: ['admin-teachers-count'], queryFn: () => api.get('/admin/teachers').then(r => r.data) })
  const { data: students }  = useQuery({ queryKey: ['admin-students-count'], queryFn: () => api.get('/admin/students').then(r => r.data) })
  const { data: classes }   = useQuery({ queryKey: ['admin-classes'],        queryFn: () => api.get('/admin/classes').then(r => r.data) })
  const { data: ewsData }   = useQuery({ queryKey: ['ews-summary'],          queryFn: () => api.get('/ews').then(r => r.data) })
  const { data: notifData } = useQuery({ queryKey: ['notifications'],        queryFn: () => api.get('/notifications?unread=1').then(r => r.data) })

  const totalGuru    = teachers?.meta?.total ?? '—'
  const totalSiswa   = students?.meta?.total ?? '—'
  const totalKelas   = classes?.data?.length ?? '—'
  const ewsSummary   = ewsData?.meta?.summary ?? {}
  const unread       = notifData?.unread_count ?? 0
  const ewsKritis    = (ewsSummary.merah ?? 0) + (ewsSummary.oranye ?? 0)

  // Siswa EWS oranye/merah untuk ditindaklanjuti
  const urgentStudents = (ewsData?.data ?? []).filter(
    (s: any) => s.level === 'merah' || s.level === 'oranye'
  ).slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold">Panel Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ringkasan data sekolah hari ini</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={GraduationCap} label="Total Guru" value={totalGuru}
          color="text-blue-600" bg="bg-blue-50"
          onClick={() => navigate('/admin')}
        />
        <StatCard
          icon={Users} label="Total Siswa" value={totalSiswa}
          color="text-green-600" bg="bg-green-50"
          onClick={() => navigate('/admin')}
        />
        <StatCard
          icon={School} label="Total Kelas" value={totalKelas}
          color="text-purple-600" bg="bg-purple-50"
          onClick={() => navigate('/admin')}
        />
        <StatCard
          icon={AlertTriangle} label="EWS Kritis" value={ewsKritis}
          color="text-red-600" bg="bg-red-50"
          onClick={() => navigate('/ews')}
        />
      </div>

      {/* EWS Distribusi */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Distribusi EWS Siswa</CardTitle>
            <button
              onClick={() => navigate('/ews')}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Lihat semua <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {[
              { level: 'hijau',  label: 'Hijau',  count: ewsSummary.hijau  ?? 0 },
              { level: 'kuning', label: 'Kuning', count: ewsSummary.kuning ?? 0 },
              { level: 'oranye', label: 'Oranye', count: ewsSummary.oranye ?? 0 },
              { level: 'merah',  label: 'Merah',  count: ewsSummary.merah  ?? 0 },
            ].map(({ level, label, count }) => (
              <div key={level} className="text-center">
                <p className={`text-2xl font-bold ${
                  level === 'hijau' ? 'text-green-700' :
                  level === 'kuning' ? 'text-yellow-700' :
                  level === 'oranye' ? 'text-orange-700' : 'text-red-700'
                }`}>{count}</p>
                <Badge className={`mt-1 ${LEVEL_BADGE[level]}`}>{label}</Badge>
              </div>
            ))}
          </div>

          {/* Siswa kritis */}
          {urgentStudents.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Perlu Tindak Lanjut Segera</p>
              <div className="space-y-2">
                {urgentStudents.map((s: any) => (
                  <div
                    key={s.student_id}
                    onClick={() => navigate(`/siswa/${s.student_id}/rekap`)}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.nama}</p>
                      <p className="text-xs text-muted-foreground">{s.kelas}</p>
                    </div>
                    <Badge className={LEVEL_BADGE[s.level]}>{s.level}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifikasi & Aksi Cepat */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Notifikasi */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifikasi
              {unread > 0 && <Badge className="bg-red-100 text-red-700">{unread} baru</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unread === 0
              ? <p className="text-sm text-muted-foreground">Tidak ada notifikasi baru.</p>
              : <p className="text-sm text-muted-foreground">
                  Ada <strong>{unread}</strong> notifikasi yang belum dibaca. Klik lonceng di pojok atas untuk melihat.
                </p>
            }
          </CardContent>
        </Card>

        {/* Aksi cepat */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Aksi Cepat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Kelola Guru',         path: '/admin', state: 0 },
              { label: 'Kelola Siswa',        path: '/admin', state: 1 },
              { label: 'Kelola Jadwal',       path: '/admin', state: 4 },
              { label: 'Struktur Karakter',   path: '/admin', state: 5 },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              >
                {item.label}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GURU / WALI KELAS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function GuruDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: scheduleData } = useQuery({
    queryKey: ['schedules-today'],
    queryFn: () => api.get('/schedules/today').then(r => r.data),
  })

  const { data: agendaData } = useQuery({
    queryKey: ['agendas-recent'],
    queryFn: () => api.get('/agendas?limit=5').then(r => r.data),
  })

  const todaySchedules = scheduleData?.data ?? []
  const recentAgendas  = agendaData?.data ?? []
  const totalAgenda    = agendaData?.meta?.total ?? 0
  const belumIsi       = todaySchedules.filter((s: any) => !s.agenda_hari_ini).length

  const greet = user?.role === 'wali_kelas' ? 'Pantau kelas Anda' : 'Selamat mengajar hari ini'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{greet}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Halo, <span className="font-medium">{user?.nama}</span></p>
      </div>

      {/* Jadwal hari ini */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Jadwal Hari Ini</CardTitle>
            {belumIsi > 0 && (
              <Badge className="bg-orange-100 text-orange-700">{belumIsi} belum diisi</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {todaySchedules.length === 0
            ? <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada jadwal mengajar hari ini.</p>
            : (
              <div className="space-y-2">
                {todaySchedules.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{s.subject?.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.class?.label} · {s.jam_mulai?.slice(0,5)}–{s.jam_selesai?.slice(0,5)}
                      </p>
                    </div>
                    {s.agenda_hari_ini
                      ? <Badge className="bg-green-100 text-green-700">Sudah diisi</Badge>
                      : (
                        <button
                          onClick={() => navigate(`/agenda/baru?schedule=${s.id}`)}
                          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90"
                        >
                          Isi Agenda
                        </button>
                      )
                    }
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>

      {/* Stat mini */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={BookOpen} label="Total Agenda" value={totalAgenda}
          color="text-blue-600" bg="bg-blue-50"
          onClick={() => navigate('/agenda')}
        />
        <StatCard
          icon={ClipboardCheck} label="Jadwal Hari Ini" value={todaySchedules.length}
          color="text-green-600" bg="bg-green-50"
        />
      </div>

      {/* Agenda terbaru */}
      {recentAgendas.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Agenda Terbaru</CardTitle>
              <button onClick={() => navigate('/agenda')} className="flex items-center gap-1 text-xs text-primary hover:underline">
                Lihat semua <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentAgendas.slice(0, 4).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{a.schedule?.subject?.nama}</p>
                  <p className="text-xs text-muted-foreground">{a.schedule?.class?.label} · {a.tanggal}</p>
                </div>
                <Badge className={a.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                  {a.status === 'submitted' ? 'Selesai' : 'Draft'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WAKASEK DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function WakasekDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: ewsData }  = useQuery({ queryKey: ['ews-summary'], queryFn: () => api.get('/ews').then(r => r.data) })
  const { data: classData} = useQuery({ queryKey: ['admin-classes'], queryFn: () => api.get('/admin/classes').then(r => r.data) })

  const ewsSummary  = ewsData?.meta?.summary ?? {}
  const ewsKritis   = (ewsSummary.merah ?? 0) + (ewsSummary.oranye ?? 0)
  const urgentList  = (ewsData?.data ?? []).filter((s: any) => ['merah','oranye'].includes(s.level)).slice(0, 6)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Monitoring Kurikulum</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Halo, <span className="font-medium">{user?.nama}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={School}        label="Total Kelas"  value={classData?.data?.length ?? '—'} color="text-purple-600" bg="bg-purple-50" onClick={() => navigate('/admin')} />
        <StatCard icon={AlertTriangle} label="EWS Kritis"  value={ewsKritis}                       color="text-red-600"    bg="bg-red-50"    onClick={() => navigate('/ews')} />
        <StatCard icon={TrendingUp}    label="EWS Kuning"  value={ewsSummary.kuning ?? 0}          color="text-yellow-600" bg="bg-yellow-50" onClick={() => navigate('/ews')} />
        <StatCard icon={Star}          label="EWS Hijau"   value={ewsSummary.hijau  ?? 0}          color="text-green-600"  bg="bg-green-50" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Siswa Perlu Perhatian</CardTitle>
            <button onClick={() => navigate('/ews')} className="flex items-center gap-1 text-xs text-primary hover:underline">
              EWS Lengkap <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {urgentList.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada siswa dengan status kritis.</p>
            : (
              <div className="space-y-2">
                {urgentList.map((s: any) => (
                  <div key={s.student_id} onClick={() => navigate(`/siswa/${s.student_id}/rekap`)} className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{s.nama}</p>
                      <p className="text-xs text-muted-foreground">{s.kelas}</p>
                    </div>
                    <Badge className={LEVEL_BADGE[s.level]}>{s.level}</Badge>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BK DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function BkDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: ewsData } = useQuery({ queryKey: ['ews-summary'], queryFn: () => api.get('/ews').then(r => r.data) })

  const urgentList = (ewsData?.data ?? []).filter((s: any) => ['merah','oranye'].includes(s.level))
  const ewsSummary = ewsData?.meta?.summary ?? {}

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Bimbingan & Konseling</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Halo, <span className="font-medium">{user?.nama}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={AlertTriangle} label="Oranye + Merah" value={(ewsSummary.merah ?? 0) + (ewsSummary.oranye ?? 0)} color="text-red-600" bg="bg-red-50" onClick={() => navigate('/ews')} />
        <StatCard icon={Users}         label="Total Terpantau" value={(ewsData?.meta?.total ?? 0)} color="text-blue-600" bg="bg-blue-50" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Antrian Intervensi</CardTitle>
        </CardHeader>
        <CardContent>
          {urgentList.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada siswa dengan status kritis saat ini.</p>
            : (
              <div className="space-y-2">
                {urgentList.slice(0,8).map((s: any) => (
                  <div key={s.student_id} onClick={() => navigate(`/siswa/${s.student_id}/rekap`)} className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{s.nama}</p>
                      <p className="text-xs text-muted-foreground">{s.kelas}</p>
                    </div>
                    <div className="text-right">
                      <Badge className={LEVEL_BADGE[s.level]}>{s.level}</Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">hadir {s.kehadiran_score?.toFixed(0)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SISWA DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function SiswaDashboard() {
  const user = useAuthStore((s) => s.user)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Semangat Belajar!</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Halo, <span className="font-medium">{user?.nama}</span></p>
      </div>
      <Card>
        <CardContent className="py-10 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Dashboard siswa segera hadir.</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: pilih dashboard sesuai role
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  switch (user.role) {
    case 'admin':     return <AdminDashboard />
    case 'wakasek':   return <WakasekDashboard />
    case 'guru':
    case 'wali_kelas':return <GuruDashboard />
    case 'bk':        return <BkDashboard />
    default:          return <SiswaDashboard />
  }
}
