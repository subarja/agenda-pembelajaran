import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi, academicYearApi } from '@/features/auth/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BrandLogo from '@/components/layout/BrandLogo'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const [form, setForm]     = useState({ identifier: '', password: '', academic_year_id: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // retry 3 (bukan default global 1): cegatan proteksi bot hosting terhadap XHR ini
  // bersifat sementara (cookie challenge belum terpasang saat halaman baru dibuka) —
  // percobaan ulang beberapa detik kemudian biasanya lolos sendiri.
  const { data: years, isError, isFetching, refetch } = useQuery({
    queryKey: ['academic-years-pilihan'],
    queryFn: () => academicYearApi.pilihan(),
    retry: 3,
  })

  useEffect(() => {
    if (!form.academic_year_id && years && years.length > 0) {
      setForm((f) => ({ ...f, academic_year_id: years[0].id }))
    }
  }, [years, form.academic_year_id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(form)
      const { user, token } = res.data.data
      setAuth(user, token)
      navigate('/')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Login gagal. Coba lagi.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-primary-600">Agenda Pembelajaran</h1>
          <p className="text-sm text-muted-foreground mt-1">SMKN 2 Cimahi</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Masuk ke akun Anda</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Email / NIP / NISN</Label>
                <Input
                  id="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Email, NIP guru, atau NISN siswa"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Admin: email · Guru: NIP (password default = NIP) · Siswa: NISN (password default = NISN)
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Lupa password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="academic_year_id">Semester</Label>
                <select
                  id="academic_year_id"
                  required={!!years && years.length > 0}
                  value={form.academic_year_id}
                  onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {!years && !isError && <option value="">Memuat...</option>}
                  {!years && isError && <option value="">Gagal memuat</option>}
                  {years?.length === 0 && <option value="">Belum ada semester</option>}
                  {years?.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}{y.aktif ? ' (Aktif)' : ''}
                    </option>
                  ))}
                </select>
                {isError && (
                  <p className="text-xs text-red-600">
                    Gagal memuat daftar semester.{' '}
                    <button
                      type="button"
                      onClick={() => refetch()}
                      disabled={isFetching}
                      className="font-medium underline"
                    >
                      {isFetching ? 'Memuat...' : 'Coba lagi'}
                    </button>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Semua semester dapat diakses siapa pun — pilih yang ingin dikerjakan.
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Masuk...' : 'Masuk'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
