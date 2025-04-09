import { useState, useEffect, useCallback, useRef } from 'react'
import { useWatchContractEvent } from 'wagmi'
import { ethers } from 'ethers'
import MyGovernor from '../../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import { useErrorContext } from './useErrorContext'

export function useProposals({ publicClient, chain, governorAddress, address, currentBlock }) {
	const [proposals, setProposals] = useState([])
	const [totalProposals, setTotalProposals] = useState(0)
	const [isLoading, setIsLoading] = useState(true)
	const proposalCache = useRef(new Map()) // Map<proposalId, proposalData>
	const proposalsRef = useRef([])
	const { setError, clearError } = useErrorContext()

	// Utility: Check if user has voted
	const hasUserVoted = useCallback(async (proposalId) => {
		if (!address || !governorAddress || !publicClient) return false
		clearError('proposals')
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
			setError('proposals', 'Failed to check if user voted.')
			return false
		}
	}, [address, governorAddress, publicClient, setError, clearError])

	// Fetch single proposal data
	const fetchProposalData = useCallback(async (proposalId, basicData) => {
		if (!governorAddress || !publicClient || !chain) return null
		clearError('proposals')

		const calls = [
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'state', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalSnapshot', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalDeadline', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalVotes', args: [proposalId] },
			{ address: governorAddress, abi: MyGovernor.abi, functionName: 'proposalEta', args: [proposalId] },
		]

		let state, snapshot, deadline, votes, eta, hasVoted

		try {
			if (chain.id === 31337) {
				// Individual calls for Hardhat
				[state, snapshot, deadline, votes, eta] = await Promise.all(
					calls.map((call) => publicClient.readContract(call))
				)
				hasVoted = address ? await hasUserVoted(proposalId) : false
			} else {
				// Multicall for supported networks
				const results = await publicClient.multicall({ contracts: calls });
				[state, snapshot, deadline, votes, eta] = results.map((r) => r.result)
				hasVoted = address ? await hasUserVoted(proposalId) : false
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
		} catch (err) {
			console.error('Error fetching proposal data:', err)
			setError('proposals', `Failed to fetch data for proposal ${proposalId}.`)
			return null
		}
	}, [governorAddress, publicClient, chain, address, hasUserVoted, setError, clearError])

	// Fetch all proposals
	const fetchAllProposals = useCallback(async () => {
		if (!governorAddress || !publicClient || !chain) return

		setIsLoading(true)
		clearError('proposals')
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
					executedAt: 0,
				}
				return await fetchProposalData(proposalId, basicData)
			})

			const proposalsData = await Promise.all(proposalPromises)

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

			const finalProposals = proposalsData.map((proposal) => {
				const execInfo = executionTimestamps.find((e) => e.proposalId === proposal.id)
				return { ...proposal, executedAt: execInfo ? execInfo.executedAt : 0 }
			})

			setProposals(finalProposals)
		} catch (error) {
			console.error('Error fetching all proposals:', error)
			setError('proposals', 'Failed to fetch proposals. Please try again later.')
		} finally {
			setIsLoading(false)
		}
	}, [governorAddress, publicClient, chain, fetchProposalData, setError, clearError])

	// Update single proposal based on event
	const updateProposal = useCallback(async (proposalId, eventType, eventData) => {
		if (!proposalCache.current.has(proposalId) && eventType !== 'ProposalCreated') return
		clearError('proposals')

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

		try {
			const updatedData = await fetchProposalData(proposalId, basicData)
			if (eventType === 'ProposalExecuted') {
				const block = await publicClient.getBlock({ blockNumber: eventData.blockNumber })
				updatedData.executedAt = Number(block.timestamp)
			}

			proposalCache.current.set(proposalId, updatedData)
			setProposals(Array.from(proposalCache.current.values()))
		} catch (err) {
			console.error('Error updating proposal:', err)
			setError('proposals', 'Failed to update proposal. Please try again.')
		}
	}, [fetchProposalData, publicClient, setError, clearError])

	// Event handlers
	const handleProposalCreated = useCallback((logs) => {
		console.log('handleProposalCreated', logs)

		if (!logs || logs.length === 0 || !Array.isArray(logs)) {
			console.warn('handleProposalCreated: Received invalid logs:', logs)
			return
		}
		logs.forEach((log) => {
			if (log && log.args) {
				const { proposalId, description, targets, values, calldatas } = log.args
				updateProposal(proposalId, 'ProposalCreated', { description, targets, values, calldatas })
			}
		})
	}, [updateProposal])

	const handleVoteCast = useCallback((logs) => {
		if (!logs || logs.length === 0 || !Array.isArray(logs)) {
			console.warn('handleVoteCast: Received invalid logs:', logs)
			return
		}
		logs.forEach((log) => {
			if (log && log.args) {
				const { proposalId } = log.args
				updateProposal(proposalId, 'VoteCast', {})
			}
		})
	}, [updateProposal])

	const handleProposalQueued = useCallback((logs) => {
		if (!logs || logs.length === 0 || !Array.isArray(logs)) {
			console.warn('handleProposalQueued: Received invalid logs:', logs)
			return
		}
		logs.forEach((log) => {
			if (log && log.args) {
				const { proposalId } = log.args
				updateProposal(proposalId, 'ProposalQueued', {})
			}
		})
	}, [updateProposal])

	const handleProposalExecuted = useCallback((logs) => {
		if (!logs || logs.length === 0 || !Array.isArray(logs)) {
			console.warn('handleProposalExecuted: Received invalid logs:', logs)
			return
		}
		logs.forEach((log) => {
			if (log && log.args) {
				const { proposalId } = log.args
				updateProposal(proposalId, 'ProposalExecuted', { blockNumber: log.blockNumber })
			}
		})
	}, [updateProposal])

	// Initial fetch
	useEffect(() => {
		if (governorAddress) {
			fetchAllProposals()
		}
	}, [governorAddress, fetchAllProposals])

	// Watch contract events
	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalCreated',
		onLogs(logs) {
			console.log('New logs!', logs)
			handleProposalCreated(logs)
		},
		//onLogs: handleProposalCreated,
		enabled: !!governorAddress,
		onError: (err) => {
			console.error('Error in ProposalCreated event:', err)
			setError('proposals', 'Failed to watch ProposalCreated events.')
		},
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'VoteCast',
		onLogs: handleVoteCast,
		enabled: !!governorAddress,
		onError: (err) => {
			console.error('Error in VoteCast event:', err)
			setError('proposals', 'Failed to watch VoteCast events.')
		},
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalQueued',
		onLogs: handleProposalQueued,
		enabled: !!governorAddress,
		onError: (err) => {
			console.error('Error in ProposalQueued event:', err)
			setError('proposals', 'Failed to watch ProposalQueued events.')
		},
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalExecuted',
		onLogs: handleProposalExecuted,
		enabled: !!governorAddress,
		onError: (err) => {
			console.error('Error in ProposalExecuted event:', err)
			setError('proposals', 'Failed to watch ProposalExecuted events.')
		},
	})

	// Periodic state check
	useEffect(() => {
		if (!currentBlock || !proposalsRef.current.length) return

		const checkProposalStates = async () => {
			clearError('proposals')
			try {
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
			} catch (err) {
				console.error('Error checking proposal states:', err)
				setError('proposals', 'Failed to refresh proposal states.')
			}
		}
		const timeoutId = setTimeout(checkProposalStates, 500)
		return () => clearTimeout(timeoutId)
	}, [currentBlock, governorAddress, publicClient, fetchProposalData, setError, clearError])

	// Sync refs with state
	useEffect(() => {
		proposalsRef.current = proposals
		proposals.forEach((p) => proposalCache.current.set(p.id, p))
	}, [proposals])

	return {
		proposals,
		totalProposals,
		isLoading,
		fetchProposals: fetchAllProposals,
		hasUserVoted
	}
}