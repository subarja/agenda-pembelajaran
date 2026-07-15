import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, Loader2, Save, Users, ExternalLink, Trash2, Plus,
  CheckCircle2, Circle, BookOpenCheck,
} from 'lucide-react'
import { kokurikulerApi, type KkSaya } from '@/features/kokurikuler/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn, toLocalDateStr } from '@/lib/utils'

/**
 * Halaman Kokurikuler untuk siswa: refleksi harian + refleksi akhir projek,
 * info tim, dan tautan dokumen hasil tim (tambah/hapus milik sendiri).
 */
export default function KokurikulerSiswaPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['kokurikuler-saya'],
    queryFn: () => kokurikulerApi.saya(),
  })
  const saya    = data?.data.data ?? null
  const project = saya?.project ?? null

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-600" />
        <div>
          <h1 className="text-xl font-bold">Kokurikuler</h1>
          <p className="text-xs text-muted-foreground">Refleksi harian dan dokumen hasil projek tim.</p>
        </div>
      </div>

      {!project ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Belum ada projek kokurikuler yang berjalan untuk kelasmu.
        </CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="p-4">
            <p className="font-semibold text-sm">{project.judul}</p>
            {project.tema && <p className="text-xs text-muted-foreground mt-0.5">Tema: {project.tema}</p>}
            {project.deskripsi && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{project.deskripsi}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              {project.tanggal_mulai} s.d. {project.tanggal_selesai}
              {project.status === 'selesai' && <Badge variant="secondary" className="ml-2">Selesai</Badge>}
            </p>
          </CardContent></Card>

          <RefleksiHarianCard saya={saya!} />
          <RefleksiAkhirCard saya={saya!} />
          <TimCard saya={saya!} />
        </>
      )}
    </div>
  )
}

type Saya = KkSaya

// ── Refleksi harian ───────────────────────────────────────────────────────────
function RefleksiHarianCard({ saya }: { saya: Saya }) {
  const qc      = useQueryClient()
  const project = saya.project!
  const harian  = useMemo(() => saya.refleksi_harian ?? {}, [saya])
  const today   = toLocalDateStr(new Date())
  const options = project.hari.filter((h) => h.tanggal <= today)

  const [tanggal, setTanggal] = useState(options.length > 0 ? options[options.length - 1].tanggal : project.hari[0]?.tanggal ?? today)
  const [isi, setIsi]         = useState('')

  useEffect(() => setIsi(harian[tanggal] ?? ''), [harian, tanggal])

  const save = useMutation({
    mutationFn: () => kokurikulerApi.simpanRefleksi({ project_id: project.id, jenis: 'harian', tanggal, isi }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-saya'] }),
  })

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-primary-600" />
        <h3 className="font-semibold text-sm">Refleksi Harian</h3>
        <Badge variant="secondary" className="ml-auto">{Object.keys(harian).length}/{project.hari.length} hari</Badge>
      </div>

      {/* Indikator hari terisi */}
      <div className="flex flex-wrap gap-1.5">
        {project.hari.map((h) => (
          <button key={h.tanggal} onClick={() => h.tanggal <= today && setTanggal(h.tanggal)}
            disabled={h.tanggal > today}
            className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
              h.tanggal === tanggal ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-border',
              h.tanggal > today && 'opacity-40 cursor-not-allowed')}>
            {harian[h.tanggal]
              ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              : <Circle className="h-3 w-3 text-muted-foreground" />}
            {h.label.split(',')[0]}
          </button>
        ))}
      </div>

      <textarea
        className="w-full rounded-md border border-input bg-background p-3 text-sm min-h-28"
        placeholder="Apa yang kamu pelajari dan rasakan hari ini? (maks. 2000 karakter)"
        maxLength={2000}
        value={isi}
        onChange={(e) => setIsi(e.target.value)}
      />
      <Button className="w-full" disabled={!isi.trim() || save.isPending || project.status !== 'aktif'} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Simpan Refleksi
      </Button>
      {save.isSuccess && <p className="text-sm text-emerald-600 text-center">Refleksi tersimpan.</p>}
      {save.isError && <p className="text-sm text-red-600 text-center">{(save.error as any)?.response?.data?.message ?? 'Gagal menyimpan.'}</p>}
    </CardContent></Card>
  )
}

// ── Refleksi akhir ────────────────────────────────────────────────────────────
function RefleksiAkhirCard({ saya }: { saya: Saya }) {
  const qc      = useQueryClient()
  const project = saya.project!
  const [isi, setIsi] = useState(saya.refleksi_akhir ?? '')

  useEffect(() => setIsi(saya.refleksi_akhir ?? ''), [saya.refleksi_akhir])

  const save = useMutation({
    mutationFn: () => kokurikulerApi.simpanRefleksi({ project_id: project.id, jenis: 'akhir', isi }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-saya'] }),
  })

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-primary-600" />
        <h3 className="font-semibold text-sm">Refleksi Akhir Projek</h3>
        {saya.refleksi_akhir && <Badge variant="secondary" className="ml-auto text-emerald-700">Sudah diisi</Badge>}
      </div>
      <textarea
        className="w-full rounded-md border border-input bg-background p-3 text-sm min-h-28"
        placeholder="Ceritakan pengalaman, pelajaran terbesar, dan hal yang ingin kamu perbaiki setelah projek ini…"
        maxLength={2000}
        value={isi}
        onChange={(e) => setIsi(e.target.value)}
      />
      <Button className="w-full" disabled={!isi.trim() || save.isPending || project.status !== 'aktif'} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Simpan Refleksi Akhir
      </Button>
      {save.isSuccess && <p className="text-sm text-emerald-600 text-center">Refleksi akhir tersimpan.</p>}
      {save.isError && <p className="text-sm text-red-600 text-center">{(save.error as any)?.response?.data?.message ?? 'Gagal menyimpan.'}</p>}
    </CardContent></Card>
  )
}

// ── Tim & dokumen ─────────────────────────────────────────────────────────────
function TimCard({ saya }: { saya: Saya }) {
  const qc      = useQueryClient()
  const project = saya.project!
  const tim     = saya.tim

  const [judul, setJudul] = useState('')
  const [url, setUrl]     = useState('')

  const tambah = useMutation({
    mutationFn: () => kokurikulerApi.tambahDokumen({ project_id: project.id, judul, url }),
    onSuccess: () => {
      setJudul(''); setUrl('')
      qc.invalidateQueries({ queryKey: ['kokurikuler-saya'] })
    },
  })
  const hapus = useMutation({
    mutationFn: (id: string) => kokurikulerApi.hapusDokumen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kokurikuler-saya'] }),
  })

  return (
    <Card><CardContent className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary-600" />
        <h3 className="font-semibold text-sm">Tim Saya</h3>
      </div>

      {!tim ? (
        <p className="text-sm text-muted-foreground">Kamu belum tergabung dalam tim — hubungi wali kelasmu.</p>
      ) : (
        <>
          <p className="text-sm font-medium">Tim {tim.nomor}{tim.nama ? ` — ${tim.nama}` : ''}</p>
          <div className="flex flex-wrap gap-1.5">
            {tim.anggota.map((a) => (
              <span key={a.id} className="rounded-full bg-accent px-2 py-0.5 text-xs">{a.nama}</span>
            ))}
          </div>

          <h4 className="text-sm font-semibold pt-1">Dokumen Hasil Projek</h4>
          {tim.dokumen.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada tautan dokumen. Tambahkan link Google Drive/Docs hasil kerja timmu.</p>
          ) : (
            <div className="divide-y border rounded-lg">
              {tim.dokumen.map((d) => (
                <div key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <a href={d.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary-700 hover:underline min-w-0">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{d.judul}</span>
                  </a>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">{d.oleh ?? ''}</span>
                  {d.milik_saya && project.status === 'aktif' && (
                    <button onClick={() => hapus.mutate(d.id)} aria-label="Hapus dokumen"
                      className="p-1.5 -m-1 shrink-0 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {project.status === 'aktif' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Judul dokumen (mis. Laporan Akhir Tim 3)" value={judul} onChange={(e) => setJudul(e.target.value)} className="flex-1" />
              <Input placeholder="https://…" type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
              <Button size="sm" className="sm:self-stretch" disabled={!judul.trim() || !url.trim() || tambah.isPending} onClick={() => tambah.mutate()}>
                {tambah.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah
              </Button>
            </div>
          )}
          {tambah.isError && <p className="text-sm text-red-600">{(tambah.error as any)?.response?.data?.message ?? 'Gagal menambah dokumen (pastikan URL valid).'}</p>}
        </>
      )}
    </CardContent></Card>
  )
}
