import { useEffect, useState } from 'react'
import { useReadContract, useAccount, usePublicClient, useWatchContractEvent } from 'wagmi'
import { formatUnits } from 'viem'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import MyToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'

function DashboardCards() {
  const [proposalCount, setProposalCount] = useState(0)
  const [governorAddress, setGovernorAddress] = useState('')
  const [tokenAddress, setTokenAddress] = useState('')
  const [votingPower, setVotingPower] = useState('0')
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
        setTokenAddress(addresses[currentNetwork].governanceToken.address)
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

  // Get the user's voting power using useReadContract
  const { data: votingPowerData } = useReadContract({
    address: tokenAddress,
    abi: MyToken.abi,
    functionName: 'getVotes', // Or the appropriate function in your token contract
    args: [address],
    enabled: isConnected && !!tokenAddress && !!address
  })

  // Update state when proposal count data changes
  useEffect(() => {
    if (proposalCountData) {
      setProposalCount(Number(proposalCountData))
    }
  }, [proposalCountData])

  // Update state when voting power data changes
  useEffect(() => {
    if (votingPowerData) {
      try {
        // Format the bigint value to a human-readable format
        // Assuming 18 decimals for ERC20 token (adjust if your token uses different decimals)
        const formatted = formatUnits(votingPowerData, 18)

        // Format number with commas for readability
        const readableFormat = parseFloat(formatted).toLocaleString(undefined, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 0
        })

        setVotingPower(readableFormat)
      } catch (error) {
        console.error('Error formatting voting power:', error)
        // Fallback to string representation if formatting fails
        setVotingPower(votingPowerData.toString())
      }
    }
  }, [votingPowerData])

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

   useWatchContractEvent({
    address: tokenAddress,
    abi: MyToken.abi,
    eventName: 'DelegateChanged', // Or similar event in your token contract
    onLogs() {
      // Refetch the voting power when delegation changes
      if (publicClient && tokenAddress && address) {
        publicClient.readContract({
          address: tokenAddress,
          abi: MyToken.abi,
          functionName: 'getVotes', // Or the appropriate function
          args: [address],
        }).then(power => {
          setVotingPower(Number(power))
        }).catch(error => {
          console.error('Error fetching voting power:', error)
        })
      }
    },
    enabled: !!tokenAddress && !!publicClient && !!address,
  })
  

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