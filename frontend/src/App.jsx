import { useAccount } from 'wagmi'
import HeaderBanner from './components/HeaderBanner'
import DashboardCards from './components/DashboardCards'
import ActionButtons from './components/ActionButtons'
import { Account } from './components/account'
import { WalletOptions } from './components/wallet-options'

function ConnectWallet() {
  const { isConnected } = useAccount()
  if (isConnected) return <Account />
  return <WalletOptions />
}


function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <HeaderBanner />
        <DashboardCards />
        <ActionButtons />
        <ConnectWallet />
      </div>
    </div>
  )
}

export default App