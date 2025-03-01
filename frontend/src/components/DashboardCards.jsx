import { useEffect, useState } from 'react'
import { useReadContract, useAccount, usePublicClient, useWatchContractEvent } from 'wagmi'
import { formatUnits } from 'viem'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'

function DashboardCards() {
  const [proposalCount, setProposalCount] = useState(0)
  const [governorAddress, setGovernorAddress] = useState('')
  const [tokenAddress, setTokenAddress] = useState('')
  const [votingPower, setVotingPower] = useState('0')
  const [eligibleVoters, setEligibleVoters] = useState(0)

  const { chain, isConnected, address } = useAccount()
  const publicClient = usePublicClient()

  // Helper function to format voting power consistently
  const formatVotingPower = (bigintValue) => {
    try {
      const formatted = formatUnits(bigintValue, 18)
      return parseFloat(formatted).toLocaleString(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0
      })
    } catch (error) {
      console.error('Error formatting voting power:', error)
      return bigintValue.toString()
    }
  }

  // Initialize network and contract addresses using Wagmi
  useEffect(() => {
    const initializeNetwork = async () => {
      if (!chain) {
        console.error('No chain detected')
        return
      }

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
    abi: GovernanceToken.abi,
    functionName: 'getVotes',
    args: [address],
    enabled: isConnected && !!tokenAddress && !!address
  })

  // Get the total eligible voters using useReadContract
  const { data: eligibleVotersData } = useReadContract({
    address: tokenAddress,
    abi: GovernanceToken.abi,
    functionName: 'getTokenHolders',
    enabled: isConnected && !!tokenAddress
  })

  // Function to update voting power
  const refreshVotingPower = async () => {
    if (!publicClient || !tokenAddress || !address) return

    try {
      const power = await publicClient.readContract({
        address: tokenAddress,
        abi: GovernanceToken.abi,
        functionName: 'getVotes',
        args: [address],
      })

      setVotingPower(formatVotingPower(power))
    } catch (error) {
      console.error('Error fetching voting power:', error)
    }
  }

  // Function to update eligible voters count
  const refreshEligibleVoters = async () => {
    if (!publicClient || !tokenAddress) return

    try {
      const count = await publicClient.readContract({
        address: tokenAddress,
        abi: GovernanceToken.abi,
        functionName: 'getTokenHolders',
      })
      setEligibleVoters(Number(count))
    } catch (error) {
      console.error('Error fetching eligible voters:', error)
    }
  }

  // Helper function to fetch the latest proposal count
  const refreshProposalCount = async () => {
    if (!publicClient || !governorAddress) return

    try {
      const count = await publicClient.readContract({
        address: governorAddress,
        abi: MyGovernor.abi,
        functionName: 'getNumberOfProposals',
      })
      setProposalCount(Number(count))
    } catch (error) {
      console.error('Error fetching proposal count:', error)
    }
  }

  // Update state when proposal count data changes
  useEffect(() => {
    if (proposalCountData) {
      setProposalCount(Number(proposalCountData))
    }
  }, [proposalCountData])

  // Update state when voting power data changes
  useEffect(() => {
    if (votingPowerData) {
      setVotingPower(formatVotingPower(votingPowerData))
    }
  }, [votingPowerData])

  // Update eligible voters count when data changes
  useEffect(() => {
    if (eligibleVotersData) {
      setEligibleVoters(Number(eligibleVotersData))
    }
  }, [eligibleVotersData])

  

  // Watch for ProposalCreated events
  useWatchContractEvent({
    address: governorAddress,
    abi: MyGovernor.abi,
    eventName: 'ProposalCreated',
    onLogs() {
      refreshProposalCount()
    },
    enabled: !!governorAddress && !!publicClient,
  })

  // Watch for token transfer events
  useWatchContractEvent({
    address: tokenAddress,
    abi: GovernanceToken.abi,
    eventName: 'TokenTransfer',
    onLogs() {
      refreshVotingPower()
      refreshEligibleVoters()
    },
    enabled: !!tokenAddress && !!publicClient && !!address,
  })

  // Watch for token minted events
  useWatchContractEvent({
    address: tokenAddress,
    abi: GovernanceToken.abi,
    eventName: 'TokenMinted',
    onLogs() {
      refreshVotingPower()
      refreshEligibleVoters()
    },
    enabled: !!tokenAddress && !!publicClient,
  })

  // Watch for DelegateChanged events from ERC20Votes
  useWatchContractEvent({
    address: tokenAddress,
    abi: GovernanceToken.abi,
    eventName: 'DelegateChanged',
    onLogs() {
      refreshVotingPower()
      refreshEligibleVoters()
    },
    enabled: !!tokenAddress && !!publicClient && !!address,
  })

  // Also watch for DelegateVotesChanged events
  useWatchContractEvent({
    address: tokenAddress,
    abi: GovernanceToken.abi,
    eventName: 'DelegateVotesChanged',
    onLogs() {
      refreshVotingPower()
      refreshEligibleVoters()
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
          <div className="bg-white shadow rounded-lg p-4 w-full text-center">
            <p className="text-xl text-gray-700">Please connect your wallet to view the dashboard</p>
          </div>
        )}
    </div>
  )
}

export default DashboardCards