import { useProposalContext } from './hooks/useProposalContext'


function DashboardCards() {
  const {
    totalProposals,
    votingPower,
    eligibleVoters,
    isLoading,
    isConnected
  } = useProposalContext()

  //console.log(`votingPower: ${votingPower}`)

  // Helper function to format voting power consistently
  const formatVotingPower = (power) => {
    // Ensure power is a number; fallback to 0 if not
    const numericPower = typeof power === 'number' ? power : 0
    // Return 0 if the value is 0
    if (numericPower === 0) {
      return '0'
    }
    // Format with commas, limiting to 2 decimal places
    return numericPower.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
      {isConnected ? (
        isLoading ? (
          <div className="bg-white shadow rounded-lg p-4 w-full text-center">
            <p className="text-xl text-gray-700">Loading dashboard data...</p>
          </div>
        ) : (
          <>
              <div className="bg-gradient-to-b from-indigo-400 to-violet-500 shadow rounded-lg p-4 flex-1">
                <h2 className="text-xl font-bold text-white">PROPOSALS</h2>
                <p className="text-white">{totalProposals} Total proposals</p>
                <p className="text-indigo-100 text-sm">PARTICIPATE AND PROPOSE NOW</p>
            </div>
            <div className="bg-gradient-to-b from-indigo-400 to-violet-500 shadow rounded-lg p-4 flex-1">
              <h2 className="text-xl font-bold text-white">ELIGIBLE VOTERS</h2>
              <p className="text-white">{eligibleVoters} Total Voters</p>
              <p className="text-indigo-100 text-sm">
                JOIN THE DAO NOW AND BECOME ONE
              </p>
            </div>
              <div className="bg-gradient-to-b from-indigo-400 to-violet-500 shadow rounded-lg p-4 flex-1">
                <h2 className="text-xl font-bold text-white">YOUR VOTING POWER</h2>
                <p className="text-3xl font-bold text-white">
                  {formatVotingPower(votingPower)}
                </p>
                <p className="text-indigo-100 text-sm">
                  BASED ON YOUR TOKEN BALANCE
                </p>
              </div>
          </>
        )
      )
        : (
          <div className="bg-white shadow rounded-lg p-4 w-full text-center">
            <p className="text-xl text-gray-700">Please connect your wallet to view the dashboard</p>
          </div>
        )}
    </div>
  )
}

export default DashboardCards