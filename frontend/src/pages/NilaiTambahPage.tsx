import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, X } from 'lucide-react'
import { karakterApi } from '@/features/karakter/api'
import type { StudentSearchItem } from '@/features/karakter/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { StudentClassPicker } from '@/components/karakter/StudentClassPicker'

// GK32/33: menu terpisah dari Karakter — alur pemilihan siswa sama seperti GK25, tapi
// poin yang diberikan di sini LANGSUNG FINAL (tidak menunggu approval admin), beda dari
// "Nilai Karakter Manual" di halaman Karakter yang butuh review.
export default function NilaiTambahPage() {
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchItem | null>(null)
  const [nilai, setNilai]     = useState('')
  const [catatan, setCatatan] = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: () => karakterApi.storeNilaiTambah({
      student_id: selectedStudent!.id,
      nilai: parseInt(nilai, 10),
      catatan: catatan || undefined,
    }),
    onSuccess: () => {
      setSuccess(true)
      setNilai(''); setCatatan(''); setError('')
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Gagal menyimpan nilai tambah.'),
  })

  function batal() {
    setSelectedStudent(null)
    setNilai(''); setCatatan(''); setError(''); setSuccess(false)
  }

  function handleSubmit() {
    setError('')
    const n = parseInt(nilai, 10)
    if (nilai === '' || isNaN(n)) { setError('Nilai poin wajib diisi (angka).'); return }
    if (n < -20 || n > 20) { setError('Nilai harus antara -20 dan +20.'); return }
    mutation.mutate()
  }

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold">Nilai Tambah</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Beri poin karakter tambahan secara manual — langsung berlaku, tidak perlu persetujuan admin.
        </p>
      </div>

      {selectedStudent ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary-300 bg-primary-50 px-4 py-3">
          <img src={selectedStudent.foto_url || '/images/default-avatar.jpg'} alt={selectedStudent.nama}
            className="w-[20mm] h-auto shrink-0 rounded border object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{selectedStudent.nama}</p>
            <p className="text-xs text-muted-foreground">
              {selectedStudent.nis}{selectedStudent.kelas && ` · ${selectedStudent.kelas}`}
            </p>
          </div>
          <button type="button" onClick={batal} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <StudentClassPicker onPick={(s) => { setSelectedStudent(s); setSuccess(false) }} />
      )}

      {selectedStudent && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nt-nilai">Nilai Poin <span className="text-red-500">*</span> <span className="text-muted-foreground font-normal">(-20 s.d. +20)</span></Label>
              <Input
                id="nt-nilai"
                type="number" min="-20" max="20"
                value={nilai}
                onChange={(e) => setNilai(e.target.value)}
                placeholder="mis: 10 atau -5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nt-catatan">Deskripsi <span className="text-muted-foreground font-normal">(opsional)</span></Label>
              <Input
                id="nt-catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="mis: Juara lomba, membantu teman..."
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
            {success && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
                <CheckCircle2 className="h-4 w-4" />
                Nilai tambah berhasil disimpan.
              </div>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSubmit} disabled={mutation.isPending}>
                {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button variant="ghost" onClick={batal}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
