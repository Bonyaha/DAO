import { useState, useEffect, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { usePublicClient, useWatchContractEvent, useReadContract, useBlockNumber, useAccount } from 'wagmi'
import { ethers } from 'ethers'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'
import { ProposalContext } from './hooks/useProposalContext'

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
	//console.log(`blockNumberData: ${blockNumberData}`)

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

	const hasUserVoted = useCallback(async (proposalId) => {
		if (!address || !governorAddress || !publicClient) return false

		try {
			const hasVoted = await publicClient.readContract({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'hasVoted',
				args: [proposalId, address],
			})

			return hasVoted
		} catch (error) {
			console.error('Error checking if user voted:', error)
			return false
		}
	}, [address, governorAddress, publicClient])

	// Fetch proposals
	const fetchProposals = useCallback(async () => {
		if (!governorAddress || !publicClient || !chain) return

		setIsLoading(true)
		try {
			// Fetch all ProposalCreated events
			const events = await publicClient.getContractEvents({
				address: governorAddress,
				abi: MyGovernor.abi,
				eventName: "ProposalCreated",
				fromBlock: "earliest",
				toBlock: "latest",
			})

			events.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
			setTotalProposals(events.length)

			const proposalBasics = events.map((event) => {
				const { proposalId, description, targets, values, calldatas } = event.args
				const [title, desc] = description.split(":").map((s) => s.trim())
				return {
					id: proposalId,
					title,
					description: desc,
					targets,
					values,
					calldatas,
					descriptionHash: ethers.id(description),
				}
			})

			let proposalData

			// Check if we're on Hardhat (chain ID 31337)
			if (chain.id === 31337) {
				// Fallback to individual calls for Hardhat
				proposalData = await Promise.all(
					proposalBasics.map(async (proposal) => {
						const state = await publicClient.readContract({
							address: governorAddress,
							abi: MyGovernor.abi,
							functionName: "state",
							args: [proposal.id],
						})

						const snapshot = await publicClient.readContract({
							address: governorAddress,
							abi: MyGovernor.abi,
							functionName: "proposalSnapshot",
							args: [proposal.id],
						})

						const deadline = await publicClient.readContract({
							address: governorAddress,
							abi: MyGovernor.abi,
							functionName: "proposalDeadline",
							args: [proposal.id],
						})

						const votes = await publicClient.readContract({
							address: governorAddress,
							abi: MyGovernor.abi,
							functionName: "proposalVotes",
							args: [proposal.id],
						})

						let eta = 0
						if (Number(state) === 5) {
							// Queued
							eta = await publicClient.readContract({
								address: governorAddress,
								abi: MyGovernor.abi,
								functionName: "proposalEta",
								args: [proposal.id],
							})
						}

						const hasVoted = address
							? await hasUserVoted(proposal.id)
							: false

						return {
							...proposal,
							state: Number(state),
							proposalSnapshot: Number(snapshot),
							proposalDeadline: Number(deadline),
							forVotes: ethers.formatEther(votes[1]),
							againstVotes: ethers.formatEther(votes[0]),
							abstainVotes: ethers.formatEther(votes[2]),
							eta: Number(eta),
							hasVoted,
						}
					})
				)
			} else {
				// Use multicall for supported networks
				const calls = proposalBasics.flatMap((proposal) => [
					{
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: "state",
						args: [proposal.id],
					},
					{
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: "proposalSnapshot",
						args: [proposal.id],
					},
					{
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: "proposalDeadline",
						args: [proposal.id],
					},
					{
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: "proposalVotes",
						args: [proposal.id],
					},
					{
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: "proposalEta",
						args: [proposal.id],
					},
					...(address
						? [
							{
								address: governorAddress,
								abi: MyGovernor.abi,
								functionName: "hasVoted",
								args: [proposal.id, address],
							},
						]
						: []),
				])

				const multicallResults = await publicClient.multicall({ contracts: calls })

				let resultIndex = 0
				proposalData = proposalBasics.map((basic) => {
					const state = multicallResults[resultIndex++].result
					const snapshot = multicallResults[resultIndex++].result
					const deadline = multicallResults[resultIndex++].result
					const votes = multicallResults[resultIndex++].result
					const eta = multicallResults[resultIndex++].result
					const hasVoted = address ? multicallResults[resultIndex++].result : false

					return {
						...basic,
						state: Number(state),
						proposalSnapshot: Number(snapshot),
						proposalDeadline: Number(deadline),
						forVotes: ethers.formatEther(votes[1]),
						againstVotes: ethers.formatEther(votes[0]),
						abstainVotes: ethers.formatEther(votes[2]),
						eta: Number(eta),
						hasVoted,
					}
				})
			}

			// Fetch execution timestamps for executed proposals
			const executedEvents = await publicClient.getContractEvents({
				address: governorAddress,
				abi: MyGovernor.abi,
				eventName: "ProposalExecuted",
				fromBlock: "earliest",
				toBlock: "latest",
			})

			const executionTimestamps = await Promise.all(
				executedEvents.map(async (event) => {
					const block = await publicClient.getBlock({ blockNumber: event.blockNumber })
					return {
						proposalId: event.args.proposalId,
						executedAt: Number(block.timestamp),
					}
				})
			)

			// Merge execution timestamps
			const finalProposals = proposalData.map((proposal) => {
				const execInfo = executionTimestamps.find((e) => e.proposalId === proposal.id)
				return {
					...proposal,
					executedAt: execInfo ? execInfo.executedAt : 0,
				}
			})

			setProposals(finalProposals)
		} catch (error) {
			console.error("Error fetching proposals:", error)
		} finally {
			setIsLoading(false)
		}
	}, [governorAddress, publicClient, chain, address, hasUserVoted]);

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

	useEffect(() => {
		if (!currentBlock || !proposalsRef.current.length) return

		let isMounted = true

		const checkProposalStates = async () => {
			try {
				const updatedProposals = await Promise.all(
					proposalsRef.current.map(async (proposal) => {
						try {
							const newState = await publicClient.readContract({
								address: governorAddress,
								abi: MyGovernor.abi,
								functionName: 'state',
								args: [proposal.id],
							})

							if (Number(newState) !== proposal.state) {
								return {
									...proposal,
									state: Number(newState)
								}
							}
							return proposal
						} catch (error) {
							console.error(`Error checking state for proposal ${proposal.id}:`, error)
							return proposal
						}
					})
				)

				// Compare proposals and update if changed
				if (isMounted) {
					const hasChanged = updatedProposals.some((updated, index) => {
						const current = proposalsRef.current[index]
						return !current || updated.state !== current.state
					})

					if (hasChanged) {
						setProposals(updatedProposals)
					}
				}
			} catch (error) {
				console.error('Error in checkProposalStates:', error)
			}
		}

		const timeoutId = setTimeout(() => {
			checkProposalStates()
		}, 500)

		return () => {
			isMounted = false
			clearTimeout(timeoutId)
		}
	}, [currentBlock, governorAddress, publicClient])

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
		hasUserVoted,

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