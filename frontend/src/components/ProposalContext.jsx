import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { usePublicClient, useWatchContractEvent, useReadContract, useBlockNumber, useAccount } from 'wagmi'
import { ethers } from 'ethers'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'
import { ProposalContext } from './hooks/useProposalContext'


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

	// Hooks
	const { address, chain } = useAccount()
	const publicClient = usePublicClient()
	const { data: blockNumberData } = useBlockNumber({ watch: true })

// Detect and set block time dynamically
	useEffect(() => {
		const detectBlockTime = async () => {
			if (!publicClient) return

			try {
				// Get two consecutive blocks and calculate time difference
				const initialBlock = await publicClient.getBlock()
				// Wait a moment and get the next block
				await new Promise(resolve => setTimeout(resolve, 1000))
				const nextBlock = await publicClient.getBlock()

				const timeDiff = Number(nextBlock.timestamp) - Number(initialBlock.timestamp)
				setBlockTime(timeDiff > 0 ? timeDiff : 1)
			} catch (error) {
				console.error('Error detecting block time:', error)
				setBlockTime(1) // Default to 1 second
			}
		}

		detectBlockTime()
	}, [publicClient])

	// Update current block number
	useEffect(() => {
		if (blockNumberData) {
			setCurrentBlock(Number(blockNumberData))
		}
	}, [blockNumberData])

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
			setProposals(proposalData)
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

	// Check and update proposal states
	useEffect(() => {
		if (!currentBlock || !proposals.length) return

		const checkProposalStates = async () => {
			const updatedProposals = await Promise.all(
				proposals.map(async (proposal) => {
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

			setProposals(updatedProposals)
		}

		checkProposalStates()
	}, [currentBlock, proposals, governorAddress, publicClient])

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
