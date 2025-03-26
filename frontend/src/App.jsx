import { useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import HeaderBanner from './components/HeaderBanner'
import DashboardCards from './components/DashboardCards'
import ActionButtons from './components/ActionButtons'
import { WalletOptions } from './components/wallet-options'
  


function App() {    
  const [showWalletOptions, setShowWalletOptions] = useState(false);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const handleDisconnect = () => {
    disconnect()
    setShowWalletOptions(false)
  };
  

  if (!isConnected) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center p-8 bg-gray-800 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-white">Welcome to Our DAO</h1>
        <p className="mb-6 text-gray-300">Connect your wallet to participate in governance</p>
        {showWalletOptions ? (
          <WalletOptions />
        ) : (
          <button
            onClick={() => setShowWalletOptions(true)}
              className="bg-fuchsia-500 hover:bg-fuchsia-800 text-white font-medium px-6 py-3 rounded-lg w-full transition-colors duration-200"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  )
}

  return (


    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <div className="flex justify-end mb-4">
          {/* Account info and disconnect */}
          <div className="bg-white rounded-lg shadow-sm px-4 py-2 flex items-center">
            <span className="mr-4 font-medium">{address.slice(0, 6)}...{address.slice(-4)}</span>
            <button
              onClick={handleDisconnect} 
              className="text-red-500 hover:text-red-700"
            >
              Disconnect
            </button>
          </div>
        </div>

        <HeaderBanner />
        <DashboardCards />
        <ActionButtons />         
      </div>
    </div>
  )
}

export default App