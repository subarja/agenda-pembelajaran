import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Check, ExternalLink, Inbox, Loader2, Send, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toLocalDateStr } from '@/lib/utils'
import { invalApi, sesiKey, type CalonPengganti, type Inval, type SesiPilihan } from '@/features/inval/api'

const TABS = ['Ajukan', 'Kotak Masuk', 'Riwayat Saya'] as const

export default function InvalPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Ajukan')

  const { data: masuk } = useQuery({ queryKey: ['inval-masuk'], queryFn: invalApi.masuk })
  const menunggu = (masuk ?? []).filter((i) => i.status === 'diajukan').length

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">Guru Inval</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajukan guru pengganti saat berhalangan mengajar. Setelah pengganti menyetujui,
          kewajiban mengisi agenda sesi tersebut berpindah kepadanya.
        </p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-primary-600 text-primary-600' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
            {t === 'Kotak Masuk' && menunggu > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                {menunggu}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'Ajukan' && <TabAjukan onTerkirim={() => setTab('Riwayat Saya')} />}
      {tab === 'Kotak Masuk' && <TabKotakMasuk />}
      {tab === 'Riwayat Saya' && <TabRiwayat />}
    </div>
  )
}

// ── Tab 1: Ajukan ───────────────────────────────────────────────────────────

function TabAjukan({ onTerkirim }: { onTerkirim: () => void }) {
  const qc = useQueryClient()
  const hariIni = toLocalDateStr(new Date())
  const seminggu = toLocalDateStr(new Date(Date.now() + 7 * 86400_000))

  const [mulai, setMulai] = useState(hariIni)
  const [akhir, setAkhir] = useState(seminggu)
  const [dipilih, setDipilih] = useState<Set<string>>(new Set())
  const [pengganti, setPengganti] = useState('')
  const [alasan, setAlasan] = useState('')
  const [pesan, setPesan] = useState('')
  const [link, setLink] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const { data: sesi, isLoading } = useQuery({
    queryKey: ['inval-sesi', mulai, akhir],
    queryFn: () => invalApi.sesiSaya(mulai, akhir),
  })

  const kunciDipilih = useMemo(() => [...dipilih], [dipilih])

  // Daftar guru diambil ulang tiap kali pilihan sesi berubah — tanda bentrok hanya
  // bermakna terhadap sesi yang sedang dipilih.
  const { data: calon } = useQuery({
    queryKey: ['inval-calon', kunciDipilih],
    queryFn: () => invalApi.calonPengganti(kunciDipilih),
    enabled: kunciDipilih.length > 0,
  })

  const ajukan = useMutation({
    mutationFn: () =>
      invalApi.ajukan({
        substitute_teacher_id: pengganti,
        alasan,
        pesan: pesan || undefined,
        link_tugas: link || undefined,
        sesi: kunciDipilih,
      }),
    onSuccess: (d) => {
      setMsg({ ok: true, text: d.message })
      setDipilih(new Set()); setPengganti(''); setAlasan(''); setPesan(''); setLink('')
      void qc.invalidateQueries({ queryKey: ['inval-keluar'] })
      void qc.invalidateQueries({ queryKey: ['inval-sesi'] })
      setTimeout(onTerkirim, 900)
    },
    onError: (e: any) => setMsg({ ok: false, text: e.response?.data?.message ?? 'Gagal mengirim pengajuan.' }),
  })

  const terpilih = calon?.find((c) => c.id === pengganti)
  const siapKirim = kunciDipilih.length > 0 && pengganti && alasan.trim().length > 0

  function toggle(s: SesiPilihan) {
    const k = sesiKey(s)
    setDipilih((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${msg.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mulai">Dari tanggal</Label>
              <Input id="mulai" type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="akhir">Sampai tanggal</Label>
              <Input id="akhir" type="date" value={akhir} onChange={(e) => setAkhir(e.target.value)} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Pilih sesi yang ingin digantikan
              {dipilih.size > 0 && <span className="ml-2 text-xs text-muted-foreground">({dipilih.size} dipilih)</span>}
            </p>

            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : !sesi || sesi.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada sesi mengajar pada rentang tanggal ini.
              </p>
            ) : (
              <div className="space-y-1.5">
                {sesi.map((s) => {
                  const k = sesiKey(s)
                  const aktif = dipilih.has(k)
                  return (
                    <label
                      key={k}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        !s.bisa_diajukan ? 'cursor-not-allowed opacity-55' : aktif ? 'border-primary-600 bg-primary/5' : 'hover:bg-accent/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={aktif}
                        disabled={!s.bisa_diajukan}
                        onChange={() => toggle(s)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {s.tanggal} • {s.jam_mulai}–{s.jam_selesai}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.kelas}
                          {s.mapel && ` • ${s.mapel}`}
                        </p>
                        {s.alasan_blokir && (
                          <p className="mt-1 text-xs text-amber-700">{s.alasan_blokir}</p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {dipilih.size > 0 && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="pengganti">Guru pengganti</Label>
              <select
                id="pengganti"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={pengganti}
                onChange={(e) => setPengganti(e.target.value)}
              >
                <option value="">— pilih guru —</option>
                {(calon ?? []).map((c: CalonPengganti) => (
                  <option key={c.id} value={c.id}>
                    {c.nama}
                    {c.bentrok.length > 0 ? '  ⚠ sedang mengajar' : ''}
                  </option>
                ))}
              </select>

              {/* Bentrok memperingatkan, tidak memblokir — kadang guru memang ditugaskan
                  tetap masuk dan kelasnya digabung. Yang penting pengaju tahu sebelum kirim. */}
              {terpilih && terpilih.bentrok.length > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">{terpilih.nama} sudah mengajar pada jam itu</p>
                    <ul className="mt-0.5 list-inside list-disc">
                      {terpilih.bentrok.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                    <p className="mt-1">Anda tetap bisa mengajukan bila memang sudah dikoordinasikan.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alasan">Alasan berhalangan <span className="text-red-500">*</span></Label>
              <Input id="alasan" value={alasan} maxLength={500}
                placeholder="mis. Sakit, tugas dinas luar, mengantar lomba"
                onChange={(e) => setAlasan(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pesan">Pesan untuk guru pengganti</Label>
              <textarea id="pesan" rows={3} maxLength={2000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="mis. Tolong siswa mengerjakan LKS halaman 20–22, dikumpulkan di meja saya."
                value={pesan} onChange={(e) => setPesan(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="link">Link tugas (Google Drive)</Label>
              <Input id="link" type="url" value={link} placeholder="https://drive.google.com/..."
                onChange={(e) => setLink(e.target.value)} />
            </div>

            <Button className="w-full" disabled={!siapKirim || ajukan.isPending} onClick={() => ajukan.mutate()}>
              {ajukan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Kirim pengajuan ({dipilih.size} sesi)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Tab 2: Kotak Masuk ──────────────────────────────────────────────────────

function TabKotakMasuk() {
  const qc = useQueryClient()
  const [tolakId, setTolakId] = useState<string | null>(null)
  const [alasanTolak, setAlasanTolak] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['inval-masuk'], queryFn: invalApi.masuk })

  const segarkan = () => {
    void qc.invalidateQueries({ queryKey: ['inval-masuk'] })
    // Sesi berpindah ke daftar "perlu diisi" saya begitu disetujui — dashboard & form
    // agenda harus ikut menyegarkan, kalau tidak guru mengira persetujuannya tak berefek.
    void qc.invalidateQueries({ queryKey: ['agendas-perlu-diisi'] })
  }

  const setujui = useMutation({ mutationFn: invalApi.setujui, onSuccess: segarkan })
  const tolak = useMutation({
    mutationFn: ({ id, alasan }: { id: string; alasan: string }) => invalApi.tolak(id, alasan),
    onSuccess: () => { setTolakId(null); setAlasanTolak(''); segarkan() },
  })

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  const menunggu = (data ?? []).filter((i) => i.status === 'diajukan')
  const lainnya = (data ?? []).filter((i) => i.status !== 'diajukan')

  if (!data || data.length === 0) return <Kosong pesan="Belum ada permintaan mengajar pengganti untuk Anda." />

  return (
    <div className="space-y-4">
      {menunggu.map((i) => (
        <Card key={i.id}>
          <CardContent className="space-y-3 p-4">
            <KartuIsi inval={i} sudutPandang="pengganti" />

            {tolakId === i.id ? (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                <Label htmlFor={`tolak-${i.id}`} className="text-red-900">Alasan menolak</Label>
                <Input id={`tolak-${i.id}`} value={alasanTolak} maxLength={500}
                  placeholder="mis. Saya ada rapat kurikulum pada jam yang sama"
                  onChange={(e) => setAlasanTolak(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={!alasanTolak.trim() || tolak.isPending}
                    onClick={() => tolak.mutate({ id: i.id, alasan: alasanTolak })}>
                    Kirim penolakan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setTolakId(null); setAlasanTolak('') }}>
                    Batal
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" disabled={setujui.isPending} onClick={() => setujui.mutate(i.id)}>
                  <Check className="mr-1.5 h-4 w-4" /> Setujui
                </Button>
                <Button size="sm" variant="outline" onClick={() => setTolakId(i.id)}>
                  <X className="mr-1.5 h-4 w-4" /> Tolak
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Menyetujui berarti kewajiban mengisi agenda sesi di atas berpindah kepada Anda.
            </p>
          </CardContent>
        </Card>
      ))}

      {lainnya.map((i) => (
        <Card key={i.id} className="opacity-70">
          <CardContent className="p-4"><KartuIsi inval={i} sudutPandang="pengganti" /></CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Tab 3: Riwayat ──────────────────────────────────────────────────────────

function TabRiwayat() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['inval-keluar'], queryFn: invalApi.keluar })

  const batal = useMutation({
    mutationFn: invalApi.batal,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inval-keluar'] })
      void qc.invalidateQueries({ queryKey: ['inval-sesi'] })
    },
  })

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  if (!data || data.length === 0) return <Kosong pesan="Anda belum pernah mengajukan guru pengganti." />

  return (
    <div className="space-y-4">
      {data.map((i) => (
        <Card key={i.id}>
          <CardContent className="space-y-3 p-4">
            <KartuIsi inval={i} sudutPandang="pengaju" />

            {i.status === 'diajukan' && (
              <Button size="sm" variant="outline" disabled={batal.isPending} onClick={() => batal.mutate(i.id)}>
                Batalkan pengajuan
              </Button>
            )}
            {i.status === 'ditolak' && (
              <p className="rounded-md bg-red-50 p-2.5 text-xs text-red-800">
                Sesi ini tetap kewajiban Anda. Ajukan ke guru lain lewat tab <strong>Ajukan</strong>.
              </p>
            )}
            {i.status === 'kedaluwarsa' && (
              <p className="rounded-md bg-muted p-2.5 text-xs text-muted-foreground">
                Tidak dijawab sampai sesi lewat — kewajiban mengisi agenda tidak pernah berpindah.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Bagian bersama ──────────────────────────────────────────────────────────

const WARNA: Record<Inval['status'], string> = {
  diajukan: 'bg-amber-100 text-amber-800',
  disetujui: 'bg-green-100 text-green-800',
  ditolak: 'bg-red-100 text-red-800',
  dibatalkan: 'bg-muted text-muted-foreground',
  kedaluwarsa: 'bg-muted text-muted-foreground',
}

function KartuIsi({ inval, sudutPandang }: { inval: Inval; sudutPandang: 'pengaju' | 'pengganti' }) {
  const lawan = sudutPandang === 'pengganti' ? inval.pengaju : inval.pengganti
  const peran = sudutPandang === 'pengganti' ? 'Dari' : 'Kepada'

  return (
    <div className="space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{peran}: {lawan}</p>
          <p className="text-xs text-muted-foreground">Diajukan {inval.created_at}</p>
        </div>
        <Badge className={WARNA[inval.status]}>{inval.status_label}</Badge>
      </div>

      <div className="space-y-1 rounded-lg bg-muted/40 p-2.5">
        {inval.sesi.map((s, idx) => (
          <p key={idx} className="text-xs">
            <span className="font-medium">{s.tanggal}</span> • {s.jam_mulai}–{s.jam_selesai} • {s.kelas}
            {s.mapel && ` • ${s.mapel}`}
          </p>
        ))}
      </div>

      <p className="text-sm"><span className="text-muted-foreground">Alasan:</span> {inval.alasan}</p>

      {inval.pesan && (
        <p className="whitespace-pre-wrap rounded-md border-l-2 border-primary-600 bg-primary/5 p-2.5 text-sm">
          {inval.pesan}
        </p>
      )}

      {inval.link_tugas && (
        <a href={inval.link_tugas} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Buka lampiran tugas
        </a>
      )}

      {inval.status === 'disetujui' && inval.responded_at && (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <Check className="h-3.5 w-3.5" /> Diterima {inval.responded_at}
        </p>
      )}
      {inval.status === 'ditolak' && (
        <p className="flex items-start gap-1.5 text-xs text-red-700">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ditolak {inval.responded_at} — {inval.alasan_penolakan}
        </p>
      )}
    </div>
  )
}

function Kosong({ pesan }: { pesan: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{pesan}</p>
    </div>
  )
}
