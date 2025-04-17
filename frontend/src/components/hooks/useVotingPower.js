/* eslint-disable no-undef */
import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { ethers } from 'ethers'
import GovernanceToken from '../../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'


export function useVotingPower({ tokenAddress, address }) {
	const [votingPower, setVotingPower] = useState(0)
	//console.log('I am in useVotingPower');
	
	const { data: userVotingPower, error: fetchError, refetch } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getVotes',
		args: [address],
		enabled: !!tokenAddress && !!address
	})

	useEffect(() => {
		if (fetchError) {
			console.error('Error fetching voting power:', fetchError)
			setError('votingPower', 'Failed to fetch voting power. Please try again later.')
			setVotingPower(0)
		} else if (userVotingPower !== undefined) {
			try {
				setVotingPower(Number(ethers.formatEther(userVotingPower)))			
			} catch (err) {
				console.error('Error formatting voting power:', err)
				setError('votingPower', 'Failed to format voting power.')
				setVotingPower(0)
			}
		}
		
	}, [userVotingPower, fetchError])

	return { votingPower, refetchVotingPower: refetch }
}