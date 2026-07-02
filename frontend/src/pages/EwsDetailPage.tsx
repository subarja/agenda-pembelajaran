import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, ClipboardList,
  Plus, Pencil, Trash2, Link, FileDown, UserPlus, MessageSquare,
  ShieldCheck, Clock, ChevronDown, ChevronUp, X,
  Calendar, Star, BookOpen, TrendingUp,
} from 'lucide-react'
import { ewsApi } from '@/features/ews/api'
import type { EwsLevel } from '@/features/ews/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { usePdfPreview } from '@/hooks/usePdfPreview'

// ── Constants ─────────────────────────────────────────────────────────────────
const LEVEL_BADGE: Record<EwsLevel, 'hijau' | 'kuning' | 'oranye' | 'merah'> = {
  hijau: 'hijau', kuning: 'kuning', oranye: 'oranye', merah: 'merah',
}
const LEVEL_LABEL: Record<EwsLevel, string> = {
  hijau: 'Normal', kuning: 'Perhatian', oranye: 'Waspada', merah: 'Kritis',
}
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:              { label: 'Belum Ditangani',      cls: 'bg-red-100 text-red-700' },
  proses:               { label: 'Sedang Diproses',      cls: 'bg-yellow-100 text-yellow-700' },
  menunggu_verifikasi:  { label: 'Menunggu Verifikasi',  cls: 'bg-blue-100 text-blue-700' },
  selesai:              { label: 'Selesai',              cls: 'bg-green-100 text-green-700' },
  diabaikan:            { label: 'Diabaikan',            cls: 'bg-gray-100 text-gray-500' },
}

const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-3">
    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
)

type DimKey = 'kehadiran' | 'karakter' | 'catatan' | 'nilai'
const DIM_CONFIG: Record<DimKey, { title: string; icon: React.ElementType; pdfDim: string }> = {
  kehadiran: { title: 'Detail Kehadiran',       icon: Calendar,    pdfDim: 'kehadiran' },
  karakter:  { title: 'Riwayat Poin Karakter',  icon: Star,        pdfDim: 'karakter'  },
  catatan:   { title: 'Catatan KBM',            icon: BookOpen,    pdfDim: 'catatan'   },
  nilai:     { title: 'Rekap Nilai Aktivitas',  icon: TrendingUp,  pdfDim: 'nilai'     },
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EwsDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? ''
  const kap  = user?.kapabilitas
  const isAdmin = ['admin', 'wakasek'].includes(role)
  // 'wali_kelas' dan 'bk' BUKAN nilai role asli di sistem ini (role guru sungguhan
  // selalu 'guru', status wali-kelas/BK adalah KAPABILITAS terpisah dari
  // classes.wali_kelas_id / teachers.is_bk) — cek literal role di sini tidak akan
  // pernah cocok utk akun guru sungguhan. Lihat Isu GK6.
  const isWaliKelasCap = kap?.is_wali_kelas ?? false
  const isBkCap         = kap?.is_bk ?? false

  const [activeDim, setActiveDim] = useState<DimKey | null>(null)
  // GK30: pengaturan kertas per-akun — semua role login boleh atur miliknya sendiri.
  const pdfPreview = usePdfPreview({ printSettings: true })

  const { data, isLoading, error } = useQuery({
    queryKey: ['ews-detail', studentId],
    queryFn: () => ewsApi.getEwsDetail(studentId!),
    enabled: !!studentId,
    retry: false,
  })

  const d = data?.data.data

  // ── Preview + simpan laporan utama ─────────────────────────────────────────
  async function downloadHandlingReport() {
    await pdfPreview.openPreview(
      `/students/${studentId}/handling-report`,
      `Riwayat_Penanganan_${d?.student.nama ?? studentId}.pdf`
    )
  }

  // ── Preview + simpan PDF dimensi ───────────────────────────────────────────
  async function downloadDimPdf(dim: DimKey) {
    await pdfPreview.openPreview(
      `/ews/${studentId}/pdf?dim=${dim}`,
      `EWS_${dim}_${d?.student.nama ?? studentId}.pdf`
    )
  }

  if (isLoading) return (
    <div className="max-w-xl space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
    </div>
  )
  // Dulu `return null` di sini bikin halaman blank putih permanen kalau query gagal
  // (mis. 403 akses ditolak) — mirip bug GK2, tampilkan pesan yang jelas alih-alih blank.
  if (error || !d) return (
    <div className="rounded-xl border bg-card flex flex-col items-center justify-center gap-2 py-24 text-muted-foreground max-w-xl">
      <AlertTriangle className="h-8 w-8" />
      <p className="text-sm font-medium">
        {(error as any)?.response?.data?.message ?? 'Gagal memuat detail EWS siswa ini.'}
      </p>
    </div>
  )

  const dim = d.dimensions
  const rekomendasi: any[] = (d as any).rekomendasi ?? []

  return (
    <div className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Detail EWS</h1>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={downloadHandlingReport} disabled={pdfPreview.loading}>
            <FileDown className="mr-1 h-4 w-4" />Laporan
          </Button>
        </div>
      </div>

      {/* Student card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <img src={d.student.foto_url || '/images/default-avatar.jpg'} alt={d.student.nama}
            className="w-[20mm] h-auto shrink-0 rounded-md border" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{d.student.nama}</p>
            <p className="text-sm text-muted-foreground">{d.student.nis}{d.student.kelas && ` · ${d.student.kelas}`}</p>
          </div>
          <Badge variant={LEVEL_BADGE[d.level]}>{LEVEL_LABEL[d.level]}</Badge>
        </CardContent>
      </Card>

      {/* 4 Dimensi — klik untuk detail */}
      <div className="grid grid-cols-2 gap-3">
        <DimensionCard
          title="Kehadiran"
          score={`${dim.kehadiran.score.toFixed(1)}%`}
          warn={!!dim.kehadiran.warning}
          threshold="min. 80%"
          onClick={() => setActiveDim(activeDim === 'kehadiran' ? null : 'kehadiran')}
          active={activeDim === 'kehadiran'}
          detail={dim.kehadiran.total > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs text-green-600">H: {dim.kehadiran.hadir}</span>
              <span className="text-xs text-blue-600">S: {dim.kehadiran.sakit}</span>
              <span className="text-xs text-yellow-600">I: {dim.kehadiran.izin}</span>
              <span className="text-xs text-red-600">A: {dim.kehadiran.alpha}</span>
            </div>
          ) : <p className="text-xs text-muted-foreground mt-1">Belum ada data</p>}
        />
        <DimensionCard
          title="Poin Karakter"
          score={`${dim.karakter.score >= 0 ? '+' : ''}${dim.karakter.score}`}
          warn={!!dim.karakter.warning}
          threshold="min. 0 poin"
          onClick={() => setActiveDim(activeDim === 'karakter' ? null : 'karakter')}
          active={activeDim === 'karakter'}
          detail={<p className="text-xs text-muted-foreground mt-1">{dim.karakter.count} input penilaian</p>}
        />
        <DimensionCard
          title="Catatan KBM"
          score={`${dim.catatan.count}x`}
          warn={!!dim.catatan.warning}
          threshold="maks. 2 catatan"
          onClick={() => setActiveDim(activeDim === 'catatan' ? null : 'catatan')}
          active={activeDim === 'catatan'}
          detail={<p className="text-xs text-muted-foreground mt-1">{dim.catatan.count === 0 ? 'Tidak ada catatan' : `${dim.catatan.count} catatan`}</p>}
        />
        <DimensionCard
          title="Rata-rata Nilai"
          score={dim.nilai.score !== null ? `${dim.nilai.score.toFixed(1)}` : '—'}
          warn={!!dim.nilai.warning}
          threshold="min. 70"
          onClick={() => setActiveDim(activeDim === 'nilai' ? null : 'nilai')}
          active={activeDim === 'nilai'}
          detail={<p className="text-xs text-muted-foreground mt-1">{dim.nilai.count > 0 ? `${dim.nilai.count} sesi dinilai` : 'Belum ada nilai'}</p>}
        />
      </div>

      {/* ── Detail Panel ────────────────────────────────────────────────────── */}
      {activeDim && (
        <DimensionDetailPanel
          dim={activeDim}
          data={d}
          onClose={() => setActiveDim(null)}
          onDownload={downloadDimPdf}
        />
      )}

      {/* Rekomendasi Tindakan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Rekomendasi & Riwayat Penanganan
            {rekomendasi.filter(r => r.status === 'pending').length > 0 && (
              <Badge className="bg-red-100 text-red-700">
                {rekomendasi.filter(r => r.status === 'pending').length} belum ditangani
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* GK6: wali kelas bisa buka kasus penanganan kapan pun, tidak perlu menunggu
              ambang otomatis (siswa "hijau" pun boleh) */}
          {isWaliKelasCap && (
            <NewCaseForm
              studentId={studentId!}
              onCreated={() => qc.invalidateQueries({ queryKey: ['ews-detail', studentId] })}
            />
          )}

          {rekomendasi.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada rekomendasi tersimpan.</p>
            : rekomendasi.map((r: any) => (
              <RecommendationBlock
                key={r.id}
                rec={r}
                studentId={studentId!}
                isAdmin={isAdmin}
                isWaliKelasCap={isWaliKelasCap}
                isBkCap={isBkCap}
                onRefresh={() => qc.invalidateQueries({ queryKey: ['ews-detail', studentId] })}
              />
            ))
          }
        </CardContent>
      </Card>

      {/* Riwayat karakter terbaru (ringkasan) */}
      {d.recent_karakter.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Riwayat Karakter Terbaru</CardTitle>
              <button onClick={() => setActiveDim('karakter')} className="text-xs text-primary hover:underline">
                Lihat semua
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {d.recent_karakter.map((k: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className={cn('shrink-0 text-xs font-bold w-10 text-right', k.poin >= 0 ? 'text-green-600' : 'text-red-600')}>
                  {k.poin >= 0 ? '+' : ''}{k.poin}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{k.subitem}</p>
                  <p className="text-xs text-muted-foreground">{k.guru} · {k.tanggal}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pdfPreview.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{pdfPreview.error}</div>
      )}
      {pdfPreview.modal}
      {pdfPreview.loadingOverlay}
    </div>
  )
}

// ── DimensionCard (clickable) ─────────────────────────────────────────────────
function DimensionCard({
  title, score, warn, threshold, detail, onClick, active,
}: {
  title: string; score: string; warn: boolean; threshold: string
  detail: React.ReactNode; onClick: () => void; active: boolean
}) {
  return (
    <Card
      className={cn(
        'border cursor-pointer transition-colors select-none',
        active ? (warn ? 'border-red-400 bg-red-50/60 ring-2 ring-red-300' : 'border-primary ring-2 ring-primary/30 bg-primary/5')
               : (warn ? 'border-red-200 bg-red-50/40 hover:border-red-300' : 'border-border hover:border-muted-foreground'),
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
          {warn ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />}
        </div>
        <p className={cn('text-2xl font-bold', warn ? 'text-red-600' : 'text-foreground')}>{score}</p>
        <p className="text-xs text-muted-foreground">{threshold}</p>
        {detail}
        <p className={cn('text-xs mt-2 font-medium', active ? 'text-primary' : 'text-muted-foreground/60')}>
          {active ? '▲ Sembunyikan detail' : '▼ Lihat detail'}
        </p>
      </CardContent>
    </Card>
  )
}

// ── DimensionDetailPanel ──────────────────────────────────────────────────────
function DimensionDetailPanel({
  dim, data, onClose, onDownload,
}: { dim: DimKey; data: any; onClose: () => void; onDownload: (d: DimKey) => void }) {
  const cfg = DIM_CONFIG[dim]
  const Icon = cfg.icon

  const [downloading, setDownloading] = useState(false)
  async function handleDownload() {
    setDownloading(true)
    try { await onDownload(dim) } finally { setDownloading(false) }
  }

  return (
    <Card className="border-primary border-2 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between bg-primary/5 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{cfg.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
            <FileDown className="mr-1 h-3.5 w-3.5" />
            {downloading ? 'Mengunduh...' : 'PDF'}
          </Button>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
        {dim === 'kehadiran' && <KehadiranDetail data={data} />}
        {dim === 'karakter'  && <KarakterDetail  data={data} />}
        {dim === 'catatan'   && <CatatanDetail   data={data} />}
        {dim === 'nilai'     && <NilaiDetail     data={data} />}
      </CardContent>
    </Card>
  )
}

// ── Kehadiran Detail ──────────────────────────────────────────────────────────
function KehadiranDetail({ data }: { data: any }) {
  const absences: any[] = (data as any).detail_kehadiran ?? []
  const dim = data.dimensions.kehadiran

  if (absences.length === 0) return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-2" />
      Tidak ada catatan ketidakhadiran.
    </div>
  )

  const STATUS_CLS: Record<string, string> = {
    sakit: 'bg-blue-100 text-blue-700',
    izin:  'bg-yellow-100 text-yellow-700',
    alpha: 'bg-red-100 text-red-700',
  }

  return (
    <div>
      {/* Ringkasan */}
      <div className="flex gap-4 px-4 py-3 bg-muted/30 text-sm border-b flex-wrap">
        <span>Total: <strong>{dim.total}</strong> sesi</span>
        <span className="text-green-600">Hadir: <strong>{dim.hadir}</strong></span>
        <span className="text-blue-600">Sakit: <strong>{dim.sakit}</strong></span>
        <span className="text-yellow-600">Izin: <strong>{dim.izin}</strong></span>
        <span className="text-red-600">Alpha: <strong>{dim.alpha}</strong></span>
      </div>
      <div className="divide-y">
        {absences.map((a: any, i: number) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="shrink-0 w-24 text-xs text-muted-foreground">{a.tanggal}</div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_CLS[a.status] ?? 'bg-gray-100 text-gray-600')}>
              {a.status.toUpperCase()}
            </span>
            <div className="flex-1 text-sm truncate">{a.mapel}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Karakter Detail ───────────────────────────────────────────────────────────
function KarakterDetail({ data }: { data: any }) {
  const items: any[] = (data as any).detail_karakter ?? []
  const dim = data.dimensions.karakter

  if (items.length === 0) return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      Belum ada penilaian karakter.
    </div>
  )

  let running = 0

  return (
    <div>
      {/* Ringkasan */}
      <div className="flex gap-4 px-4 py-3 bg-muted/30 text-sm border-b">
        <span>Total input: <strong>{dim.count}</strong></span>
        <span className={dim.score < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
          Akumulasi: {dim.score >= 0 ? '+' : ''}{dim.score} poin
        </span>
      </div>
      <div className="divide-y">
        {items.map((k: any, i: number) => {
          running += k.poin
          return (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className={cn('shrink-0 text-sm font-bold w-10 text-right mt-0.5', k.poin >= 0 ? 'text-green-600' : 'text-red-600')}>
                {k.poin >= 0 ? '+' : ''}{k.poin}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs bg-muted rounded px-1.5 py-0.5">{k.kategori}</span>
                  <span className="text-sm">{k.subitem}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{k.guru} · {k.tanggal}</p>
              </div>
              <span className={cn('shrink-0 text-xs text-right mt-0.5', running < 0 ? 'text-red-500' : 'text-muted-foreground')}>
                ={running >= 0 ? '+' : ''}{running}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Catatan KBM Detail ────────────────────────────────────────────────────────
function CatatanDetail({ data }: { data: any }) {
  const items: any[] = (data as any).detail_catatan ?? []
  const dim = data.dimensions.catatan

  const KAT_CLS: Record<string, string> = {
    akademik:  'bg-blue-100 text-blue-700',
    karakter:  'bg-purple-100 text-purple-700',
    presensi:  'bg-orange-100 text-orange-700',
    kesehatan: 'bg-red-100 text-red-700',
    lainnya:   'bg-gray-100 text-gray-600',
  }

  if (items.length === 0) return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-2" />
      Tidak ada catatan KBM.
    </div>
  )

  return (
    <div>
      <div className="flex gap-4 px-4 py-3 bg-muted/30 text-sm border-b">
        <span className={cn('font-semibold', dim.warning ? 'text-red-600' : 'text-foreground')}>
          {dim.count} catatan {dim.warning && '⚠ melebihi batas'}
        </span>
      </div>
      <div className="divide-y">
        {items.map((c: any, i: number) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', KAT_CLS[c.kategori] ?? KAT_CLS.lainnya)}>
                {c.kategori}
              </span>
              <span className="text-xs text-muted-foreground">{c.tanggal} · {c.dicatat_oleh}</span>
            </div>
            <p className="text-sm leading-relaxed">{c.isi}</p>
            {c.tindak_lanjut && (
              <div className="mt-1.5 rounded-md bg-green-50 border-l-2 border-green-500 pl-2 py-1">
                <p className="text-xs font-semibold text-green-700">Tindak lanjut:</p>
                <p className="text-xs text-green-900">{c.tindak_lanjut}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Nilai Detail ──────────────────────────────────────────────────────────────
function NilaiDetail({ data }: { data: any }) {
  const items: any[] = (data as any).detail_nilai ?? []
  const dim = data.dimensions.nilai

  if (items.length === 0) return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      Belum ada data penilaian.
    </div>
  )

  return (
    <div>
      <div className="flex gap-4 px-4 py-3 bg-muted/30 text-sm border-b">
        <span>{dim.count} sesi dinilai</span>
        <span className={cn('font-semibold', dim.warning ? 'text-red-600' : 'text-green-600')}>
          Rata-rata: {dim.score !== null ? dim.score.toFixed(1) : '—'}
          {dim.warning && ' ⚠'}
        </span>
      </div>
      <div className="divide-y">
        {items.map((n: any, i: number) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="shrink-0 w-24 text-xs text-muted-foreground">{n.tanggal}</div>
            <div className="flex-1 text-sm">{n.mapel}</div>
            <span className={cn('shrink-0 font-bold text-sm', n.nilai < 70 ? 'text-red-600' : 'text-green-600')}>
              {n.nilai}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── NewCaseForm — GK6: wali kelas buka kasus penanganan manual kapan pun ───────
function NewCaseForm({ studentId, onCreated }: { studentId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [alasan, setAlasan] = useState('')

  const create = useMutation({
    mutationFn: () => api.post(`/students/${studentId}/case`, { alasan }),
    onSuccess: () => { setOpen(false); setAlasan(''); onCreated() },
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-md border border-primary bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 w-full justify-center">
        <Plus className="h-3.5 w-3.5" /> Buat Kasus Penanganan Baru
      </button>
    )
  }

  return (
    <div className="rounded-md border p-3 bg-muted/30">
      <p className="text-xs font-semibold mb-2">Kasus Penanganan Baru</p>
      <Field label="Alasan / Deskripsi Kasus *">
        <textarea className={inputCls} rows={3} value={alasan} onChange={e => setAlasan(e.target.value)}
          placeholder="Mis. sering terlambat, kurang aktif di kelas, dsb. Tidak harus menunggu status EWS memburuk." />
      </Field>
      <div className="flex gap-2">
        <button onClick={() => create.mutate()} disabled={!alasan.trim() || create.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          Buat Kasus
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
      </div>
    </div>
  )
}

// ── RecommendationBlock ────────────────────────────────────────────────────────
function RecommendationBlock({ rec, isAdmin, isWaliKelasCap, isBkCap, onRefresh }: {
  rec: any; studentId?: string; isAdmin: boolean
  isWaliKelasCap: boolean; isBkCap: boolean; onRefresh: () => void
}) {
  const [expanded, setExpanded]           = useState(true)
  const [showAdminForm, setAdminForm]     = useState(false)
  const [showHandlerForm, setHandlerForm] = useState(false)
  const [showSessionForm, setSessionForm] = useState(false)
  const [editSession, setEditSession]     = useState<any>(null)
  const [adminNote, setAdminNote]         = useState(rec.catatan_admin ?? '')
  const [handlerSearch, setHandlerSearch] = useState('')
  const [selectedHandlers, setSelectedHandlers] = useState<string[]>(rec.suggested_handlers?.map((h: any) => h.id) ?? [])
  const [sessionForm, setSessionFormData] = useState({ tanggal: '', catatan: '', links: [] as { url: string; keterangan: string }[] })
  const statusCfg = STATUS_CONFIG[rec.status] ?? STATUS_CONFIG.pending

  // Key HARUS beda dari HariEfektifPage.tsx yg juga pakai 'admin-teachers-list' tapi
  // per_page=all — key literal sama + parameter beda = react-query bisa pakai cache
  // "salah" punya halaman lain (data guru kepotong 100 vs seharusnya semua, atau
  // sebaliknya), tergantung halaman mana yang duluan di-visit dalam sesi yang sama.
  // Sama kelas bug dengan [[agenda_perlu_diisi_deadline_visibility]].
  const { data: teacherData } = useQuery({
    queryKey: ['admin-teachers-list-100'],
    queryFn: () => api.get('/admin/teachers?per_page=100').then(r => r.data.data as any[]),
    enabled: showHandlerForm,
  })
  const teachers = (teacherData ?? []).filter((t: any) =>
    !handlerSearch || t.nama.toLowerCase().includes(handlerSearch.toLowerCase())
  )

  const saveNote     = useMutation({ mutationFn: () => api.put(`/recommendations/${rec.id}/admin-note`, { catatan_admin: adminNote }), onSuccess: () => { setAdminForm(false); onRefresh() } })
  const saveHandlers = useMutation({ mutationFn: () => api.put(`/recommendations/${rec.id}/handlers`, { handler_ids: selectedHandlers }), onSuccess: () => { setHandlerForm(false); onRefresh() } })
  const verify       = useMutation({ mutationFn: () => api.put(`/recommendations/${rec.id}/verify`, {}), onSuccess: () => onRefresh() })
  const addSession   = useMutation({ mutationFn: (d: object) => api.post(`/recommendations/${rec.id}/sessions`, d), onSuccess: () => { setSessionForm(false); setSessionFormData({ tanggal: '', catatan: '', links: [] }); onRefresh() } })
  const updateSession = useMutation({ mutationFn: ({ id, d }: { id: string; d: object }) => api.put(`/recommendations/${rec.id}/sessions/${id}`, d), onSuccess: () => { setEditSession(null); onRefresh() } })
  const deleteSession = useMutation({ mutationFn: (id: string) => api.delete(`/recommendations/${rec.id}/sessions/${id}`), onSuccess: () => onRefresh() })
  const updateStatus  = useMutation({ mutationFn: (status: string) => api.put(`/recommendations/${rec.id}/status`, { status }), onSuccess: () => onRefresh() })

  // GK8-GK11: eskalasi ke BK
  const [resumeText, setResumeText] = useState('')
  const [showBkSelesaiForm, setShowBkSelesaiForm] = useState(false)
  const ajukanKonseling = useMutation({ mutationFn: () => api.put(`/recommendations/${rec.id}/ajukan-konseling`, {}), onSuccess: () => onRefresh() })
  const bkTerima        = useMutation({ mutationFn: () => api.put(`/recommendations/${rec.id}/bk-terima`, {}), onSuccess: () => onRefresh() })
  const bkSelesai       = useMutation({ mutationFn: () => api.put(`/recommendations/${rec.id}/bk-selesai`, { resume: resumeText }), onSuccess: () => { setResumeText(''); onRefresh() } })

  const isPending = rec.status === 'pending'
  const isProses  = rec.status === 'proses'
  const isDone    = ['selesai', 'diabaikan'].includes(rec.status)
  const isBkLocked = rec.input_wali_kelas_terkunci as boolean
  const BK_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    none:     { label: '', cls: '' },
    diajukan: { label: 'Diajukan ke BK', cls: 'bg-purple-100 text-purple-700' },
    diterima: { label: 'Proses Penanganan BK', cls: 'bg-indigo-100 text-indigo-700' },
    selesai:  { label: 'Penanganan BK Selesai', cls: 'bg-teal-100 text-teal-700' },
  }
  const bkBadge = BK_STATUS_LABEL[rec.bk_status] ?? BK_STATUS_LABEL.none

  return (
    <div className={cn('rounded-lg border', rec.status === 'pending' ? 'border-red-200' : rec.status === 'menunggu_verifikasi' ? 'border-blue-200' : rec.status === 'selesai' ? 'border-green-200' : 'border-border')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={cn('text-xs', statusCfg.cls)}>{statusCfg.label}</Badge>
            {/* GK7: status "Proses Penanganan Wali Kelas" tampil selama belum ditandai
                selesai/diabaikan DAN belum dieskalasi ke BK — hilang begitu wali kelas
                menandai selesai, tapi riwayatnya tetap ada. */}
            {isProses && rec.bk_status === 'none' && (
              <Badge className="text-xs bg-orange-100 text-orange-700">Proses Penanganan Wali Kelas</Badge>
            )}
            {bkBadge.label && <Badge className={cn('text-xs', bkBadge.cls)}>{bkBadge.label}</Badge>}
            <span className="text-xs text-muted-foreground">Akumulasi: {rec.akumulasi} poin</span>
            <span className="text-xs text-muted-foreground">{rec.dibuat_pada}</span>
          </div>
          <p className="text-sm font-semibold leading-snug">{rec.rekomendasi}</p>
          {rec.suggested_handlers?.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">Penangan: {rec.suggested_handlers.map((h: any) => h.nama).join(', ')}</p>
          )}
          {rec.verified_by && (
            <p className="text-xs text-green-700 mt-1">
              <CheckCircle2 className="inline h-3 w-3 mr-0.5" />Diverifikasi oleh {rec.verified_by} ({rec.verified_at})
            </p>
          )}
          {rec.status === 'selesai' && rec.ditangani_pada && !rec.verified_by && (
            <p className="text-xs text-green-700 mt-1">
              <CheckCircle2 className="inline h-3 w-3 mr-0.5" />Diselesaikan oleh wali kelas pada {rec.ditangani_pada}
            </p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </div>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-3 space-y-3">
          {/* Catatan admin */}
          {rec.catatan_admin && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Catatan dari Admin/Wakasek:</p>
              <p className="text-xs text-amber-900 leading-relaxed">{rec.catatan_admin}</p>
            </div>
          )}

          {/* Form catatan admin */}
          {isAdmin && showAdminForm && (
            <div className="rounded-md bg-muted/50 p-3">
              <Field label="Catatan ke Wali Kelas">
                <textarea className={inputCls} rows={3} value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Arahan atau konteks untuk wali kelas..." />
              </Field>
              <div className="flex gap-2">
                <button onClick={() => saveNote.mutate()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90" disabled={saveNote.isPending}>Simpan</button>
                <button onClick={() => setAdminForm(false)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
              </div>
            </div>
          )}

          {/* Form sarankan penangan */}
          {isAdmin && showHandlerForm && (
            <div className="rounded-md bg-muted/50 p-3">
              <Field label="Cari & pilih penangan (bisa lebih dari 1)">
                <input className={inputCls} placeholder="Ketik nama guru..." value={handlerSearch} onChange={e => setHandlerSearch(e.target.value)} />
              </Field>
              <div className="max-h-40 overflow-y-auto rounded-md border bg-background mb-2">
                {teachers.slice(0, 15).map((t: any) => (
                  <label key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <input type="checkbox" checked={selectedHandlers.includes(t.id)} onChange={e => setSelectedHandlers(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id))} />
                    <span className="text-sm">{t.nama}</span>
                    <span className="text-xs text-muted-foreground capitalize ml-auto">{t.role?.replace(/_/g,' ')}</span>
                  </label>
                ))}
              </div>
              {selectedHandlers.length > 0 && <p className="text-xs text-muted-foreground mb-2">Dipilih: {selectedHandlers.length} orang</p>}
              <div className="flex gap-2">
                <button onClick={() => saveHandlers.mutate()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90" disabled={saveHandlers.isPending}>Sarankan</button>
                <button onClick={() => setHandlerForm(false)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
              </div>
            </div>
          )}

          {/* Riwayat sesi penanganan */}
          {rec.handling_sessions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Riwayat Penanganan ({rec.handling_sessions.length} sesi)
              </p>
              <div className="space-y-2">
                {rec.handling_sessions.map((s: any) => (
                  <div key={s.id}>
                    {editSession?.id === s.id ? (
                      <div className="rounded-md border p-3 bg-muted/30">
                        <Field label="Tanggal"><input className={inputCls} type="date" value={editSession.tanggal} onChange={e => setEditSession((p: any) => ({ ...p, tanggal: e.target.value }))} /></Field>
                        <Field label="Catatan Penanganan"><textarea className={inputCls} rows={3} value={editSession.catatan} onChange={e => setEditSession((p: any) => ({ ...p, catatan: e.target.value }))} /></Field>
                        {/* Multi-link edit */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-muted-foreground">Lampiran Link (maks. 5)</label>
                            {(editSession.links ?? []).length < 5 && (
                              <button type="button" onClick={() => setEditSession((p: any) => ({ ...p, links: [...(p.links ?? []), { url: '', keterangan: '' }] }))} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                                <Plus className="h-3 w-3" /> Tambah
                              </button>
                            )}
                          </div>
                          {(editSession.links ?? []).map((l: any, li: number) => (
                            <div key={li} className="flex gap-1.5 mb-1.5 items-start">
                              <div className="flex-1 space-y-1">
                                <input className={inputCls} type="url" placeholder="https://..." value={l.url} onChange={e => setEditSession((p: any) => ({ ...p, links: p.links.map((x: any, i: number) => i === li ? { ...x, url: e.target.value } : x) }))} />
                                <input className={inputCls} placeholder="Keterangan link" value={l.keterangan} onChange={e => setEditSession((p: any) => ({ ...p, links: p.links.map((x: any, i: number) => i === li ? { ...x, keterangan: e.target.value } : x) }))} />
                              </div>
                              <button type="button" onClick={() => setEditSession((p: any) => ({ ...p, links: p.links.filter((_: any, i: number) => i !== li) }))} className="mt-1 rounded p-1 hover:bg-red-100 shrink-0"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                            </div>
                          ))}
                          {!(editSession.links ?? []).length && <p className="text-xs text-muted-foreground">Belum ada lampiran.</p>}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => updateSession.mutate({ id: s.id, d: editSession })} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white" disabled={updateSession.isPending}>Simpan</button>
                          <button onClick={() => setEditSession(null)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
                        </div>
                      </div>
                    ) : (
                      <div className={cn('rounded-md border-l-2 pl-3 py-2', s.is_resume ? 'border-teal-500 bg-teal-50' : s.jenis === 'bk' ? 'border-indigo-400 bg-indigo-50/50' : 'border-primary bg-muted/20')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">
                              {s.is_resume
                                ? <span className="font-semibold text-teal-700">Resume BK</span>
                                : s.jenis === 'bk' ? <span className="font-semibold text-indigo-700">[BK]</span> : null}
                              {' '}<strong>{s.tanggal}</strong> · {s.handled_by}
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-line">{s.catatan}</p>
                            {/* Links */}
                            {(s.links ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {(s.links ?? []).map((l: any, li: number) => (
                                  <a key={li} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                    <Link className="h-3 w-3" />{l.keterangan}
                                  </a>
                                ))}
                              </div>
                            )}
                            {/* Legacy links */}
                            {(s.link_foto || s.link_dokumen) && !(s.links ?? []).length && (
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {s.link_foto    && <a href={s.link_foto}    target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Link className="h-3 w-3" />Foto</a>}
                                {s.link_dokumen && <a href={s.link_dokumen} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Link className="h-3 w-3" />Dokumen</a>}
                              </div>
                            )}
                          </div>
                          {!s.is_resume && !isDone && ((s.jenis === 'wali_kelas' && isWaliKelasCap && !isBkLocked) || (s.jenis === 'bk' && rec.is_my_bk_case) || isAdmin) && (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setEditSession({ ...s, links: s.links ?? [] })} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                              <button onClick={() => window.confirm('Hapus sesi ini?') && deleteSession.mutate(s.id)} className="rounded p-1 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GK9: input wali kelas dikunci begitu BK menerima kasus */}
          {isBkLocked && isWaliKelasCap && !rec.is_my_bk_case && (
            <div className="rounded-md border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-3 text-center">
              <p className="text-xs text-indigo-700">Proses penanganan bersama BK....</p>
            </div>
          )}

          {/* Form tambah sesi — wali kelas (belum dikunci) ATAU BK yang sedang menangani */}
          {((isWaliKelasCap && !isBkLocked) || (isBkCap && rec.is_my_bk_case && rec.bk_status === 'diterima')) && !isDone && showSessionForm && (
            <div className="rounded-md border p-3 bg-muted/30">
              <p className="text-xs font-semibold mb-2">Tambah Catatan Penanganan</p>
              <Field label="Tanggal Penanganan"><input className={inputCls} type="date" value={sessionForm.tanggal} onChange={e => setSessionFormData(f => ({ ...f, tanggal: e.target.value }))} /></Field>
              <Field label="Catatan Penanganan *"><textarea className={inputCls} rows={4} value={sessionForm.catatan} onChange={e => setSessionFormData(f => ({ ...f, catatan: e.target.value }))} placeholder="Deskripsikan penanganan yang dilakukan..." /></Field>
              {/* Multi-link */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Lampiran Link (maks. 5)</label>
                  {sessionForm.links.length < 5 && (
                    <button type="button" onClick={() => setSessionFormData(f => ({ ...f, links: [...f.links, { url: '', keterangan: '' }] }))} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                      <Plus className="h-3 w-3" /> Tambah Link
                    </button>
                  )}
                </div>
                {sessionForm.links.map((l, li) => (
                  <div key={li} className="flex gap-1.5 mb-1.5 items-start">
                    <div className="flex-1 space-y-1">
                      <input className={inputCls} type="url" placeholder="https://..." value={l.url} onChange={e => setSessionFormData(f => ({ ...f, links: f.links.map((x, i) => i === li ? { ...x, url: e.target.value } : x) }))} />
                      <input className={inputCls} placeholder="Keterangan (contoh: Surat panggilan orang tua)" value={l.keterangan} onChange={e => setSessionFormData(f => ({ ...f, links: f.links.map((x, i) => i === li ? { ...x, keterangan: e.target.value } : x) }))} />
                    </div>
                    <button type="button" onClick={() => setSessionFormData(f => ({ ...f, links: f.links.filter((_, i) => i !== li) }))} className="mt-1 rounded p-1 hover:bg-red-100 shrink-0"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                  </div>
                ))}
                {sessionForm.links.length === 0 && <p className="text-xs text-muted-foreground">Belum ada lampiran.</p>}
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => addSession.mutate(sessionForm)} disabled={!sessionForm.tanggal || !sessionForm.catatan || addSession.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">Simpan Catatan</button>
                <button onClick={() => setSessionForm(false)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {isAdmin && !isDone && (
              <>
                <button onClick={() => { setAdminForm(v => !v); setHandlerForm(false) }} className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                  <MessageSquare className="h-3.5 w-3.5" />{rec.catatan_admin ? 'Edit Catatan Admin' : 'Tambah Catatan ke Wali Kelas'}
                </button>
                <button onClick={() => { setHandlerForm(v => !v); setAdminForm(false) }} className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                  <UserPlus className="h-3.5 w-3.5" />Sarankan Penangan
                </button>
              </>
            )}
            {((isWaliKelasCap && !isBkLocked) || (isBkCap && rec.is_my_bk_case && rec.bk_status === 'diterima')) && !isDone && (
              <button onClick={() => setSessionForm(v => !v)} className="flex items-center gap-1 rounded-md border border-primary bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">
                <Plus className="h-3.5 w-3.5" />Tambah Catatan Penanganan
              </button>
            )}
            {isWaliKelasCap && (isProses || isPending) && rec.handling_sessions?.length > 0 && (
              <button onClick={() => updateStatus.mutate('menunggu_verifikasi')} disabled={updateStatus.isPending} className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                <Clock className="h-3.5 w-3.5" />Tandai Menunggu Verifikasi
              </button>
            )}
            {isWaliKelasCap && !isDone && (isProses || rec.status === 'menunggu_verifikasi') && (
              <button onClick={() => updateStatus.mutate('selesai')} disabled={updateStatus.isPending} className="flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                <CheckCircle2 className="h-3.5 w-3.5" />Tandai Selesai
              </button>
            )}
            {isAdmin && rec.status === 'menunggu_verifikasi' && (
              <button onClick={() => verify.mutate()} disabled={verify.isPending} className="flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                <ShieldCheck className="h-3.5 w-3.5" />Verifikasi Selesai
              </button>
            )}
            {!isDone && (isWaliKelasCap || isAdmin) && (
              <button onClick={() => window.confirm('Abaikan rekomendasi ini?') && updateStatus.mutate('diabaikan')} className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Abaikan</button>
            )}
            {/* GK8: ajukan konseling ke BK setelah minimal 3 catatan wali kelas */}
            {isWaliKelasCap && rec.bisa_ajukan_konseling && (
              <button onClick={() => window.confirm('Ajukan konseling ke Guru BK untuk kasus ini?') && ajukanKonseling.mutate()} disabled={ajukanKonseling.isPending}
                className="flex items-center gap-1 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100">
                <UserPlus className="h-3.5 w-3.5" />Ajukan Konseling
              </button>
            )}
            {isWaliKelasCap && rec.bk_status === 'diajukan' && (
              <span className="text-xs text-muted-foreground italic self-center">Menunggu Guru BK menerima pengajuan konseling ({rec.diajukan_konseling_pada})...</span>
            )}
            {/* GK9: BK terima pengajuan konseling */}
            {isBkCap && rec.bisa_terima_konseling && (
              <button onClick={() => bkTerima.mutate()} disabled={bkTerima.isPending}
                className="flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                <UserPlus className="h-3.5 w-3.5" />Terima Konseling
              </button>
            )}
            {/* GK11: BK tandai selesai (wajib isi resume) */}
            {rec.is_my_bk_case && rec.bk_status === 'diterima' && (
              <button onClick={() => setShowBkSelesaiForm(v => !v)} className="flex items-center gap-1 rounded-md border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
                <CheckCircle2 className="h-3.5 w-3.5" />Tandai Selesai (BK)
              </button>
            )}
          </div>

          {/* Form resume BK (GK11) */}
          {rec.is_my_bk_case && rec.bk_status === 'diterima' && showBkSelesaiForm && (
            <div className="rounded-md border border-teal-300 bg-teal-50/50 p-3">
              <p className="text-xs font-semibold mb-2 text-teal-800">Resume Penanganan BK (wajib diisi sebelum menandai selesai)</p>
              <Field label="Resume *">
                <textarea className={inputCls} rows={4} value={resumeText} onChange={e => setResumeText(e.target.value)}
                  placeholder="Ringkasan hasil penanganan — akan muncul di riwayat wali kelas sebagai 'Resume BK'." />
              </Field>
              <div className="flex gap-2">
                <button onClick={() => bkSelesai.mutate()} disabled={!resumeText.trim() || bkSelesai.isPending} className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                  Kirim Resume &amp; Tandai Selesai
                </button>
                <button onClick={() => setShowBkSelesaiForm(false)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
