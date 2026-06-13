import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, ClipboardCheck, Star, AlertTriangle,
  Users, GraduationCap, School, ShieldCheck,
  ChevronRight, TrendingUp, Bell, Heart, TrendingDown,
  Clock, CheckCircle2, XCircle, Info,
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
              { label: 'EWS Guru (Kepatuhan Agenda)', path: '/ews-guru', state: 0 },
              { label: 'Kelola Guru',              path: '/admin',    state: 0 },
              { label: 'Kelola Siswa',             path: '/admin',    state: 1 },
              { label: 'Kelola Jadwal',            path: '/admin',    state: 4 },
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
// WALI KELAS DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function WaliKelasDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: ewsData } = useQuery({
    queryKey: ['ews-wali'],
    queryFn: () => api.get('/ews').then(r => r.data),
  })
  const { data: scheduleData } = useQuery({
    queryKey: ['schedules-today'],
    queryFn: () => api.get('/schedules/today').then(r => r.data),
  })

  const ewsSummary  = ewsData?.meta?.summary ?? {}
  const ewsKritis   = (ewsSummary.merah ?? 0) + (ewsSummary.oranye ?? 0)
  const urgentList  = (ewsData?.data ?? [])
    .filter((s: any) => ['merah', 'oranye'].includes(s.level))
    .slice(0, 5)
  const todaySchedules = scheduleData?.data ?? []
  const belumIsi = todaySchedules.filter((s: any) => !s.agenda_hari_ini).length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Pantau Kelas Anda</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Halo, <span className="font-medium">{user?.nama}</span> — Wali Kelas
        </p>
      </div>

      {/* EWS ringkasan */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={AlertTriangle} label="EWS Kritis"  value={ewsKritis}                  color="text-red-600"    bg="bg-red-50"    onClick={() => navigate('/ews')} />
        <StatCard icon={TrendingUp}    label="EWS Kuning"  value={ewsSummary.kuning ?? 0}     color="text-yellow-600" bg="bg-yellow-50" onClick={() => navigate('/ews')} />
        <StatCard icon={Star}          label="EWS Hijau"   value={ewsSummary.hijau  ?? 0}     color="text-green-600"  bg="bg-green-50" />
        <StatCard icon={Users}         label="Total Siswa" value={ewsData?.meta?.total ?? '—'} color="text-blue-600"   bg="bg-blue-50" />
      </div>

      {/* Siswa perlu perhatian */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Siswa Perlu Perhatian
            </CardTitle>
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
                  <div key={s.student_id} onClick={() => navigate(`/ews/${s.student_id}`)}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 cursor-pointer">
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
                        <button onClick={() => navigate(`/agenda/baru?schedule=${s.id}`)}
                          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90">
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GURU DASHBOARD
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
const EWS_LABEL: Record<string, { label: string; color: string; bg: string; border: string }> = {
  hijau:  { label: 'Baik',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  kuning: { label: 'Perhatian', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  oranye: { label: 'Waspada', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  merah:  { label: 'Kritis',  color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200' },
}

function SiswaDashboard() {
  const user    = useAuthStore((s) => s.user)
  const studentId = user?.student?.id

  const { data: rekapRes, isLoading: loadingRekap } = useQuery({
    queryKey: ['siswa-rekap', studentId],
    queryFn: () => api.get(`/students/${studentId}/rekap`).then(r => r.data.data),
    enabled: !!studentId,
  })

  const { data: jadwalRes } = useQuery({
    queryKey: ['siswa-jadwal-today'],
    queryFn: () => api.get('/schedules/today-student').then(r => r.data.data),
    enabled: !!studentId,
  })

  const rekap   = rekapRes
  const jadwal  = jadwalRes ?? []

  // Hitung EWS dari dimensi
  let ewsLevel = 'hijau'
  if (rekap) {
    const warns = [
      rekap.kehadiran?.warning,
      rekap.karakter?.warning,
      rekap.nilai?.warning,
    ].filter(Boolean).length
    ewsLevel = warns >= 3 ? 'merah' : warns === 2 ? 'oranye' : warns === 1 ? 'kuning' : 'hijau'
  }

  const ews    = EWS_LABEL[ewsLevel] ?? EWS_LABEL.hijau
  const kelas  = user?.student?.kelas
  const kelasLabel = kelas ? `${kelas.tingkat} ${kelas.jurusan} - ${kelas.rombel}` : '—'

  const rekomendasiAktif = (rekap?.rekomendasi ?? []).filter(
    (r: any) => r.status === 'pending' || r.status === 'proses'
  )

  if (loadingRekap) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Semangat Belajar!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Halo, <span className="font-medium">{user?.nama}</span></p>
        </div>
        <Card><CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Memuat data...</p>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Semangat Belajar!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Halo, <span className="font-medium">{user?.nama}</span> · {kelasLabel}
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold border ${ews.color} ${ews.bg} ${ews.border}`}>
          {ews.label}
        </div>
      </div>

      {/* Rekomendasi aktif — tampil jika ada */}
      {rekomendasiAktif.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-orange-800">Ada Rekomendasi Tindakan</p>
                {rekomendasiAktif.slice(0, 2).map((r: any) => (
                  <p key={r.id} className="text-xs text-orange-700">• {r.rekomendasi}</p>
                ))}
                {rekomendasiAktif.length > 2 && (
                  <p className="text-xs text-orange-600">+{rekomendasiAktif.length - 2} lainnya — hubungi Wali Kelas atau BK</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Kehadiran */}
        <Card className={rekap?.kehadiran?.warning ? 'border-yellow-300' : ''}>
          <CardContent className="p-3 text-center">
            <div className={`inline-flex rounded-lg p-1.5 mb-2 ${rekap?.kehadiran?.warning ? 'bg-yellow-50' : 'bg-blue-50'}`}>
              <ClipboardCheck className={`h-4 w-4 ${rekap?.kehadiran?.warning ? 'text-yellow-600' : 'text-blue-600'}`} />
            </div>
            <p className="text-xl font-bold">
              {rekap?.kehadiran?.score !== undefined ? `${Math.round(rekap.kehadiran.score)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Kehadiran</p>
          </CardContent>
        </Card>

        {/* Poin Karakter */}
        <Card className={rekap?.karakter?.warning ? 'border-red-300' : ''}>
          <CardContent className="p-3 text-center">
            <div className={`inline-flex rounded-lg p-1.5 mb-2 ${rekap?.karakter?.warning ? 'bg-red-50' : 'bg-green-50'}`}>
              <Heart className={`h-4 w-4 ${rekap?.karakter?.warning ? 'text-red-500' : 'text-green-600'}`} />
            </div>
            <p className="text-xl font-bold">
              {rekap?.karakter?.net_score !== undefined
                ? (rekap.karakter.net_score > 0 ? `+${rekap.karakter.net_score}` : rekap.karakter.net_score)
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Poin Karakter</p>
          </CardContent>
        </Card>

        {/* Nilai Rata-rata */}
        <Card className={rekap?.nilai?.warning ? 'border-orange-300' : ''}>
          <CardContent className="p-3 text-center">
            <div className={`inline-flex rounded-lg p-1.5 mb-2 ${rekap?.nilai?.warning ? 'bg-orange-50' : 'bg-purple-50'}`}>
              <Star className={`h-4 w-4 ${rekap?.nilai?.warning ? 'text-orange-600' : 'text-purple-600'}`} />
            </div>
            <p className="text-xl font-bold">
              {rekap?.nilai?.avg !== null && rekap?.nilai?.avg !== undefined ? rekap.nilai.avg : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Nilai Rata-rata</p>
          </CardContent>
        </Card>
      </div>

      {/* Jadwal Hari Ini */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Jadwal Hari Ini
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jadwal.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada jadwal hari ini.</p>
            : (
              <div className="space-y-2">
                {jadwal.map((s: any) => (
                  <div key={s.id} className="rounded-lg border px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{s.subject?.nama}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.jam_mulai?.slice(0, 5)}–{s.jam_selesai?.slice(0, 5)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Guru: {s.guru}</p>
                    {s.agenda_hari_ini && (
                      <div className="mt-1.5 rounded-md bg-muted/40 px-2 py-1.5">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Materi: </span>
                          {s.agenda_hari_ini.tp || s.agenda_hari_ini.resume || 'Agenda sudah diisi'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>

      {/* Rekap Kehadiran Detail */}
      {rekap?.kehadiran && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Rekap Kehadiran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Hadir',  value: rekap.kehadiran.hadir,  color: 'text-green-700',  bg: 'bg-green-50' },
                { label: 'Sakit',  value: rekap.kehadiran.sakit,  color: 'text-blue-700',   bg: 'bg-blue-50' },
                { label: 'Izin',   value: rekap.kehadiran.izin,   color: 'text-yellow-700', bg: 'bg-yellow-50' },
                { label: 'Alpha',  value: rekap.kehadiran.alpha,  color: 'text-red-700',    bg: 'bg-red-50' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-lg p-2 ${bg}`}>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {rekap.kehadiran.recent_absences?.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Ketidakhadiran Terbaru</p>
                <div className="space-y-1">
                  {rekap.kehadiran.recent_absences.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{a.tanggal}</span>
                      <Badge className={
                        a.status === 'alpha' ? 'bg-red-100 text-red-700' :
                        a.status === 'sakit' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>{a.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Poin Karakter Detail */}
      {rekap?.karakter && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Poin Karakter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-green-700">+{rekap.karakter.total_positif}</p>
                <p className="text-xs text-muted-foreground">Positif</p>
              </div>
              <div className="text-2xl font-bold text-muted-foreground">·</div>
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-red-700">−{rekap.karakter.total_negatif}</p>
                <p className="text-xs text-muted-foreground">Negatif</p>
              </div>
              <div className="text-2xl font-bold text-muted-foreground">·</div>
              <div className="flex-1 text-center">
                <p className={`text-lg font-bold ${rekap.karakter.net_score >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {rekap.karakter.net_score > 0 ? `+${rekap.karakter.net_score}` : rekap.karakter.net_score}
                </p>
                <p className="text-xs text-muted-foreground">Net</p>
              </div>
            </div>

            {rekap.karakter.riwayat?.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Riwayat Terbaru</p>
                <div className="space-y-1.5">
                  {rekap.karakter.riwayat.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {r.sign === 'positif'
                          ? <TrendingUp className="h-3 w-3 text-green-600 shrink-0" />
                          : <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />}
                        <span className="truncate text-muted-foreground">{r.subitem}</span>
                      </div>
                      <span className={`shrink-0 font-semibold ml-2 ${r.poin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {r.poin > 0 ? `+${r.poin}` : r.poin}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status EWS 4 Dimensi */}
      {rekap && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Status EWS Saya
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: 'Kehadiran', value: `${Math.round(rekap.kehadiran?.score ?? 100)}%`, warning: rekap.kehadiran?.warning, detail: 'Min 80%' },
                { label: 'Karakter',  value: rekap.karakter?.net_score ?? 0, warning: rekap.karakter?.warning, detail: 'Min 0 poin' },
                { label: 'Nilai',     value: rekap.nilai?.avg !== null && rekap.nilai?.avg !== undefined ? rekap.nilai.avg : '—', warning: rekap.nilai?.warning, detail: 'Min 70' },
              ].map(({ label, value, warning, detail }) => (
                <div key={label} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {warning
                      ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${warning ? 'text-red-600' : 'text-green-700'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ORANG TUA DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function OrangTuaDashboard() {
  const user      = useAuthStore((s) => s.user)
  const childId   = user?.linked_student?.id
  const childNama = user?.linked_student?.nama
  const kelas     = user?.linked_student?.kelas
  const kelasLabel = kelas ? `${kelas.tingkat} ${kelas.jurusan} - ${kelas.rombel}` : '—'

  const { data: rekapRes, isLoading } = useQuery({
    queryKey: ['ortu-rekap', childId],
    queryFn: () => api.get(`/students/${childId}/rekap`).then(r => r.data.data),
    enabled: !!childId,
  })

  const rekap = rekapRes

  let ewsLevel = 'hijau'
  if (rekap) {
    const warns = [rekap.kehadiran?.warning, rekap.karakter?.warning, rekap.nilai?.warning].filter(Boolean).length
    ewsLevel = warns >= 3 ? 'merah' : warns === 2 ? 'oranye' : warns === 1 ? 'kuning' : 'hijau'
  }
  const ews = EWS_LABEL[ewsLevel] ?? EWS_LABEL.hijau

  if (!childId) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Pantau Perkembangan Anak</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Halo, <span className="font-medium">{user?.nama}</span></p>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Akun belum dihubungkan ke siswa.</p>
            <p className="text-xs text-muted-foreground mt-1">Hubungi admin sekolah untuk menghubungkan akun Anda ke data anak.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Pantau Perkembangan Anak</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Memuat data <span className="font-medium">{childNama}</span>...</p>
        </div>
        <Card><CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </CardContent></Card>
      </div>
    )
  }

  const rekomendasiAktif = (rekap?.rekomendasi ?? []).filter(
    (r: any) => r.status === 'pending' || r.status === 'proses'
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Pantau Perkembangan Anak</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-medium">{childNama}</span> · {kelasLabel}
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold border ${ews.color} ${ews.bg} ${ews.border}`}>
          {ews.label}
        </div>
      </div>

      {/* Alert rekomendasi */}
      {rekomendasiAktif.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-orange-800">Ada Tindakan yang Perlu Diperhatikan</p>
                {rekomendasiAktif.slice(0, 2).map((r: any) => (
                  <p key={r.id} className="text-xs text-orange-700">• {r.rekomendasi}</p>
                ))}
                <p className="text-xs text-orange-600 mt-1">Silakan hubungi Wali Kelas atau guru BK untuk informasi lebih lanjut.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={rekap?.kehadiran?.warning ? 'border-yellow-300' : ''}>
          <CardContent className="p-3 text-center">
            <div className={`inline-flex rounded-lg p-1.5 mb-2 ${rekap?.kehadiran?.warning ? 'bg-yellow-50' : 'bg-blue-50'}`}>
              <ClipboardCheck className={`h-4 w-4 ${rekap?.kehadiran?.warning ? 'text-yellow-600' : 'text-blue-600'}`} />
            </div>
            <p className="text-xl font-bold">
              {rekap?.kehadiran?.score !== undefined ? `${Math.round(rekap.kehadiran.score)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Kehadiran</p>
          </CardContent>
        </Card>
        <Card className={rekap?.karakter?.warning ? 'border-red-300' : ''}>
          <CardContent className="p-3 text-center">
            <div className={`inline-flex rounded-lg p-1.5 mb-2 ${rekap?.karakter?.warning ? 'bg-red-50' : 'bg-green-50'}`}>
              <Heart className={`h-4 w-4 ${rekap?.karakter?.warning ? 'text-red-500' : 'text-green-600'}`} />
            </div>
            <p className="text-xl font-bold">
              {rekap?.karakter?.net_score !== undefined
                ? (rekap.karakter.net_score > 0 ? `+${rekap.karakter.net_score}` : rekap.karakter.net_score)
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Poin Karakter</p>
          </CardContent>
        </Card>
        <Card className={rekap?.nilai?.warning ? 'border-orange-300' : ''}>
          <CardContent className="p-3 text-center">
            <div className={`inline-flex rounded-lg p-1.5 mb-2 ${rekap?.nilai?.warning ? 'bg-orange-50' : 'bg-purple-50'}`}>
              <Star className={`h-4 w-4 ${rekap?.nilai?.warning ? 'text-orange-600' : 'text-purple-600'}`} />
            </div>
            <p className="text-xl font-bold">
              {rekap?.nilai?.avg !== null && rekap?.nilai?.avg !== undefined ? rekap.nilai.avg : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Nilai Rata-rata</p>
          </CardContent>
        </Card>
      </div>

      {/* Rekap Kehadiran */}
      {rekap?.kehadiran && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Rekap Kehadiran Anak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Hadir',  value: rekap.kehadiran.hadir,  color: 'text-green-700',  bg: 'bg-green-50' },
                { label: 'Sakit',  value: rekap.kehadiran.sakit,  color: 'text-blue-700',   bg: 'bg-blue-50' },
                { label: 'Izin',   value: rekap.kehadiran.izin,   color: 'text-yellow-700', bg: 'bg-yellow-50' },
                { label: 'Alpha',  value: rekap.kehadiran.alpha,  color: 'text-red-700',    bg: 'bg-red-50' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-lg p-2 ${bg}`}>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {rekap.kehadiran.recent_absences?.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Ketidakhadiran Terbaru</p>
                <div className="space-y-1">
                  {rekap.kehadiran.recent_absences.map((a: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{a.tanggal}</span>
                      <Badge className={
                        a.status === 'alpha' ? 'bg-red-100 text-red-700' :
                        a.status === 'sakit' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }>{a.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Poin Karakter */}
      {rekap?.karakter && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Poin Karakter Anak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-green-700">+{rekap.karakter.total_positif}</p>
                <p className="text-xs text-muted-foreground">Positif</p>
              </div>
              <div className="text-2xl font-bold text-muted-foreground">·</div>
              <div className="flex-1 text-center">
                <p className="text-lg font-bold text-red-700">−{rekap.karakter.total_negatif}</p>
                <p className="text-xs text-muted-foreground">Negatif</p>
              </div>
              <div className="text-2xl font-bold text-muted-foreground">·</div>
              <div className="flex-1 text-center">
                <p className={`text-lg font-bold ${rekap.karakter.net_score >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {rekap.karakter.net_score > 0 ? `+${rekap.karakter.net_score}` : rekap.karakter.net_score}
                </p>
                <p className="text-xs text-muted-foreground">Net</p>
              </div>
            </div>
            {rekap.karakter.riwayat?.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Riwayat Terbaru</p>
                <div className="space-y-1.5">
                  {rekap.karakter.riwayat.slice(0, 5).map((r: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {r.sign === 'positif'
                          ? <TrendingUp className="h-3 w-3 text-green-600 shrink-0" />
                          : <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />}
                        <span className="truncate text-muted-foreground">{r.subitem}</span>
                      </div>
                      <span className={`shrink-0 font-semibold ml-2 ${r.poin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {r.poin > 0 ? `+${r.poin}` : r.poin}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status EWS */}
      {rekap && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Status EWS Anak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: 'Kehadiran', value: `${Math.round(rekap.kehadiran?.score ?? 100)}%`, warning: rekap.kehadiran?.warning, detail: 'Min 80%' },
                { label: 'Karakter',  value: rekap.karakter?.net_score ?? 0, warning: rekap.karakter?.warning, detail: 'Min 0 poin' },
                { label: 'Nilai',     value: rekap.nilai?.avg !== null && rekap.nilai?.avg !== undefined ? rekap.nilai.avg : '—', warning: rekap.nilai?.warning, detail: 'Min 70' },
              ].map(({ label, value, warning, detail }) => (
                <div key={label} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {warning
                      ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{detail}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${warning ? 'text-red-600' : 'text-green-700'}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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
    case 'admin':      return <AdminDashboard />
    case 'wakasek':    return <WakasekDashboard />
    case 'guru':       return <GuruDashboard />
    case 'wali_kelas': return <WaliKelasDashboard />
    case 'bk':         return <BkDashboard />
    case 'orang_tua':  return <OrangTuaDashboard />
    default:           return <SiswaDashboard />
  }
}
