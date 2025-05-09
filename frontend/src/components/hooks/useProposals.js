/* eslint-disable no-undef */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useWatchContractEvent } from 'wagmi'
import { ethers } from 'ethers'
import MyGovernor from '../../artifacts/contracts/MyGovernor.sol/MyGovernor.json'

export function useProposals({ publicClient, chain, governorAddress, address, currentBlock }) {
	const [proposals, setProposals] = useState([])
	const [totalProposals, setTotalProposals] = useState(0)
	const [isLoading, setIsLoading] = useState(true)
	const proposalCache = useRef(new Map()) // Map<proposalId, proposalData>
	const proposalsRef = useRef([])
	const [proposalError, setProposalError] = useState(null)

	// Check if user has voted
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
			setError('proposals', 'Failed to check if user voted.')
			return false
		}
	}, [address, governorAddress, publicClient])

	// Fetch single proposal data
	const fetchProposalData = useCallback(async (proposalId, basicData) => {
		if (!governorAddress || !publicClient || !chain) return null
		setProposalError(null)

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
			setProposalError(`Failed to fetch data for proposal ${proposalId}.`)
			return null
		}
	}, [governorAddress, publicClient, chain, address, hasUserVoted])

	// Fetch all proposals
	const fetchAllProposals = useCallback(async () => {
		if (!governorAddress || !publicClient || !chain) return

		setIsLoading(true)
		setProposalError(null)
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
					blockNumber: Number(event.blockNumber)
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
			setProposalError('Failed to fetch proposals. Please try again later.')
		} finally {
			setIsLoading(false)
		}
	}, [governorAddress, publicClient, chain, fetchProposalData])

	// Update single proposal based on event
	const updateProposal = useCallback(async (proposalId, eventType, eventData) => {
		if (!proposalCache.current.has(proposalId) && eventType !== 'ProposalCreated') return
		setProposalError(null)

		let basicData = proposalCache.current.get(proposalId)
		if (eventType === 'ProposalCreated') {
			const { description, targets, values, calldatas, blockNumber } = eventData
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
				blockNumber: Number(blockNumber)
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
			console.log('Updated proposal:', Array.from(proposalCache.current.values()))

			const updatedProposals = Array.from(proposalCache.current.values()).sort(
				(a, b) => Number(b.blockNumber) - Number(a.blockNumber)
			)
			console.log('sorted proposals:', updatedProposals)

			setProposals(updatedProposals)
		} catch (err) {
			console.error('Error updating proposal:', err)
			setProposalError('Failed to update proposal. Please try again.')
		}
	}, [fetchProposalData, publicClient])

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
				updateProposal(proposalId, 'ProposalCreated', {
					description,
					targets,
					values,
					calldatas,
					blockNumber: log.blockNumber
				})
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
				updateProposal(proposalId, 'VoteCast', { blockNumber: log.blockNumber })
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
				updateProposal(proposalId, 'ProposalQueued', { blockNumber: log.blockNumber })
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

	// Periodic state check
	useEffect(() => {
		if (!currentBlock || !proposalsRef.current.length) return

		const checkProposalStates = async () => {
			setProposalError(null)
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
				setProposalError('Failed to refresh proposal states.')
			}
		}
		const timeoutId = setTimeout(checkProposalStates, 500)
		return () => clearTimeout(timeoutId)
	}, [currentBlock, governorAddress, publicClient, fetchProposalData])

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
		hasUserVoted,
		proposalError
	}
}