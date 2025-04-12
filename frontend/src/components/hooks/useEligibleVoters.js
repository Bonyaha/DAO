/* eslint-disable no-undef */
import { useState, useEffect, useCallback } from 'react'
import { useReadContract, useWatchContractEvent } from 'wagmi'
import GovernanceToken from '../../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'

export function useEligibleVoters({ tokenAddress }) {
	const [eligibleVoters, setEligibleVoters] = useState(0)	

	const { data: tokenHoldersData, error: fetchError, refetch } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getTokenHolders',
		enabled: !!tokenAddress,
	})

	useEffect(() => {
		if (fetchError) {
			console.error('Error fetching eligible voters:', fetchError)
			setError('eligibleVoters', 'Failed to fetch eligible voters. Please try again later.')
			setEligibleVoters(0)
		} else if (tokenHoldersData !== undefined) {
			try {
				setEligibleVoters(Number(tokenHoldersData))				
			} catch (err) {
				console.error('Error formatting eligible voters:', err)
				setError('eligibleVoters', 'Failed to format eligible voters.')
				setEligibleVoters(0)
			}
		}
	}, [tokenHoldersData, fetchError])

	// Function to refetch token holders
	const refetchTokenHolders = useCallback(async () => {
		if (!tokenAddress) return
		try {
			await refetch()
		} catch (err) {
			console.error('Error refetching token holders:', err)			
		}
	}, [tokenAddress, refetch]);

	// Watch for events that might change the number of token holders
	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'TokenTransfer',
		onLogs: (logs) => {
			if (!logs || !Array.isArray(logs) || logs.length === 0) {
				console.warn('TokenTransfer: Received invalid logs:', logs)
				return
			}
			refetchTokenHolders()
		},
		enabled: !!tokenAddress,		
	})

	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'TokenMinted',
		onLogs: (logs) => {
			if (!logs || !Array.isArray(logs) || logs.length === 0) {
				console.warn('TokenMinted: Received invalid logs:', logs)
				return
			}
			refetchTokenHolders()
		},
		enabled: !!tokenAddress,		
	})

	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'DelegateChanged',
		onLogs: (logs) => {
			if (!logs || !Array.isArray(logs) || logs.length === 0) {
				console.warn('DelegateChanged: Received invalid logs:', logs)
				return
			}
			refetchTokenHolders()
		},
		enabled: !!tokenAddress,		
	})

	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'DelegateVotesChanged',
		onLogs: (logs) => {
			if (!logs || !Array.isArray(logs) || logs.length === 0) {
				console.warn('DelegateVotesChanged: Received invalid logs:', logs)
				return
			}
			refetchTokenHolders()
		},
		enabled: !!tokenAddress,		
	})

	return { eligibleVoters }
}