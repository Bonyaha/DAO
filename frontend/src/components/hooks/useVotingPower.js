import { useState, useEffect } from 'react'
import { useReadContract } from 'wagmi'
import { ethers } from 'ethers'
import GovernanceToken from '../../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'

export function useVotingPower({ tokenAddress, address }) {
	const [votingPower, setVotingPower] = useState(0)
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

	return { votingPower }
}