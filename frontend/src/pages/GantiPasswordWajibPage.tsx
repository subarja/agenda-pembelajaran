import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ShieldAlert } from 'lucide-react'

// Halaman paksa ganti password: user dengan must_change_password diarahkan ke sini
// oleh ProtectedRoute dan backend menolak semua endpoint lain (403 must_change_password)
// sampai password diganti sendiri.
export default function GantiPasswordWajibPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [form, setForm] = useState({ password_lama: '', password_baru: '', password_baru_confirmation: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password_baru !== form.password_baru_confirmation) {
      setError('Konfirmasi password baru tidak sama.')
      return
    }
    setLoading(true)
    try {
      await api.put('/profile/password', form)
      updateUser({ must_change_password: false })
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Gagal mengganti password. Coba lagi.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try { await api.post('/auth/logout') } catch { /* token dibersihkan lokal apa pun hasilnya */ }
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base">Ganti Password Wajib</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Halo {user?.nama ?? 'Pengguna'} — akun Anda masih memakai password sementara dari sekolah.
              Demi keamanan, buat password baru milik Anda sendiri sebelum melanjutkan.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="password_lama">Password sekarang</Label>
                <PasswordInput id="password_lama" required value={form.password_lama}
                  onChange={(e) => setForm((f) => ({ ...f, password_lama: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password_baru">Password baru (min. 6 karakter)</Label>
                <PasswordInput id="password_baru" required minLength={6} value={form.password_baru}
                  onChange={(e) => setForm((f) => ({ ...f, password_baru: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password_baru_confirmation">Ulangi password baru</Label>
                <PasswordInput id="password_baru_confirmation" required minLength={6} value={form.password_baru_confirmation}
                  onChange={(e) => setForm((f) => ({ ...f, password_baru_confirmation: e.target.value }))} />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Password Baru
              </Button>
              <button type="button" onClick={handleLogout}
                className="w-full text-center text-xs text-muted-foreground hover:underline">
                Keluar dan login lagi nanti
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
