import React from 'react'
import HeaderBanner from './components/HeaderBanner'
import DashboardCards from './components/DashboardCards'
import ActionButtons from './components/ActionButtons'

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto p-4">
        <HeaderBanner />
        <DashboardCards />
        <ActionButtons />
      </div>
    </div>
  )
}

export default App