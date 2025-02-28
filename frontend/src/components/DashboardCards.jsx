import { useEffect, useState } from 'react'
import { useReadContract, useAccount, usePublicClient, useWatchContractEvent } from 'wagmi'
//import { getContract } from 'viem'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import addresses from '../addresses.json'

function DashboardCards() {
  const [proposalCount, setProposalCount] = useState(0)
  const [governorAddress, setGovernorAddress] = useState('')
  const [votingPower, setVotingPower] = useState(0)
  // eslint-disable-next-line no-unused-vars
  const [eligibleVoters, setEligibleVoters] = useState(1) // Hardcoded for now as in original

  const { chain, isConnected, address } = useAccount()
  const publicClient = usePublicClient()

  // Initialize network and contract addresses using Wagmi
  useEffect(() => {
    const initializeNetwork = async () => {
      if (!chain) {
        console.error('No chain detected')
        return
      }

      // Map chain ID to network name (e.g., 31337 for localhost)
      const currentNetwork = chain.id === 31337 ? 'localhost' : chain.name.toLowerCase()

      if (addresses[currentNetwork]) {
        setGovernorAddress(addresses[currentNetwork].governor.address)
      } else {
        console.error(`Network ${currentNetwork} not found in addresses.json`)
      }
    }

    initializeNetwork()
  }, [chain])

  // Get proposal count using useReadContract
  const { data: proposalCountData } = useReadContract({
    address: governorAddress,
    abi: MyGovernor.abi,
    functionName: 'getNumberOfProposals',
    enabled: isConnected && !!governorAddress
  })

  // Update state when proposal count data changes
  useEffect(() => {
    if (proposalCountData) {
      setProposalCount(Number(proposalCountData))
    }
  }, [proposalCountData])

  // Watch for ProposalCreated events
  useWatchContractEvent({
    address: governorAddress,
    abi: MyGovernor.abi,
    eventName: 'ProposalCreated',
    onLogs() {
      // Refetch the proposal count when a new proposal is created
      if (publicClient && governorAddress) {
        publicClient.readContract({
          address: governorAddress,
          abi: MyGovernor.abi,
          functionName: 'getNumberOfProposals',
        }).then(count => {
          setProposalCount(Number(count))
        }).catch(error => {
          console.error('Error fetching proposal count:', error)
        })
      }
    },
    enabled: !!governorAddress && !!publicClient,
  })

  // Fetch voting power (this would need to be implemented based on your token contract)
  // This is a placeholder that you would need to replace with actual implementation
  useEffect(() => {
    const fetchVotingPower = async () => {
      if (!address || !governorAddress || !publicClient) return

      try {
        // This is where you would call your token contract to get voting power
        // For now, just setting it to 0 as in the original code
        setVotingPower(0)
      } catch (error) {
        console.error('Error fetching voting power:', error)
      }
    }

    fetchVotingPower()
  }, [address, governorAddress, publicClient])

  return (
    <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
      {isConnected ? (
        <>
          <div className="bg-white shadow rounded-lg p-4 flex-1">
            <h2 className="text-xl font-bold text-black">PROPOSALS</h2>
            <p className="text-gray-700">{proposalCount} Total proposals</p>
            <p className="text-gray-500">PARTICIPATE AND PROPOSE NOW</p>
          </div>
          <div className="bg-white shadow rounded-lg p-4 flex-1">
            <h2 className="text-xl font-bold text-black">ELIGIBLE VOTERS</h2>
            <p className="text-gray-700">{eligibleVoters} Total Voters</p>
            <p className="text-gray-500">JOIN THE DAO NOW AND BECOME ONE</p>
          </div>
          <div className="bg-white shadow rounded-lg p-4 flex-1">
            <h2 className="text-xl font-bold text-black">YOUR VOTING POWER</h2>
            <p className="text-3xl font-bold text-black">{votingPower}</p>
            <p className="text-gray-500">BASED ON YOUR TOKEN BALANCE</p>
          </div>
        </>
      )
        : (
          // Show a "Connect Wallet" message when not connected
          <div className="bg-white shadow rounded-lg p-4 w-full text-center">
            <p className="text-xl text-gray-700">Please connect your wallet to view the dashboard</p>
          </div>
        )}
    </div>
  )
}

export default DashboardCards