import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Clock, User,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
} from 'lucide-react'
import api from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

// ── API ───────────────────────────────────────────────────────────────────────
function fetchRekap(uuid: string) {
  return api.get(`/students/${uuid}/rekap`).then(r => r.data.data)
}
function updateRekomendasi(studentUuid: string, rekUuid: string, data: object) {
  return api.put(`/students/${studentUuid}/rekap/rekomendasi/${rekUuid}`, data).then(r => r.data)
}

// ── Level badge ───────────────────────────────────────────────────────────────
const LEVEL_ICON: Record<string, typeof CheckCircle2> = {
  hijau: CheckCircle2, kuning: Clock, oranye: AlertTriangle, merah: AlertTriangle,
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, badge, children, defaultOpen = true }: {
  title: string; badge?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border bg-card">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t px-4 py-4">{children}</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentRekapPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['student-rekap', studentId],
    queryFn: () => fetchRekap(studentId!),
    enabled: !!studentId,
  })

  const updRek = useMutation({
    mutationFn: ({ rekUuid, status, hasil }: { rekUuid: string; status: string; hasil?: string }) =>
      updateRekomendasi(studentId!, rekUuid, { status, hasil_tindak_lanjut: hasil }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student-rekap', studentId] }),
  })

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )

  if (error || !data) return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Gagal memuat rekap siswa.</p>
    </div>
  )

  const { profil, kehadiran, karakter, nilai, rekomendasi, riwayat_bulanan } = data

  // Hitung level EWS dari dimensi
  const warnCount = [kehadiran.warning, karakter.warning, nilai.warning].filter(Boolean).length
  const level = warnCount >= 3 ? 'merah' : warnCount === 2 ? 'oranye' : warnCount === 1 ? 'kuning' : 'hijau'
  const LevelIcon = LEVEL_ICON[level]

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold leading-tight">{profil.nama}</h1>
          <p className="text-sm text-muted-foreground">NIS {profil.nis} · {profil.kelas?.label ?? '—'}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: level === 'hijau' ? '#dcfce7' : level === 'kuning' ? '#fef9c3' : level === 'oranye' ? '#ffedd5' : '#fee2e2',
                   color: level === 'hijau' ? '#166534' : level === 'kuning' ? '#854d0e' : level === 'oranye' ? '#9a3412' : '#991b1b' }}>
          <LevelIcon className="h-3.5 w-3.5" />
          {level}
        </div>
      </div>

      {/* Dimensi ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <DimensiCard
          label="Kehadiran"
          value={`${kehadiran.score.toFixed(1)}%`}
          sub={`${kehadiran.hadir}/${kehadiran.total} sesi`}
          warning={kehadiran.warning}
          barValue={kehadiran.score}
          barColor={kehadiran.score >= 85 ? 'bg-green-500' : kehadiran.score >= 75 ? 'bg-yellow-500' : 'bg-red-500'}
        />
        <DimensiCard
          label="Karakter"
          value={`${karakter.net_score > 0 ? '+' : ''}${karakter.net_score}`}
          sub={`${karakter.count} input`}
          warning={karakter.warning}
          barValue={Math.max(0, karakter.net_score + 50)}
          barMax={100}
          barColor={karakter.net_score >= 10 ? 'bg-green-500' : karakter.net_score >= 0 ? 'bg-yellow-500' : 'bg-red-500'}
        />
        <DimensiCard
          label="Nilai Aktivitas"
          value={nilai.avg != null ? `${nilai.avg}` : '—'}
          sub={nilai.count > 0 ? `${nilai.count} entri` : 'Belum ada'}
          warning={nilai.warning}
          barValue={nilai.avg ?? 0}
          barColor={!nilai.avg || nilai.avg >= 75 ? 'bg-green-500' : 'bg-red-500'}
        />
      </div>

      {/* Riwayat Bulanan */}
      <Section title="Tren 6 Bulan Terakhir">
        <div className="space-y-2">
          {riwayat_bulanan.map((b: any) => (
            <div key={b.bulan} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">{b.bulan}</span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">Kehadiran</span>
                  {b.kehadiran != null
                    ? <><ScoreBar value={b.kehadiran} color={b.kehadiran >= 80 ? 'bg-green-500' : 'bg-red-500'} /><span className="w-10 text-right text-xs">{b.kehadiran}%</span></>
                    : <span className="text-xs text-muted-foreground italic">—</span>
                  }
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium w-16 justify-end">
                {b.poin > 0 ? <TrendingUp className="h-3.5 w-3.5 text-green-600" /> : b.poin < 0 ? <TrendingDown className="h-3.5 w-3.5 text-red-600" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={b.poin > 0 ? 'text-green-700' : b.poin < 0 ? 'text-red-700' : 'text-muted-foreground'}>
                  {b.poin > 0 ? `+${b.poin}` : b.poin}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Riwayat Karakter */}
      <Section
        title="Riwayat Karakter"
        badge={<Badge variant="outline" className="text-xs">{karakter.count} total</Badge>}
      >
        {/* Per Kategori */}
        {karakter.per_kategori.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            {karakter.per_kategori.map((k: any) => (
              <div key={k.nama} className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">{k.nama}</p>
                <p className={`text-lg font-bold ${k.score > 0 ? 'text-green-700' : k.score < 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
                  {k.score > 0 ? `+${k.score}` : k.score}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* 10 input terbaru */}
        <div className="space-y-2">
          {karakter.riwayat.length === 0
            ? <p className="text-sm text-muted-foreground italic text-center py-4">Belum ada penilaian karakter.</p>
            : karakter.riwayat.map((r: any, i: number) => (
              <div key={i} className="flex gap-3 rounded-md bg-muted/40 p-3">
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${r.sign === 'positif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {r.sign === 'positif' ? '+' : '−'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.subitem}</p>
                  <p className="text-xs text-muted-foreground">{r.kategori} · {r.guru} · {r.tanggal}</p>
                  {r.catatan && <p className="text-xs text-muted-foreground italic mt-0.5">"{r.catatan}"</p>}
                </div>
                <span className={`shrink-0 text-sm font-bold ${r.poin > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {r.poin > 0 ? `+${r.poin}` : r.poin}
                </span>
              </div>
            ))
          }
        </div>
      </Section>

      {/* Kehadiran detail */}
      <Section title="Detail Kehadiran" badge={<Badge variant="outline" className="text-xs">{kehadiran.total} sesi</Badge>}>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[['Hadir', kehadiran.hadir, 'text-green-700'], ['Sakit', kehadiran.sakit, 'text-blue-700'], ['Izin', kehadiran.izin, 'text-yellow-700'], ['Alpha', kehadiran.alpha, 'text-red-700']].map(([label, val, cls]) => (
            <div key={label as string} className="rounded-md border px-2 py-2 text-center">
              <p className="text-xs text-muted-foreground">{label as string}</p>
              <p className={`text-xl font-bold ${cls as string}`}>{val as number}</p>
            </div>
          ))}
        </div>
        {kehadiran.max_alpha_streak > 0 && (
          <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 mb-3">
            Alpha berturut-turut terpanjang: <strong>{kehadiran.max_alpha_streak} sesi</strong>
          </p>
        )}
        {kehadiran.recent_absences.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">5 Ketidakhadiran Terbaru</p>
            <div className="space-y-1">
              {kehadiran.recent_absences.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{a.tanggal}</span>
                  <Badge className={a.status === 'alpha' ? 'bg-red-100 text-red-700' : a.status === 'sakit' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}>
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Rekomendasi */}
      <Section
        title="Rekomendasi Tindakan"
        badge={rekomendasi.filter((r: any) => r.status === 'pending').length > 0
          ? <Badge className="bg-red-100 text-red-700 text-xs">{rekomendasi.filter((r: any) => r.status === 'pending').length} pending</Badge>
          : undefined}
      >
        {rekomendasi.length === 0
          ? <p className="text-sm text-muted-foreground italic text-center py-4">Tidak ada rekomendasi aktif.</p>
          : rekomendasi.map((r: any) => (
            <div key={r.id} className="mb-3 rounded-md border p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium leading-snug">{r.rekomendasi}</p>
                <Badge className={r.sifat === 'positif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 shrink-0'}>
                  {r.sifat}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                <span>Akumulasi saat trigger: <strong>{r.akumulasi}</strong></span>
                {r.ditugaskan_ke && <span>Ditugaskan: {r.ditugaskan_ke}</span>}
                <span>{r.dibuat_pada}</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={r.status}
                  onChange={(e) => updRek.mutate({ rekUuid: r.id, status: e.target.value })}
                  className="h-7 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value="pending">Pending</option>
                  <option value="proses">Sedang Diproses</option>
                  <option value="selesai">Selesai</option>
                  <option value="diabaikan">Diabaikan</option>
                </select>
                {r.status === 'selesai' && r.hasil && (
                  <span className="text-xs text-muted-foreground italic">"{r.hasil}"</span>
                )}
              </div>
            </div>
          ))
        }
      </Section>

      {/* Info wali */}
      {profil.wali_nama && (
        <Section title="Kontak Wali" defaultOpen={false}>
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{profil.wali_nama}</p>
              {profil.wali_kontak && <p className="text-sm text-muted-foreground">{profil.wali_kontak}</p>}
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}

// ── DimensiCard ────────────────────────────────────────────────────────────────
function DimensiCard({ label, value, sub, warning, barValue, barMax = 100, barColor }: {
  label: string; value: string; sub: string; warning: boolean
  barValue: number; barMax?: number; barColor: string
}) {
  return (
    <div className={`rounded-lg border p-3 ${warning ? 'border-red-200 bg-red-50' : 'bg-card'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${warning ? 'text-red-700' : 'text-foreground'}`}>{value}</p>
      <ScoreBar value={barValue} max={barMax} color={barColor} />
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}
