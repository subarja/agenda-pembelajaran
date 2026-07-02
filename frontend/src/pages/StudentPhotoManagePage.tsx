import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Users, X } from 'lucide-react'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PhotoEditWidget from '@/components/PhotoEditWidget'

interface MyClassStudent {
  id: string
  nama: string
  email: string
  nis: string
  nisn: string | null
  angkatan: number | null
  wali_nama: string | null
  wali_kontak: string | null
  foto_url: string | null
}

const inputCls = 'w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

/**
 * Halaman "Data Siswa" untuk wali kelas — HANYA menampilkan siswa di kelas yang ia
 * walikan. Kelola foto DAN edit profil dasar (nama, email, NIS, NISN, angkatan, data
 * wali) — per Isu GK4. Pindah kelas & reset password TETAP privilese admin murni di
 * Panel Admin (lihat catatan di `StudentPhotoController::updateProfile()`). Siswa
 * sendiri tidak bisa akses/edit apa pun lewat halaman manapun — cuma admin (Panel
 * Admin) dan wali kelas (di sini) yang bisa.
 */
export default function StudentPhotoManagePage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<MyClassStudent | null>(null)
  const [form, setForm] = useState({ nama: '', email: '', nis: '', nisn: '', angkatan: '', wali_nama: '', wali_kontak: '' })
  const [err, setErr] = useState('')

  const { data, isLoading, error } = useQuery<{ data: MyClassStudent[]; kelas: { id: string; label: string } }>({
    queryKey: ['my-class-students'],
    queryFn: () => api.get('/my-class/students').then(r => r.data),
  })

  const save = useMutation({
    mutationFn: () => api.put(`/students/${editing!.id}/profile`, {
      nama: form.nama,
      email: form.email,
      nis: form.nis,
      nisn: form.nisn || null,
      angkatan: form.angkatan ? Number(form.angkatan) : null,
      wali_nama: form.wali_nama || null,
      wali_kontak: form.wali_kontak || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-class-students'] })
      setEditing(null)
      setErr('')
    },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Gagal menyimpan.'),
  })

  function openEdit(s: MyClassStudent) {
    setEditing(s)
    setErr('')
    setForm({
      nama: s.nama, email: s.email, nis: s.nis, nisn: s.nisn ?? '',
      angkatan: s.angkatan ? String(s.angkatan) : '',
      wali_nama: s.wali_nama ?? '', wali_kontak: s.wali_kontak ?? '',
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        {(error as any)?.response?.data?.message ?? 'Anda bukan wali kelas aktif — halaman ini hanya untuk wali kelas.'}
      </div>
    )
  }

  const students = data?.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Data Siswa {data?.kelas ? `— ${data.kelas.label}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola foto &amp; profil dasar siswa di kelas yang Anda walikan. Klik nama siswa untuk edit. Pindah kelas &amp; reset password tetap oleh admin di Panel Admin.
        </p>
      </div>

      {students.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">Belum ada siswa di kelas ini.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {students.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <button type="button" onClick={() => openEdit(s)} className="text-left flex-1 min-w-0 group">
                  <p className="font-medium text-sm flex items-center gap-1.5 group-hover:text-primary-700 transition-colors">
                    {s.nama}
                    <Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
                  </p>
                  <p className="text-xs text-muted-foreground">NIS: {s.nis}{s.nisn ? ` · NISN: ${s.nisn}` : ''}</p>
                </button>
                <PhotoEditWidget
                  fotoUrl={s.foto_url}
                  uploadEndpoint={`/students/${s.id}/photo`}
                  onUploaded={() => qc.invalidateQueries({ queryKey: ['my-class-students'] })}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Edit Profil Siswa</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</p>}

            <div className="space-y-2">
              <label className="text-xs font-medium block">Nama</label>
              <input className={inputCls} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />

              <label className="text-xs font-medium block">Email</label>
              <input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block">NIS</label>
                  <input className={inputCls} value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium block">NISN</label>
                  <input className={inputCls} value={form.nisn} onChange={e => setForm(f => ({ ...f, nisn: e.target.value }))} />
                </div>
              </div>

              <label className="text-xs font-medium block">Angkatan</label>
              <input type="number" className={inputCls} value={form.angkatan} onChange={e => setForm(f => ({ ...f, angkatan: e.target.value }))} />

              <label className="text-xs font-medium block">Nama Wali</label>
              <input className={inputCls} value={form.wali_nama} onChange={e => setForm(f => ({ ...f, wali_nama: e.target.value }))} />

              <label className="text-xs font-medium block">Kontak Wali</label>
              <input className={inputCls} value={form.wali_kontak} onChange={e => setForm(f => ({ ...f, wali_kontak: e.target.value }))} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Simpan
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Batal</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
