import { useState, useEffect, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { usePublicClient, useWatchContractEvent, useReadContract, useBlockNumber, useAccount } from 'wagmi'
import { ethers } from 'ethers'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'
import { ProposalContext } from './hooks/useProposalContext'

// Add this utility function for debouncing
const useDebounce = (value, delay) => {
	const [debouncedValue, setDebouncedValue] = useState(value)

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value)
		}, delay)

		return () => {
			clearTimeout(handler)
		}
	}, [value, delay])

	return debouncedValue
}

export function ProposalProvider({ children }) {
	// Proposal-related state
	const [proposals, setProposals] = useState([])
	const [governorAddress, setGovernorAddress] = useState('')
	const [tokenAddress, setTokenAddress] = useState('')
	const [votingPower, setVotingPower] = useState(0)
	const [totalProposals, setTotalProposals] = useState(0)
	const [isLoading, setIsLoading] = useState(true)

	// Timing-related state
	const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))
	const [currentBlock, setCurrentBlock] = useState(0)
	const [blockTime, setBlockTime] = useState(1)

	// Use refs to track previous values
	//const previousProposalsRef = useRef([])
	const previousBlockRef = useRef(0)
	const proposalsRef = useRef([]) // New ref to track current proposals

	// Hooks
	const { address, chain } = useAccount()
	const publicClient = usePublicClient()
	const { data: blockNumberData } = useBlockNumber({ watch: true })
	console.log(`blockNumberData: ${blockNumberData}`)

	// Debounce block number updates to prevent too frequent state changes
	const debouncedBlockNumber = useDebounce(blockNumberData, 1000)

	// Update proposalsRef whenever proposals changes
	useEffect(() => {
		proposalsRef.current = proposals
	}, [proposals])

	// Detect and set block time dynamically
	useEffect(() => {
		const detectBlockTime = async () => {
			if (!publicClient) return

			try {
				// Fetch timestamps of two consecutive blocks
				const latestBlock = await publicClient.getBlock()
				const previousBlock = await publicClient.getBlock(latestBlock.number - 1n)

				// Calculate time difference between blocks - safely convert BigInt to Number
				const timeDiff = Number(latestBlock.timestamp - previousBlock.timestamp)

				// Update block time
				if (timeDiff > 0) {
					setBlockTime(timeDiff)
				} else {
					// Network-specific fallbacks
					if (chain?.id === 31337) { // Hardhat local
						setBlockTime(1) // 1 second for Hardhat
					} else { // for Sepolia
						setBlockTime(12) // 12 seconds as conservative estimate for Sepolia
					}
				}
			} catch (error) {
				console.error('Error detecting block time:', error)
				// Network-specific fallbacks
				if (chain?.id === 31337) { // Hardhat local
					setBlockTime(1) // 1 second for Hardhat
				} else { // for Sepolia
					setBlockTime(12) // 12 seconds as conservative estimate for Sepolia
				}
			}
		}

		detectBlockTime()
	}, [publicClient, chain])

	// Update current block number - use debounced value
	useEffect(() => {
		if (debouncedBlockNumber) {
			const blockNum = Number(debouncedBlockNumber)
			if (blockNum !== previousBlockRef.current) {
				previousBlockRef.current = blockNum
				setCurrentBlock(blockNum)
			}
		}
	}, [debouncedBlockNumber])

	// Fetch network and contract addresses
	useEffect(() => {
		const network = chain?.id === 31337 ? 'localhost' : chain?.name.toLowerCase()
		if (addresses[network]) {
			setGovernorAddress(addresses[network].governor.address)
			setTokenAddress(addresses[network].governanceToken.address)
		}
	}, [chain])

	// Update current time from blockchain
	const updateCurrentTime = useCallback(async () => {
		try {
			if (!publicClient) return
			const block = await publicClient.getBlock()
			setCurrentTime(Number(block.timestamp))
		} catch (error) {
			console.error('Error fetching block timestamp:', error)
		}
	}, [publicClient])

	// Fetch and update current time
	useEffect(() => {
		if (!publicClient) return
		updateCurrentTime()
		const interval = setInterval(updateCurrentTime, 10000) // Less frequent updates
		return () => clearInterval(interval)
	}, [updateCurrentTime, publicClient])

	// Fetch user's voting power
	// eslint-disable-next-line no-unused-vars
	const { data: userVotingPower, refetch: refetchVotingPower } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getVotes',
		args: [address],
		enabled: !!tokenAddress && !!address,
	})

	// Update voting power state when userVotingPower changes
	useEffect(() => {
		if (userVotingPower) {
			setVotingPower(Number(ethers.formatEther(userVotingPower)))
		}
	}, [userVotingPower])

	// Fetch proposals
	const fetchProposals = useCallback(async () => {
		if (!governorAddress || !publicClient) return

		setIsLoading(true)
		try {
			// Fetch proposal created events
			const events = await publicClient.getContractEvents({
				address: governorAddress,
				abi: MyGovernor.abi,
				eventName: 'ProposalCreated',
				fromBlock: 'earliest',
				toBlock: 'latest'
			})

			// Sort events by block number
			events.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
			setTotalProposals(events.length)

			// Fetch proposal details
			const proposalPromises = events.map(async (event) => {
				const { proposalId, description, targets, values, calldatas } = event.args

				// Get proposal state
				const state = await publicClient.readContract({
					address: governorAddress,
					abi: MyGovernor.abi,
					functionName: 'state',
					args: [proposalId],
				})

				// Get proposal snapshot and deadline
				const [proposalSnapshot, proposalDeadline] = await Promise.all([
					publicClient.readContract({
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: 'proposalSnapshot',
						args: [proposalId],
					}),
					publicClient.readContract({
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: 'proposalDeadline',
						args: [proposalId],
					})
				])

				// Get proposal votes
				const proposalVotes = await publicClient.readContract({
					address: governorAddress,
					abi: MyGovernor.abi,
					functionName: 'proposalVotes',
					args: [proposalId],
				})

				// Get proposal ETA if queued
				let eta = 0
				if (Number(state) === 5) { // 5 is 'Queued'
					try {
						eta = await publicClient.readContract({
							address: governorAddress,
							abi: MyGovernor.abi,
							functionName: 'proposalEta',
							args: [proposalId],
						})
						eta = Number(eta)
					} catch (error) {
						console.error('Error fetching proposal ETA:', error)
					}
				}

				const [title, desc] = description.split(':').map((s) => s.trim())
				return {
					id: proposalId,
					title,
					description: desc,
					state: Number(state),
					forVotes: ethers.formatEther(proposalVotes[1]),
					againstVotes: ethers.formatEther(proposalVotes[0]),
					abstainVotes: ethers.formatEther(proposalVotes[2]),
					targets,
					values,
					calldatas,
					descriptionHash: ethers.id(description),
					eta: eta,
					proposalSnapshot: Number(proposalSnapshot),
					proposalDeadline: Number(proposalDeadline)
				}
			})

			const proposalData = await Promise.all(proposalPromises)
			// Use functional update to avoid dependency on previous state
			setProposals(proposalData)
			//previousProposalsRef.current = proposalData
		} catch (error) {
			console.error('Error fetching proposals:', error)
		} finally {
			setIsLoading(false)
		}
	}, [governorAddress, publicClient])

	// Fetch proposals on mount and when governor address changes
	useEffect(() => {
		if (governorAddress) {
			fetchProposals()
		}
	}, [governorAddress, fetchProposals])

	// Watch contract events to refresh proposals
	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalCreated',
		onLogs: fetchProposals,
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'VoteCast',
		onLogs: fetchProposals,
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalQueued',
		onLogs: fetchProposals,
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalExecuted',
		onLogs: fetchProposals,
		enabled: !!governorAddress,
	})

	// Modified to use proposalsRef instead of proposals directly
	useEffect(() => {
		if (!currentBlock || !proposalsRef.current.length) return

		// Skip if the block hasn't changed
		if (currentBlock === previousBlockRef.current) return

		// Use a flag to prevent multiple simultaneous updates
		let isMounted = true

		const checkProposalStates = async () => {
			try {
				const updatedProposals = await Promise.all(
					proposalsRef.current.map(async (proposal) => {
						// Only check proposals in Pending or Active state
						if (proposal.state === 0 || proposal.state === 1) {
							try {
								const newState = await publicClient.readContract({
									address: governorAddress,
									abi: MyGovernor.abi,
									functionName: 'state',
									args: [proposal.id],
								})

								return {
									...proposal,
									state: Number(newState)
								}
							} catch (error) {
								console.error(`Error checking state for proposal ${proposal.id}:`, error)
								return proposal
							}
						}
						return proposal
					})
				)

				// Only update if component is still mounted and proposals actually changed
				if (isMounted && JSON.stringify(updatedProposals) !== JSON.stringify(proposalsRef.current)) {
					setProposals(updatedProposals)
				}
			} catch (error) {
				console.error('Error in checkProposalStates:', error)
			}
		}

		// Debounce the check to avoid too many calls
		const timeoutId = setTimeout(() => {
			checkProposalStates()
		}, 500)

		return () => {
			isMounted = false
			clearTimeout(timeoutId)
		}
	}, [currentBlock, governorAddress, publicClient]) // Removed proposals dependency

	// Check if a proposal can be executed
	const canExecuteProposal = useCallback((eta) => {
		return eta > 0 && currentTime >= eta
	}, [currentTime])

	// Context value
	const contextValue = {
		// Proposal-related
		proposals,
		totalProposals,
		governorAddress,
		votingPower,
		isLoading,

		// Timing-related
		currentTime,
		currentBlock,
		canExecuteProposal,
		blockTime,

		// Methods
		fetchProposals,
	}

	return (
		<ProposalContext.Provider value={contextValue}>
			{children}
		</ProposalContext.Provider>
	)
}

ProposalProvider.propTypes = {
	children: PropTypes.node.isRequired
}