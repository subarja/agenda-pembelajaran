import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [params]           = useSearchParams()
  const navigate           = useNavigate()
  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPw, setShowPw]             = useState(false)
  const [loading, setLoading]           = useState(false)
  const [done, setDone]                 = useState(false)
  const [error, setError]               = useState('')
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({})

  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  useEffect(() => {
    if (!token || !email) {
      setError('Link reset password tidak valid. Minta link baru dari halaman lupa password.')
    }
  }, [token, email])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (password !== confirm) {
      setFieldErrors({ password_confirmation: 'Konfirmasi password tidak cocok.' })
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email,
        token,
        password,
        password_confirmation: confirm,
      })
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err: any) {
      const data = err.response?.data
      if (data?.errors) {
        const mapped: Record<string, string> = {}
        Object.entries(data.errors).forEach(([k, v]) => { mapped[k] = (v as string[])[0] })
        setFieldErrors(mapped)
      } else {
        setError(data?.message || 'Terjadi kesalahan. Coba lagi.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white font-bold text-lg">AP</div>
          <h1 className="text-xl font-bold">Reset Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agenda Pembelajaran · SMKN 2 Cimahi</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {done ? (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <div>
                <p className="font-semibold">Password Berhasil Direset</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Anda akan diarahkan ke halaman login dalam 3 detik.
                </p>
              </div>
              <Link to="/login" className="text-sm text-primary underline underline-offset-2">
                Login Sekarang
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {email && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Email</label>
                  <p className="text-sm font-medium px-3 py-2 rounded-lg bg-muted">{email}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    required
                    minLength={8}
                    className="w-full pr-10 px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Konfirmasi Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Ulangi password baru"
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {fieldErrors.password_confirmation && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.password_confirmation}</p>
                )}
              </div>

              {fieldErrors.token && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{fieldErrors.token}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading || !token}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset Password
              </Button>

              <Link
                to="/forgot-password"
                className="block text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Minta link reset baru
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
