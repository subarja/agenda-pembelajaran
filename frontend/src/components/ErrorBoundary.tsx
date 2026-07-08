import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Jaring pengaman render. Sebelum ini aplikasi TIDAK punya ErrorBoundary sama sekali,
// sehingga satu error render mana pun (mis. baris data hasil import dengan relasi yatim
// yang bikin `x.y.z` melempar TypeError) langsung meng-unmount seluruh React tree →
// "blank putih total" yang hanya pulih dengan refresh manual. Boundary ini menangkap
// error itu, menampilkan kartu "coba lagi" alih-alih layar putih, dan menampilkan pesan
// error agar akar masalah bisa dikenali (bukan sekadar hilang tanpa jejak).
type Props = {
  children: ReactNode
  // Saat nilai ini berubah (mis. path route), boundary otomatis reset — jadi cukup
  // pindah menu untuk pulih, tidak perlu refresh browser.
  resetKey?: string | number
  // Full-screen (lapis terluar) vs kartu di dalam layout (sidebar tetap tampil).
  fullScreen?: boolean
}

type State = { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Tetap catat ke console agar terlihat di DevTools / terkumpul oleh error tracker.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  handleReset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const wrapCls = this.props.fullScreen
      ? 'flex min-h-screen items-center justify-center p-4'
      : 'flex min-h-[60vh] items-center justify-center p-4'

    return (
      <div className={wrapCls}>
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="mb-1 text-lg font-bold">Terjadi kesalahan menampilkan halaman</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Coba muat ulang halaman ini. Jika masih terjadi, sampaikan pesan di bawah ke admin/pengembang.
          </p>
          <div className="flex justify-center gap-2">
            <Button size="sm" onClick={this.handleReset}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Coba lagi
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Muat ulang penuh
            </Button>
          </div>
          <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {error.message || String(error)}
          </pre>
        </div>
      </div>
    )
  }
}
