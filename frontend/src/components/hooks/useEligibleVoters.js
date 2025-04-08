import { useState, useEffect } from 'react'
import { useReadContract, useWatchContractEvent } from 'wagmi'
import GovernanceToken from '../../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import { useErrorContext } from './useErrorContext'

export function useEligibleVoters({ tokenAddress }) {
	const [eligibleVoters, setEligibleVoters] = useState(0)
	const { setError, clearError } = useErrorContext()

	const { data: tokenHoldersData, error: fetchError } = useReadContract({
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
				clearError('eligibleVoters')
			} catch (err) {
				console.error('Error formatting eligible voters:', err)
				setError('eligibleVoters', 'Failed to format eligible voters.')
				setEligibleVoters(0)
			}
		}
	}, [tokenHoldersData, fetchError, setError, clearError])

	// Watch for events that might change the number of token holders
	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'TokenTransfer',
		onLogs: () => {
			// Refetch when tokens are transferred (could affect holder count)
			if (tokenAddress) {
				setEligibleVoters((prev) => prev) // Trigger re-fetch via useReadContract
			}
		},
		enabled: !!tokenAddress,
		onError: (err) => {
			console.error('Error in TokenTransfer event:', err)
			setError('eligibleVoters', 'Failed to watch TokenTransfer events.')
		}
	})

	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'TokenMinted',
		onLogs: () => {
			// Refetch when new tokens are minted (could increase holders)
			if (tokenAddress) {
				setEligibleVoters((prev) => prev) // Trigger re-fetch via useReadContract
			}
		},
		enabled: !!tokenAddress,
		onError: (err) => {
			console.error('Error in TokenMinted event:', err)
			setError('eligibleVoters', 'Failed to watch TokenMinted events.')
		}
	})

	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'DelegateChanged',
		onLogs: () => {
			// Refetch when delegation changes (could affect voter eligibility)
			if (tokenAddress) {
				setEligibleVoters((prev) => prev) // Trigger re-fetch via useReadContract
			}
		},
		enabled: !!tokenAddress,
		onError: (err) => {
			console.error('Error in DelegateChanged event:', err)
			setError('eligibleVoters', 'Failed to watch DelegateChanged events.')
		}
	})

	useWatchContractEvent({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		eventName: 'DelegateVotesChanged',
		onLogs: () => {
			// Refetch when delegated votes change (could affect voter eligibility)
			if (tokenAddress) {
				setEligibleVoters((prev) => prev) // Trigger re-fetch via useReadContract
			}
		},
		enabled: !!tokenAddress,
		onError: (err) => {
			console.error('Error in DelegateVotesChanged event:', err)
			setError('eligibleVoters', 'Failed to watch DelegateVotesChanged events.')
		}
	})

	return { eligibleVoters }
}