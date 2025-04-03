import { useState, useEffect, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { usePublicClient,useAccount } from 'wagmi'
import addresses from '../addresses.json'
import { ProposalContext } from './hooks/useProposalContext'
import { useTiming } from './hooks/useTiming'
import { useVotingPower } from './hooks/useVotingPower'
import { useProposals } from './hooks/useProposal'


export function ProposalProvider({ children }) {
	const [governorAddress, setGovernorAddress] = useState('')
	const [tokenAddress, setTokenAddress] = useState('')	
	const publicClient = usePublicClient()
	const { address, chain } = useAccount()

	// Set contract addresses
	useEffect(() => {
		const network = chain?.id === 31337 ? 'localhost' : chain?.name.toLowerCase()
		if (addresses[network]) {
			setGovernorAddress(addresses[network].governor.address)
			setTokenAddress(addresses[network].governanceToken.address)
		}
	}, [chain])			


	// Using timing hook
	const { currentTime, currentBlock, blockTime } = useTiming(publicClient)

	// Use voting power hook
	const { votingPower } = useVotingPower({ tokenAddress, address })

	// Use proposals hook
	const { proposals, totalProposals, isLoading, fetchProposals, hasUserVoted } = useProposals({
		publicClient,
		chain,
		governorAddress,
		address,
		currentBlock,
	})
	
	const canExecuteProposal = useCallback((eta) => {
		return eta > 0 && currentTime >= eta
	}, [currentTime])

	const contextValue = useMemo(() => ({
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
		fetchProposals
	}), [
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
		fetchProposals
	])

	return (
		<ProposalContext.Provider value={contextValue}>
			{children}
		</ProposalContext.Provider>
	)
}

ProposalProvider.propTypes = {
	children: PropTypes.node.isRequired,
}