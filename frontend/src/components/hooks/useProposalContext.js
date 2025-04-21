import { createContext, useContext } from 'react'

export const ProposalContext = createContext(null)

export const useProposalContext = () => {
	const context = useContext(ProposalContext)
	if (!context) {
		throw new Error('useProposalContext must be used within a ProposalProvider')
	}
	return context
}