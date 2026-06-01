import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, AlertTriangle, CheckCircle2, ClipboardList,
  Plus, Pencil, Trash2, Link, FileDown, UserPlus, MessageSquare,
  ShieldCheck, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'
import { ewsApi } from '@/features/ews/api'
import type { EwsLevel } from '@/features/ews/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="mb-3">
    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
)

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EwsDetailPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? ''
  const isAdmin = ['admin', 'wakasek'].includes(role)
  const isWali  = ['wali_kelas', 'admin', 'wakasek', 'bk'].includes(role)

  const { data, isLoading } = useQuery({
    queryKey: ['ews-detail', studentId],
    queryFn: () => ewsApi.getEwsDetail(studentId!),
    enabled: !!studentId,
  })

  const d = data?.data.data

  if (isLoading) return (
    <div className="max-w-xl space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}
    </div>
  )
  if (!d) return null

  const dim = d.dimensions
  const rekomendasi: any[] = (d as any).rekomendasi ?? []

  return (
    <div className="max-w-xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold">Detail EWS</h1>
        <div className="ml-auto flex gap-2">
          {/* Download laporan */}
          <Button variant="outline" size="sm" onClick={() => {
            window.open(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/v1/students/${studentId}/handling-report`, '_blank')
          }}>
            <FileDown className="mr-1 h-4 w-4" />Laporan
          </Button>
        </div>
      </div>

      {/* Student card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
            {d.student.nama.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{d.student.nama}</p>
            <p className="text-sm text-muted-foreground">{d.student.nis}{d.student.kelas && ` · ${d.student.kelas}`}</p>
          </div>
          <Badge variant={LEVEL_BADGE[d.level]}>{LEVEL_LABEL[d.level]}</Badge>
        </CardContent>
      </Card>

      {/* 4 Dimensi */}
      <div className="grid grid-cols-2 gap-3">
        <DimensionCard title="Kehadiran" score={`${dim.kehadiran.score.toFixed(1)}%`} warn={!!dim.kehadiran.warning} threshold="min. 80%"
          detail={dim.kehadiran.total > 0 ? (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs text-green-600">H: {dim.kehadiran.hadir}</span>
              <span className="text-xs text-blue-600">S: {dim.kehadiran.sakit}</span>
              <span className="text-xs text-yellow-600">I: {dim.kehadiran.izin}</span>
              <span className="text-xs text-red-600">A: {dim.kehadiran.alpha}</span>
            </div>
          ) : <p className="text-xs text-muted-foreground mt-1">Belum ada data</p>} />
        <DimensionCard title="Poin Karakter" score={`${dim.karakter.score >= 0 ? '+' : ''}${dim.karakter.score}`} warn={!!dim.karakter.warning} threshold="min. 0 poin"
          detail={<p className="text-xs text-muted-foreground mt-1">{dim.karakter.count} input penilaian</p>} />
        <DimensionCard title="Catatan KBM" score={`${dim.catatan.count}x`} warn={!!dim.catatan.warning} threshold="maks. 2 catatan"
          detail={<p className="text-xs text-muted-foreground mt-1">{dim.catatan.count === 0 ? 'Tidak ada catatan' : `${dim.catatan.count} catatan`}</p>} />
        <DimensionCard title="Rata-rata Nilai" score={dim.nilai.score !== null ? `${dim.nilai.score.toFixed(1)}` : '—'} warn={!!dim.nilai.warning} threshold="min. 70"
          detail={<p className="text-xs text-muted-foreground mt-1">{dim.nilai.count > 0 ? `${dim.nilai.count} sesi dinilai` : 'Belum ada nilai'}</p>} />
      </div>

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
          {rekomendasi.length === 0
            ? <p className="text-sm text-muted-foreground text-center py-4">Tidak ada rekomendasi. Siswa dalam kondisi aman.</p>
            : rekomendasi.map((r: any) => (
              <RecommendationBlock
                key={r.id}
                rec={r}
                studentId={studentId!}
                isAdmin={isAdmin}
                isWali={isWali}
                onRefresh={() => qc.invalidateQueries({ queryKey: ['ews-detail', studentId] })}
              />
            ))
          }
        </CardContent>
      </Card>

      {/* Riwayat karakter terbaru */}
      {d.recent_karakter.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Riwayat Karakter Terbaru</CardTitle></CardHeader>
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
    </div>
  )
}

// ── RecommendationBlock ────────────────────────────────────────────────────────
function RecommendationBlock({ rec, isAdmin, isWali, onRefresh }: {
  rec: any; studentId?: string; isAdmin: boolean; isWali: boolean; onRefresh: () => void
}) {
  const [expanded, setExpanded]         = useState(true)
  const [showAdminForm, setAdminForm]   = useState(false)
  const [showHandlerForm, setHandlerForm] = useState(false)
  const [showSessionForm, setSessionForm] = useState(false)
  const [editSession, setEditSession]   = useState<any>(null)
  const [adminNote, setAdminNote]       = useState(rec.catatan_admin ?? '')
  const [handlerSearch, setHandlerSearch] = useState('')
  const [selectedHandlers, setSelectedHandlers] = useState<string[]>(rec.suggested_handlers?.map((h: any) => h.id) ?? [])
  const [sessionForm, setSessionFormData] = useState({ tanggal: '', catatan: '', link_dokumen: '', link_foto: '' })
  const statusCfg = STATUS_CONFIG[rec.status] ?? STATUS_CONFIG.pending

  // Fetch guru list for handler selection
  const { data: teacherData } = useQuery({
    queryKey: ['admin-teachers-list'],
    queryFn: () => api.get('/admin/teachers?per_page=100').then(r => r.data.data as any[]),
    enabled: showHandlerForm,
  })
  const teachers = (teacherData ?? []).filter((t: any) =>
    !handlerSearch || t.nama.toLowerCase().includes(handlerSearch.toLowerCase())
  )

  const saveNote = useMutation({
    mutationFn: () => api.put(`/recommendations/${rec.id}/admin-note`, { catatan_admin: adminNote }),
    onSuccess: () => { setAdminForm(false); onRefresh() },
  })
  const saveHandlers = useMutation({
    mutationFn: () => api.put(`/recommendations/${rec.id}/handlers`, { handler_ids: selectedHandlers }),
    onSuccess: () => { setHandlerForm(false); onRefresh() },
  })
  const verify = useMutation({
    mutationFn: () => api.put(`/recommendations/${rec.id}/verify`, {}),
    onSuccess: () => onRefresh(),
  })
  const addSession = useMutation({
    mutationFn: (d: object) => api.post(`/recommendations/${rec.id}/sessions`, d),
    onSuccess: () => { setSessionForm(false); setSessionFormData({ tanggal: '', catatan: '', link_dokumen: '', link_foto: '' }); onRefresh() },
  })
  const updateSession = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.put(`/recommendations/${rec.id}/sessions/${id}`, d),
    onSuccess: () => { setEditSession(null); onRefresh() },
  })
  const deleteSession = useMutation({
    mutationFn: (id: string) => api.delete(`/recommendations/${rec.id}/sessions/${id}`),
    onSuccess: () => onRefresh(),
  })
  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/recommendations/${rec.id}/status`, { status }),
    onSuccess: () => onRefresh(),
  })

  const isPending  = rec.status === 'pending'
  const isProses   = rec.status === 'proses'
  const isDone     = ['selesai', 'diabaikan'].includes(rec.status)

  return (
    <div className={cn('rounded-lg border', rec.status === 'pending' ? 'border-red-200' : rec.status === 'menunggu_verifikasi' ? 'border-blue-200' : rec.status === 'selesai' ? 'border-green-200' : 'border-border')}>
      {/* Header rekomendasi */}
      <div className="flex items-start justify-between gap-2 p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={cn('text-xs', statusCfg.cls)}>{statusCfg.label}</Badge>
            <span className="text-xs text-muted-foreground">Akumulasi: {rec.akumulasi} poin</span>
            <span className="text-xs text-muted-foreground">{rec.dibuat_pada}</span>
          </div>
          <p className="text-sm font-semibold leading-snug">{rec.rekomendasi}</p>
          {rec.suggested_handlers?.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Penangan: {rec.suggested_handlers.map((h: any) => h.nama).join(', ')}
            </p>
          )}
          {rec.verified_by && (
            <p className="text-xs text-green-700 mt-1">
              <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
              Diverifikasi oleh {rec.verified_by} ({rec.verified_at})
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
              <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> Catatan dari Admin/Wakasek:
              </p>
              <p className="text-xs text-amber-900 leading-relaxed">{rec.catatan_admin}</p>
            </div>
          )}

          {/* Form catatan admin */}
          {isAdmin && showAdminForm && (
            <div className="rounded-md bg-muted/50 p-3">
              <Field label="Catatan ke Wali Kelas">
                <textarea className={inputCls} rows={3} value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Arahan, konteks tambahan, atau informasi penting untuk wali kelas..." />
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
                    <input type="checkbox" checked={selectedHandlers.includes(t.id)} onChange={e => {
                      setSelectedHandlers(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id))
                    }} />
                    <span className="text-sm">{t.nama}</span>
                    <span className="text-xs text-muted-foreground capitalize ml-auto">{t.role?.replace(/_/g,' ')}</span>
                  </label>
                ))}
              </div>
              {selectedHandlers.length > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  Dipilih: {selectedHandlers.length} orang
                </p>
              )}
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
                        <Field label="Link Foto (opsional)"><input className={inputCls} type="url" placeholder="https://..." value={editSession.link_foto ?? ''} onChange={e => setEditSession((p: any) => ({ ...p, link_foto: e.target.value }))} /></Field>
                        <Field label="Link Dokumen (opsional)"><input className={inputCls} type="url" placeholder="https://..." value={editSession.link_dokumen ?? ''} onChange={e => setEditSession((p: any) => ({ ...p, link_dokumen: e.target.value }))} /></Field>
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => updateSession.mutate({ id: s.id, d: editSession })} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white" disabled={updateSession.isPending}>Simpan</button>
                          <button onClick={() => setEditSession(null)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border-l-2 border-primary pl-3 py-2 bg-muted/20">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-1">
                              <strong>{s.tanggal}</strong> · {s.handled_by}
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-line">{s.catatan}</p>
                            {(s.link_foto || s.link_dokumen) && (
                              <div className="flex flex-wrap gap-2 mt-1.5">
                                {s.link_foto && <a href={s.link_foto} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Link className="h-3 w-3" />Foto</a>}
                                {s.link_dokumen && <a href={s.link_dokumen} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline"><Link className="h-3 w-3" />Dokumen</a>}
                              </div>
                            )}
                          </div>
                          {isWali && !isDone && (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => setEditSession({ ...s })} className="rounded p-1 hover:bg-accent"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
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

          {/* Form tambah sesi */}
          {isWali && !isDone && showSessionForm && (
            <div className="rounded-md border p-3 bg-muted/30">
              <p className="text-xs font-semibold mb-2">Tambah Catatan Penanganan</p>
              <Field label="Tanggal Penanganan"><input className={inputCls} type="date" value={sessionForm.tanggal} onChange={e => setSessionFormData(f => ({ ...f, tanggal: e.target.value }))} /></Field>
              <Field label="Catatan Penanganan *"><textarea className={inputCls} rows={4} value={sessionForm.catatan} onChange={e => setSessionFormData(f => ({ ...f, catatan: e.target.value }))} placeholder="Deskripsikan penanganan yang dilakukan..." /></Field>
              <Field label="Link Foto (Google Drive/dll)"><input className={inputCls} type="url" placeholder="https://drive.google.com/..." value={sessionForm.link_foto} onChange={e => setSessionFormData(f => ({ ...f, link_foto: e.target.value }))} /></Field>
              <Field label="Link Dokumen (surat, bukti, dll)"><input className={inputCls} type="url" placeholder="https://..." value={sessionForm.link_dokumen} onChange={e => setSessionFormData(f => ({ ...f, link_dokumen: e.target.value }))} /></Field>
              <div className="flex gap-2 mt-1">
                <button onClick={() => addSession.mutate(sessionForm)} disabled={!sessionForm.tanggal || !sessionForm.catatan || addSession.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  Simpan Catatan
                </button>
                <button onClick={() => setSessionForm(false)} className="rounded-md border px-3 py-1.5 text-xs">Batal</button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Admin: tambah catatan + sarankan penangan */}
            {isAdmin && !isDone && (
              <>
                <button onClick={() => { setAdminForm(v => !v); setHandlerForm(false) }}
                  className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {rec.catatan_admin ? 'Edit Catatan Admin' : 'Tambah Catatan ke Wali Kelas'}
                </button>
                <button onClick={() => { setHandlerForm(v => !v); setAdminForm(false) }}
                  className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                  <UserPlus className="h-3.5 w-3.5" />
                  Sarankan Penangan
                </button>
              </>
            )}

            {/* Wali kelas: tambah sesi */}
            {isWali && !isDone && (
              <button onClick={() => { setSessionForm(v => !v) }}
                className="flex items-center gap-1 rounded-md border border-primary bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">
                <Plus className="h-3.5 w-3.5" />
                Tambah Catatan Penanganan
              </button>
            )}

            {/* Wali kelas: tandai menunggu verifikasi */}
            {isWali && (isProses || isPending) && rec.handling_sessions?.length > 0 && (
              <button onClick={() => updateStatus.mutate('menunggu_verifikasi')} disabled={updateStatus.isPending}
                className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                <Clock className="h-3.5 w-3.5" />
                Tandai Menunggu Verifikasi
              </button>
            )}

            {/* Admin/wakasek: verifikasi */}
            {isAdmin && rec.status === 'menunggu_verifikasi' && (
              <button onClick={() => verify.mutate()} disabled={verify.isPending}
                className="flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verifikasi Selesai
              </button>
            )}

            {/* Abaikan */}
            {!isDone && isWali && (
              <button onClick={() => window.confirm('Abaikan rekomendasi ini?') && updateStatus.mutate('diabaikan')}
                className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                Abaikan
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DimensionCard ──────────────────────────────────────────────────────────────
function DimensionCard({ title, score, warn, threshold, detail }: {
  title: string; score: string; warn: boolean; threshold: string; detail: React.ReactNode
}) {
  return (
    <Card className={cn('border', warn ? 'border-red-200 bg-red-50/40' : 'border-border')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-medium text-muted-foreground leading-tight">{title}</p>
          {warn ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />}
        </div>
        <p className={cn('text-2xl font-bold', warn ? 'text-red-600' : 'text-foreground')}>{score}</p>
        <p className="text-xs text-muted-foreground">{threshold}</p>
        {detail}
      </CardContent>
    </Card>
  )
}
