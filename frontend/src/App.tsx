import AppRouter from '@/router'
import PwaInstallBanner from '@/components/PwaInstallBanner'
import PwaUpdateBanner from '@/components/PwaUpdateBanner'

export default function App() {
  return (
    <>
      <AppRouter />
      <PwaInstallBanner />
      <PwaUpdateBanner />
    </>
  )
}
