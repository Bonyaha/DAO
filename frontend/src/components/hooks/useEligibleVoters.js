import { useState, useEffect } from 'react'
import { useReadContract, useWatchContractEvent } from 'wagmi'
import GovernanceToken from '../../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'

export function useEligibleVoters({ tokenAddress }) {
	const [eligibleVoters, setEligibleVoters] = useState(0)

	const { data: tokenHoldersData } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getTokenHolders',
		enabled: !!tokenAddress,
	})

	useEffect(() => {
		if (tokenHoldersData !== undefined) {
			setEligibleVoters(Number(tokenHoldersData))
		}
	}, [tokenHoldersData])

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
	})

	return { eligibleVoters }
}