import AppRouter from '@/router'
import PwaInstallBanner from '@/components/PwaInstallBanner'

export default function App() {
  return (
    <>
      <AppRouter />
      <PwaInstallBanner />
    </>
  )
}
