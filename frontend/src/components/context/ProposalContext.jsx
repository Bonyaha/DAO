import { useState, useEffect, useCallback, useMemo } from 'react'
import PropTypes from 'prop-types'
import { usePublicClient, useAccount } from 'wagmi'
import addresses from '../../addresses.json'
import { ProposalContext } from '../hooks/useProposalContext'
import { useTiming } from '../hooks/useTiming'
import { useVotingPower } from '../hooks/useVotingPower'
import { useProposals } from '../hooks/useProposals'
import { useEligibleVoters } from '../hooks/useEligibleVoters'


export function ProposalProvider({ children }) {
	const [governorAddress, setGovernorAddress] = useState('')
	const [tokenAddress, setTokenAddress] = useState('')
	const [boxAddress, setBoxAddress] = useState('')
	const publicClient = usePublicClient()
	const { address, chain, isConnected } = useAccount()

	// Set contract addresses
	useEffect(() => {
		const network = chain?.id === 31337 ? 'localhost' : chain?.name.toLowerCase()
		if (addresses[network]) {
			setGovernorAddress(addresses[network].governor.address)
			setTokenAddress(addresses[network].governanceToken.address)
			setBoxAddress(addresses[network].box.address)
		}
	}, [chain])
	

	// Using timing hook
	const { currentTime, currentBlock, blockTime, timingError } = useTiming({ publicClient, chain })

	// Use voting power hook
	const { votingPower } = useVotingPower({ tokenAddress, address })

	// Use proposals hook
	const { proposals, totalProposals, isLoading, fetchProposals, hasUserVoted, proposalError } = useProposals({
		publicClient,
		chain,
		governorAddress,
		address,
		currentBlock,
	})

	// Use eligible voters hook
	const { eligibleVoters } = useEligibleVoters({ tokenAddress })

	const canExecuteProposal = useCallback((eta) => {
		return eta > 0 && currentTime >= eta
	}, [currentTime])

	const contextValue = useMemo(() => ({
		proposals,
		totalProposals,
		governorAddress,
		tokenAddress, // Add tokenAddress to context
		boxAddress,
		votingPower,
		eligibleVoters,
		isLoading,
		hasUserVoted,
		currentTime,
		currentBlock,
		canExecuteProposal,
		blockTime,
		fetchProposals,
		isConnected,
		errors: {
			proposals: proposalError,
			timing: timingError,
		}
		
	}), [
		proposals,
		totalProposals,
		governorAddress,
		tokenAddress, // Add tokenAddress to context
		boxAddress,
		votingPower,
		eligibleVoters,
		isLoading,
		hasUserVoted,
		currentTime,
		currentBlock,
		canExecuteProposal,
		blockTime,
		fetchProposals,
		isConnected,
		proposalError, timingError
		
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