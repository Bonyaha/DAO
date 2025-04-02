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

	// Cache for proposals
	const proposalCache = useRef(new Map()) // Map<proposalId, proposalData>

	// Refs for tracking
	const previousBlockRef = useRef(0)
	const proposalsRef = useRef([])

	// Hooks
	const { address, chain } = useAccount()
	const publicClient = usePublicClient()
	const { data: blockNumberData } = useBlockNumber({ watch: true })

	const debouncedBlockNumber = useDebounce(blockNumberData, 1000)

	// Sync proposalsRef and cache with state
	useEffect(() => {
		proposalsRef.current = proposals
		proposals.forEach((p) => proposalCache.current.set(p.id, p))
	}, [proposals])

	// Detect block time
	useEffect(() => {
		const detectBlockTime = async () => {
			if (!publicClient) return
			try {
				const latestBlock = await publicClient.getBlock()
				const previousBlock = await publicClient.getBlock(latestBlock.number - 1n)
				const timeDiff = Number(latestBlock.timestamp - previousBlock.timestamp)
				setBlockTime(timeDiff > 0 ? timeDiff : chain?.id === 31337 ? 1 : 12)
			} catch (error) {
				console.error('Error detecting block time:', error)
				setBlockTime(chain?.id === 31337 ? 1 : 12)
			}
		}
		detectBlockTime()
	}, [publicClient, chain])

	// Update current block
	useEffect(() => {
		if (debouncedBlockNumber) {
			const blockNum = Number(debouncedBlockNumber)
			if (blockNum !== previousBlockRef.current) {
				previousBlockRef.current = blockNum
				setCurrentBlock(blockNum)
			}
		}
	}, [debouncedBlockNumber])

	// Set contract addresses
	useEffect(() => {
		const network = chain?.id === 31337 ? 'localhost' : chain?.name.toLowerCase()
		if (addresses[network]) {
			setGovernorAddress(addresses[network].governor.address)
			setTokenAddress(addresses[network].governanceToken.address)
		}
	}, [chain])

	// Update current time
	const updateCurrentTime = useCallback(async () => {
		try {
			if (!publicClient) return
			const block = await publicClient.getBlock()
			setCurrentTime(Number(block.timestamp))
		} catch (error) {
			console.error('Error fetching block timestamp:', error)
		}
	}, [publicClient])

	useEffect(() => {
		if (!publicClient) return
		updateCurrentTime()
		const interval = setInterval(updateCurrentTime, 10000)
		return () => clearInterval(interval)
	}, [updateCurrentTime, publicClient])

	// Fetch voting power
	const { data: userVotingPower } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getVotes',
		args: [address],
		enabled: !!tokenAddress && !!address,
	})

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

	// Fetch single proposal data
	const fetchProposalData = useCallback(async (proposalId, basicData) => {
		if (!governorAddress || !publicClient || !chain) return null

		const calls = [
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'state', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalSnapshot', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalDeadline', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalVotes', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalEta', args: [proposalId] },
			...(address ? [{ address: governorAddress, abi: MyGovernor.abi, functionName: 'hasVoted', args: [proposalId, address] }] : []),
		]

		let state, snapshot, deadline, votes, eta, hasVoted

		if (chain.id === 31337) {
			// Individual calls for Hardhat
			[state, snapshot, deadline, votes, eta] = await Promise.all(calls.slice(0, 5).map((call) =>
				publicClient.readContract(call)
			))
			hasVoted = address ? await hasUserVoted(proposalId) : false
		} else {
			// Multicall for supported networks
			const results = await publicClient.multicall({ contracts: calls });
			[state, snapshot, deadline, votes, eta] = results.slice(0, 5).map((r) => r.result)
			hasVoted = address ? results[5]?.result : false
		}

		return {
			...basicData,
			state: Number(state),
			proposalSnapshot: Number(snapshot),
			proposalDeadline: Number(deadline),
			forVotes: ethers.formatEther(votes[1]),
			againstVotes: ethers.formatEther(votes[0]),
			abstainVotes: ethers.formatEther(votes[2]),
			eta: Number(eta),
			hasVoted: hasVoted || false,
		}
	}, [governorAddress, publicClient, chain, address, hasUserVoted])

	// Initial fetch of all proposals
	const fetchAllProposals = useCallback(async () => {
		if (!governorAddress || !publicClient || !chain) return

		setIsLoading(true)
		try {
			const events = await publicClient.getContractEvents({
				address: governorAddress,
				abi: MyGovernor.abi,
				eventName: 'ProposalCreated',
				fromBlock: 'earliest',
				toBlock: 'latest',
			})

			events.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
			setTotalProposals(events.length)

			const proposalPromises = events.map(async (event) => {
				const { proposalId, description, targets, values, calldatas } = event.args
				const [title, desc] = description.split(':').map((s) => s.trim())
				const basicData = {
					id: proposalId,
					title,
					description: desc,
					targets,
					values,
					calldatas,
					descriptionHash: ethers.id(description),
					executedAt: 0, // Default, updated later
				}

				const proposalData = await fetchProposalData(proposalId, basicData)
				return proposalData
			})

			const proposalData = await Promise.all(proposalPromises)

			// Fetch execution timestamps
			const executedEvents = await publicClient.getContractEvents({
				address: governorAddress,
				abi: MyGovernor.abi,
				eventName: 'ProposalExecuted',
				fromBlock: 'earliest',
				toBlock: 'latest',
			})

			const executionTimestamps = await Promise.all(
				executedEvents.map(async (event) => {
					const block = await publicClient.getBlock({ blockNumber: event.blockNumber })
					return { proposalId: event.args.proposalId, executedAt: Number(block.timestamp) }
				})
			)

			const finalProposals = proposalData.map((proposal) => {
				const execInfo = executionTimestamps.find((e) => e.proposalId === proposal.id)
				return { ...proposal, executedAt: execInfo ? execInfo.executedAt : 0 }
			})

			setProposals(finalProposals)
		} catch (error) {
			console.error('Error fetching all proposals:', error)
		} finally {
			setIsLoading(false)
		}
	}, [governorAddress, publicClient, chain, fetchProposalData])

	// Update single proposal based on event
	const updateProposal = useCallback(async (proposalId, eventType, eventData) => {
		if (!proposalCache.current.has(proposalId) && eventType !== 'ProposalCreated') return

		let basicData = proposalCache.current.get(proposalId)
		if (eventType === 'ProposalCreated') {
			const { description, targets, values, calldatas } = eventData
			const [title, desc] = description.split(':').map((s) => s.trim())
			basicData = {
				id: proposalId,
				title,
				description: desc,
				targets,
				values,
				calldatas,
				descriptionHash: ethers.id(description),
				executedAt: 0,
			}
			setTotalProposals((prev) => prev + 1)
		}

		const updatedData = await fetchProposalData(proposalId, basicData)
		if (eventType === 'ProposalExecuted') {
			const block = await publicClient.getBlock({ blockNumber: eventData.blockNumber })
			updatedData.executedAt = Number(block.timestamp)
		}

		proposalCache.current.set(proposalId, updatedData)
		setProposals(Array.from(proposalCache.current.values()))
	}, [fetchProposalData, publicClient])

	// Event handlers
	const handleProposalCreated = useCallback((logs) => {
		logs.forEach((log) => {
			const { proposalId, description, targets, values, calldatas } = log.args
			updateProposal(proposalId, 'ProposalCreated', { description, targets, values, calldatas })
		})
	}, [updateProposal])

	const handleVoteCast = useCallback((logs) => {
		logs.forEach((log) => {
			const { proposalId } = log.args
			updateProposal(proposalId, 'VoteCast', {})
		})
	}, [updateProposal])

	const handleProposalQueued = useCallback((logs) => {
		logs.forEach((log) => {
			const { proposalId } = log.args
			updateProposal(proposalId, 'ProposalQueued', {})
		})
	}, [updateProposal])

	const handleProposalExecuted = useCallback((logs) => {
		logs.forEach((log) => {
			const { proposalId } = log.args
			updateProposal(proposalId, 'ProposalExecuted', { blockNumber: log.blockNumber })
		})
	}, [updateProposal])

	// Initial fetch
	useEffect(() => {
		if (governorAddress) {
			fetchAllProposals()
		}
	}, [governorAddress, fetchAllProposals])

	// Watch events
	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalCreated',
		onLogs: handleProposalCreated,
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'VoteCast',
		onLogs: handleVoteCast,
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalQueued',
		onLogs: handleProposalQueued,
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalExecuted',
		onLogs: handleProposalExecuted,
		enabled: !!governorAddress,
	})

	// Check proposal states periodically
	useEffect(() => {
		if (!currentBlock || !proposalsRef.current.length) return

		const checkProposalStates = async () => {
			const updatedProposals = await Promise.all(
				proposalsRef.current.map(async (proposal) => {
					const newState = await publicClient.readContract({
						address: governorAddress,
						abi: MyGovernor.abi,
						functionName: 'state',
						args: [proposal.id],
					})
					if (Number(newState) !== proposal.state) {
						const updated = await fetchProposalData(proposal.id, proposal)
						proposalCache.current.set(proposal.id, updated)
						return updated
					}
					return proposal
				})
			)
			setProposals(updatedProposals)
		}

		const timeoutId = setTimeout(checkProposalStates, 500)
		return () => clearTimeout(timeoutId)
	}, [currentBlock, governorAddress, publicClient, fetchProposalData])

	const canExecuteProposal = useCallback((eta) => {
		return eta > 0 && currentTime >= eta
	}, [currentTime])

	const contextValue = {
		proposals,
		totalProposals,
		governorAddress,
		votingPower,
		isLoading,
		hasUserVoted,
		currentTime,
		currentBlock,
		canExecuteProposal,
		blockTime,
		fetchProposals: fetchAllProposals,
	}

	return (
		<ProposalContext.Provider value={contextValue}>
			{children}
		</ProposalContext.Provider>
	)
}

ProposalProvider.propTypes = {
	children: PropTypes.node.isRequired,
}