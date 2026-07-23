import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DoorOpen, Check, X, LogOut, LogIn, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface IzinRow {
  id: string; tanggal: string; nama: string | null; kelas: string | null; foto_url: string | null
  keperluan: string; alasan: string | null; status: string; status_label: string
  berlaku_dari: string | null; berlaku_sampai: string | null
  waktu_keluar: string | null; waktu_masuk: string | null; catatan_piket: string | null
  terlambat_kembali: boolean; terlambat_menit: number
  validasi_sekuriti: boolean; validasi_piket: boolean; validator_kembali: string | null; catatan_kembali: string | null
}

export default function IzinKeluarSection() {
  const qc = useQueryClient()
  const [validasi, setValidasi] = useState<IzinRow | null>(null)
  const { data } = useQuery<{ data: IzinRow[]; belum_kembali_lampau: IzinRow[] }>({
    queryKey: ['piket-izin-keluar'],
    queryFn: () => api.get('/piket/izin-keluar').then(r => r.data),
    refetchInterval: 10_000,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['piket-izin-keluar'] })

  const proses = useMutation({
    mutationFn: (p: { id: string; body: Record<string, unknown> }) => api.post(`/piket/izin-keluar/${p.id}/proses`, p.body).then(r => r.data),
    onSuccess: () => refresh(),
  })
  const tandaiKembali = useMutation({
    mutationFn: (p: { id: string; keterangan: string }) => api.post(`/piket/izin-keluar/${p.id}/tandai-kembali`, { keterangan: p.keterangan }).then(r => r.data),
    onSuccess: () => { setValidasi(null); refresh() },
  })

  const rows = data?.data ?? []
  const lampau = data?.belum_kembali_lampau ?? []
  const menunggu = rows.filter(r => r.status === 'diajukan')
  const berjalan = rows.filter(r => ['disetujui', 'keluar', 'kembali'].includes(r.status))
    .sort((a, b) => Number(b.terlambat_kembali) - Number(a.terlambat_kembali))
  const jmlTerlambat = berjalan.filter(r => r.terlambat_kembali).length

  return (
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium"><DoorOpen className="h-4 w-4" /> Izin Keluar (QR)</div>

      <div>
        <div className="text-xs text-muted-foreground mb-2">Menunggu persetujuan ({menunggu.length})</div>
        {menunggu.length === 0 && <p className="text-xs text-muted-foreground">Tidak ada pengajuan.</p>}
        <div className="space-y-2">
          {menunggu.map(r => <PengajuanCard key={r.id} row={r} onProses={(body) => proses.mutate({ id: r.id, body })} pending={proses.isPending} />)}
        </div>
      </div>

      {/* Belum kembali dari hari sebelumnya (lintas hari) */}
      {lampau.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="destructive" className="text-[10px] flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {lampau.length} belum kembali (hari lalu)</Badge>
          </div>
          <div className="rounded-lg border divide-y">
            {lampau.map(r => (
              <IzinRowItem key={r.id} r={r} showTanggal onTandai={() => setValidasi(r)} />
            ))}
          </div>
        </div>
      )}

      {berjalan.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs text-muted-foreground">Berjalan hari ini</div>
            {jmlTerlambat > 0 && (
              <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {jmlTerlambat} terlambat kembali
              </Badge>
            )}
          </div>
          <div className="rounded-lg border divide-y">
            {berjalan.map(r => <IzinRowItem key={r.id} r={r} onTandai={() => setValidasi(r)} />)}
          </div>
        </div>
      )}

      {validasi && (
        <TandaiKembaliModal
          row={validasi}
          pending={tandaiKembali.isPending}
          onClose={() => setValidasi(null)}
          onConfirm={(keterangan) => tandaiKembali.mutate({ id: validasi.id, keterangan })}
        />
      )}
    </CardContent></Card>
  )
}

// Satu baris izin (dipakai "berjalan hari ini" & "belum kembali hari lalu").
function IzinRowItem({ r, onTandai, showTanggal }: { r: IzinRow; onTandai: () => void; showTanggal?: boolean }) {
  return (
    <div className={`px-3 py-2 text-sm ${r.terlambat_kembali ? 'bg-red-50 dark:bg-red-950/30' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium">{r.nama}</span>
        {r.kelas && <span className="text-xs text-muted-foreground">{r.kelas}</span>}
        {showTanggal && <span className="text-[10px] font-mono text-muted-foreground">{r.tanggal}</span>}
        <Badge variant={r.terlambat_kembali ? 'destructive' : 'secondary'} className="text-[10px]">{r.status_label}</Badge>
        {r.terlambat_kembali && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-red-600">
            <AlertTriangle className="h-3 w-3" /> telat {r.terlambat_menit}m
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {r.waktu_keluar && <span className="text-xs text-blue-600 flex items-center gap-0.5"><LogOut className="h-3 w-3" />{r.waktu_keluar}</span>}
          {r.waktu_masuk && <span className="text-xs text-green-600 flex items-center gap-0.5"><LogIn className="h-3 w-3" />{r.waktu_masuk}</span>}
        </span>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>{r.keperluan}{r.alasan ? ` — ${r.alasan}` : ''}</span>
        {r.berlaku_sampai && (
          <span className={r.terlambat_kembali ? 'text-red-600 font-medium' : ''}>· berlaku s.d. {r.berlaku_sampai}</span>
        )}
        {/* Aksi / status validasi kembali */}
        <span className="ml-auto">
          {r.status === 'keluar' ? (
            <Button size="sm" variant="outline" className="h-7" onClick={onTandai}>
              <LogIn className="h-3.5 w-3.5 mr-1" /> Tandai Sudah Kembali
            </Button>
          ) : r.validasi_sekuriti ? (
            <Button size="sm" variant="outline" className="h-7" disabled>✓ Sudah validasi sekuriti</Button>
          ) : r.validasi_piket ? (
            <Button size="sm" variant="outline" className="h-7" disabled title={`Dikonfirmasi piket${r.validator_kembali ? ` — ${r.validator_kembali}` : ''}${r.catatan_kembali ? `: ${r.catatan_kembali}` : ''}`}>
              ✓ Dikonfirmasi piket
            </Button>
          ) : null}
        </span>
      </div>
      {r.validasi_piket && r.catatan_kembali && (
        <p className="text-[11px] text-muted-foreground mt-1 italic">Ket. piket: {r.catatan_kembali}{r.validator_kembali ? ` (${r.validator_kembali})` : ''}</p>
      )}
    </div>
  )
}

// Popup konfirmasi + keterangan wajib (mencegah klik tak sengaja).
function TandaiKembaliModal({ row, onClose, onConfirm, pending }: { row: IzinRow; onClose: () => void; onConfirm: (keterangan: string) => void; pending: boolean }) {
  const [keterangan, setKeterangan] = useState('')
  const valid = keterangan.trim().length >= 3
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-background p-4 space-y-3 shadow-lg border" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-sm flex items-center gap-2"><LogIn className="h-4 w-4" /> Nyatakan Siswa Sudah Kembali?</h3>
        <div className="rounded-md bg-muted/40 p-2.5 text-xs">
          <div className="font-medium text-sm">{row.nama} <span className="text-muted-foreground font-normal">{row.kelas}</span></div>
          <div className="text-muted-foreground mt-0.5">
            {row.keperluan}{row.alasan ? ` — ${row.alasan}` : ''} · keluar {row.waktu_keluar ?? '-'} ({row.tanggal})
            {row.terlambat_kembali && <span className="text-red-600 font-medium"> · telat {row.terlambat_menit}m</span>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ini menandai siswa <b>sudah kembali</b> secara <b>manual oleh piket</b> (bukan scan sekuriti). Isi alasan kenapa piket yang memvalidasi.
        </p>
        <div>
          <label className="text-xs text-muted-foreground">Keterangan (wajib)</label>
          <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3}
            value={keterangan} onChange={e => setKeterangan(e.target.value)}
            placeholder='mis. "QR hilang, siswa kembali & diverifikasi langsung di gerbang" / "sekuriti tidak di tempat"' />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>Batal</Button>
          <Button size="sm" disabled={pending || !valid} onClick={() => onConfirm(keterangan.trim())}>
            <Check className="h-4 w-4 mr-1" /> Ya, Nyatakan Kembali
          </Button>
        </div>
      </div>
    </div>
  )
}

function PengajuanCard({ row, onProses, pending }: { row: IzinRow; onProses: (body: Record<string, unknown>) => void; pending: boolean }) {
  const [sampai, setSampai] = useState('')
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center gap-3">
        {row.foto_url
          ? <img src={row.foto_url} alt="" className="h-12 w-12 rounded object-cover border" />
          : <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">👤</div>}
        <div className="flex-1">
          <div className="font-medium text-sm">{row.nama} <span className="text-xs text-muted-foreground">{row.kelas}</span></div>
          <div className="text-xs text-muted-foreground">{row.keperluan}{row.alasan ? ` — ${row.alasan}` : ''}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground flex items-center gap-1">
          Berlaku s.d. <input type="time" className="rounded border px-2 py-1 text-xs" value={sampai} onChange={e => setSampai(e.target.value)} />
        </label>
        <Button size="sm" disabled={pending || !sampai} onClick={() => onProses({ aksi: 'setujui', berlaku_sampai: sampai })}>
          <Check className="h-4 w-4 mr-1" /> Setujui
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => onProses({ aksi: 'tolak' })}>
          <X className="h-4 w-4 mr-1" /> Tolak
        </Button>
      </div>
    </div>
  )
}
