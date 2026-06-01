import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white font-bold text-lg">AP</div>
          <h1 className="text-xl font-bold">Lupa Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agenda Pembelajaran · SMKN 2 Cimahi</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {done ? (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <div>
                <p className="font-semibold">Email Terkirim</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Jika email <strong>{email}</strong> terdaftar, link reset password telah dikirim.
                  Periksa kotak masuk (dan folder spam).
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Link berlaku selama 60 menit.</p>
              <Link to="/login" className="text-sm text-primary underline underline-offset-2">
                Kembali ke halaman login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Masukkan email akun Anda. Kami akan mengirimkan link untuk mereset password.
                </p>
                <label className="block text-sm font-medium mb-1.5">Alamat Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guru@smkn2cimahi.sch.id"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Kirim Link Reset
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
