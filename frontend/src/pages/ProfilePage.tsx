import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Camera, Check, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { authApi } from '@/features/auth/api'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export default function ProfilePage() {
  const { user, clearAuth, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [editNama, setEditNama]   = useState(false)
  const [editHp, setEditHp]       = useState(false)
  const [editGelar, setEditGelar] = useState(false)
  const [editEmail, setEditEmail] = useState(false)
  const [editPwd, setEditPwd]     = useState(false)

  const [nama, setNama]                   = useState(user?.nama ?? '')
  const [hp, setHp]                       = useState(user?.teacher?.nomor_hp ?? '')
  const [gelarDepan, setGelarDepan]       = useState(user?.teacher?.gelar_depan ?? '')
  const [gelarBelakang, setGelarBelakang] = useState(user?.teacher?.gelar_belakang ?? '')
  const [email, setEmail]                 = useState(user?.email ?? '')
  const [emailPwd, setEmailPwd]   = useState('')
  const [pwdLama, setPwdLama]     = useState('')
  const [pwdBaru, setPwdBaru]     = useState('')
  const [pwdKonfirm, setPwdKonfirm] = useState('')

  const [msg, setMsg]   = useState('')
  const [err, setErr]   = useState('')

  if (!user) return null

  const initials = user.nama.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const isSiswa = user.role === 'siswa'
  // Siswa: foto RESMI (dikelola admin/wali kelas, kolom students.foto) — bukan
  // users.foto yang dipakai role lain, supaya siswa tidak bisa ganti foto sendiri.
  const displayFotoUrl = isSiswa ? (user.student?.foto_url ?? null) : user.foto_url

  async function handleLogout() {
    try { await authApi.logout() } finally { clearAuth(); navigate('/login') }
  }

  function flash(m: string, isErr = false) {
    if (isErr) setErr(m); else setMsg(m)
    setTimeout(() => { setMsg(''); setErr('') }, 3000)
  }

  // ── Upload foto ───────────────────────────────────────────────────────────
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('foto', file)
    try {
      const res = await api.post<{ foto_url: string }>('/profile/photo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAuth(Object.assign({}, user, { foto_url: res.data.foto_url }), useAuthStore.getState().token!)
      flash('Foto berhasil diperbarui.')
    } catch { flash('Gagal upload foto.', true) }
  }

  // ── Update nama ───────────────────────────────────────────────────────────
  const namaMutation = useMutation({
    mutationFn: () => api.put('/profile', { nama }),
    onSuccess: () => {
      setAuth({ ...user, nama }, useAuthStore.getState().token!)
      setEditNama(false)
      flash('Nama berhasil diperbarui.')
    },
    onError: () => flash('Gagal memperbarui nama.', true),
  })

  // ── Update nomor HP ───────────────────────────────────────────────────────
  const hpMutation = useMutation({
    mutationFn: () => api.put('/profile', { nomor_hp: hp }),
    onSuccess: () => {
      if (user.teacher) setAuth({ ...user, teacher: { ...user.teacher, nomor_hp: hp } }, useAuthStore.getState().token!)
      setEditHp(false)
      flash('Nomor HP berhasil diperbarui.')
    },
    onError: () => flash('Gagal memperbarui nomor HP.', true),
  })

  // ── Update gelar ──────────────────────────────────────────────────────────
  const gelarMutation = useMutation({
    mutationFn: () => api.put('/profile', { gelar_depan: gelarDepan || null, gelar_belakang: gelarBelakang || null }),
    onSuccess: () => {
      if (user.teacher) setAuth({
        ...user,
        teacher: { ...user.teacher, gelar_depan: gelarDepan || null, gelar_belakang: gelarBelakang || null },
      }, useAuthStore.getState().token!)
      setEditGelar(false)
      flash('Gelar berhasil diperbarui.')
    },
    onError: () => flash('Gagal memperbarui gelar.', true),
  })

  // ── Update email ──────────────────────────────────────────────────────────
  const emailMutation = useMutation({
    mutationFn: () => api.put('/profile/email', { email, password: emailPwd }),
    onSuccess: () => {
      setAuth({ ...user, email }, useAuthStore.getState().token!)
      setEditEmail(false); setEmailPwd('')
      flash('Email berhasil diperbarui.')
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      flash(e.response?.data?.message ?? 'Gagal memperbarui email.', true),
  })

  // ── Update password ───────────────────────────────────────────────────────
  const pwdMutation = useMutation({
    mutationFn: () => api.put('/profile/password', {
      password_lama: pwdLama,
      password_baru: pwdBaru,
      password_baru_confirmation: pwdKonfirm,
    }),
    onSuccess: () => {
      setEditPwd(false); setPwdLama(''); setPwdBaru(''); setPwdKonfirm('')
      flash('Password berhasil diperbarui.')
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      flash(e.response?.data?.message ?? 'Gagal memperbarui password.', true),
  })

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold">Profil</h1>

      {msg && <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700"><Check className="h-4 w-4" />{msg}</div>}
      {err && <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600"><X className="h-4 w-4" />{err}</div>}

      {/* ── Avatar + foto ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar className="h-20 w-20">
              {displayFotoUrl && <AvatarImage src={displayFotoUrl} alt={user.nama} />}
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            {!isSiswa && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary-600 text-white hover:bg-primary-700"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoChange} />
          </div>
          {isSiswa && (
            <p className="text-xs text-muted-foreground -mt-1">
              Foto siswa hanya bisa diganti oleh admin atau wali kelas.
            </p>
          )}
          <div className="text-center">
            <p className="font-semibold leading-tight">
              {[user.teacher?.gelar_depan, user.nama].filter(Boolean).join(' ')}
              {user.teacher?.gelar_belakang ? `, ${user.teacher.gelar_belakang}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {user.role.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Informasi akun ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Informasi Akun</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          {/* Nama */}
          <EditableField
            label="Nama Lengkap"
            value={user.nama}
            editing={editNama}
            onEdit={() => { setNama(user.nama); setEditNama(true) }}
            onCancel={() => setEditNama(false)}
            onSave={() => namaMutation.mutate()}
            saving={namaMutation.isPending}
          >
            <Input value={nama} onChange={(e) => setNama(e.target.value)} />
          </EditableField>

          {/* Gelar (guru) */}
          {user.teacher && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Gelar</p>
                {!editGelar && (
                  <button onClick={() => {
                    setGelarDepan(user.teacher?.gelar_depan ?? '')
                    setGelarBelakang(user.teacher?.gelar_belakang ?? '')
                    setEditGelar(true)
                  }} className="text-xs text-primary-600 hover:underline">Ubah</button>
                )}
              </div>
              {editGelar ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Gelar Depan</p>
                      <Input placeholder="mis: Drs., Dr., H." value={gelarDepan} onChange={(e) => setGelarDepan(e.target.value)} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Gelar Belakang</p>
                      <Input placeholder="mis: S.Pd., M.T." value={gelarBelakang} onChange={(e) => setGelarBelakang(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={gelarMutation.isPending} onClick={() => gelarMutation.mutate()}>
                      {gelarMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditGelar(false)}>Batal</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-medium">
                  {user.teacher.gelar_depan || user.teacher.gelar_belakang
                    ? [user.teacher.gelar_depan, user.teacher.gelar_belakang].filter(Boolean).join(' · ')
                    : '—'}
                </p>
              )}
            </div>
          )}

          {/* Nomor HP (guru/wali_kelas/wakasek) */}
          {user.teacher && (
            <EditableField
              label="Nomor HP"
              value={user.teacher.nomor_hp ?? '—'}
              editing={editHp}
              onEdit={() => { setHp(user.teacher?.nomor_hp ?? ''); setEditHp(true) }}
              onCancel={() => setEditHp(false)}
              onSave={() => hpMutation.mutate()}
              saving={hpMutation.isPending}
            >
              <Input type="tel" placeholder="08xxxxxxxxxx" value={hp} onChange={(e) => setHp(e.target.value)} />
            </EditableField>
          )}

          {/* NIP (guru) */}
          {user.teacher && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">NIP</p>
              <p className="text-sm font-medium">{user.teacher.nip ?? '—'}</p>
              {user.teacher.nip && (
                <p className="text-xs text-muted-foreground">NIP diisi saat import data guru</p>
              )}
            </div>
          )}

          {/* NISN (siswa) */}
          {user.student?.nisn && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">NISN</p>
              <p className="text-sm font-medium">{user.student.nisn}</p>
              <p className="text-xs text-muted-foreground">Login pakai NISN · Password default = NISN</p>
            </div>
          )}

          {/* NIS (siswa) */}
          {user.student?.nis && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">NIS</p>
              <p className="text-sm font-medium">{user.student.nis}</p>
            </div>
          )}

          {/* Kelas (siswa) */}
          {user.student?.kelas && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Kelas</p>
              <p className="text-sm font-medium">
                {user.student.kelas.tingkat} {user.student.kelas.jurusan} - {user.student.kelas.rombel}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ubah Email ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Email</CardTitle></CardHeader>
        <CardContent>
          {!editEmail ? (
            <div className="flex items-center justify-between">
              <p className="text-sm">{user.email}</p>
              <Button variant="ghost" size="sm" onClick={() => { setEmail(user.email); setEditEmail(true) }}>
                Ubah
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email Baru</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Konfirmasi Password</Label>
                <Input type="password" placeholder="Password saat ini" value={emailPwd} onChange={(e) => setEmailPwd(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={emailMutation.isPending} onClick={() => emailMutation.mutate()}>
                  {emailMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditEmail(false); setEmailPwd('') }}>Batal</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ubah Password ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Password</CardTitle></CardHeader>
        <CardContent>
          {!editPwd ? (
            <Button variant="outline" size="sm" onClick={() => setEditPwd(true)}>Ganti Password</Button>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Password Lama</Label>
                <PasswordInput value={pwdLama} onChange={(e) => setPwdLama(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Password Baru</Label>
                <PasswordInput value={pwdBaru} onChange={(e) => setPwdBaru(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Konfirmasi Password Baru</Label>
                <PasswordInput value={pwdKonfirm} onChange={(e) => setPwdKonfirm(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={pwdMutation.isPending} onClick={() => pwdMutation.mutate()}>
                  {pwdMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditPwd(false); setPwdLama(''); setPwdBaru(''); setPwdKonfirm('') }}>Batal</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={handleLogout}>
        <LogOut className="h-4 w-4" /> Keluar dari Akun
      </Button>
    </div>
  )
}

function EditableField({
  label, value, editing, onEdit, onCancel, onSave, saving, children,
}: {
  label: string; value: string; editing: boolean
  onEdit: () => void; onCancel: () => void; onSave: () => void
  saving: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {!editing && <button onClick={onEdit} className="text-xs text-primary-600 hover:underline">Ubah</button>}
      </div>
      {editing ? (
        <div className="space-y-2">
          {children}
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={onSave}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>Batal</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm font-medium">{value}</p>
      )}
    </div>
  )
}
