import { useState, useMemo, useCallback } from 'react'
import { useWriteContract } from 'wagmi'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import ProposalCard from './ProposalCard'
import { useProposalContext } from './hooks/useProposalContext'

const PROPOSALS_PER_PAGE = 5



const ProposalListContent = () => {
	const {
		proposals,
		totalProposals,
		governorAddress,
		votingPower,
		canExecuteProposal,
		currentTime,
		isLoading,
		errors
	} = useProposalContext()


	const [page, setPage] = useState(0)
	const [showForTooltip, setShowForTooltip] = useState(false)
	const [showAgainstTooltip, setShowAgainstTooltip] = useState(false)
	const [showAbstainTooltip, setShowAbstainTooltip] = useState(false)

	const { writeContract: castVote, isPending: votingInProgress } = useWriteContract()
	const { writeContract: executeProposal, isPending: executionInProgress } = useWriteContract()
	const { writeContract: queueProposal, isPending: queueInProgress } = useWriteContract()

	const paginatedProposals = useMemo(() => {
		const startIdx = page * PROPOSALS_PER_PAGE
		const endIdx = startIdx + PROPOSALS_PER_PAGE
		return proposals.slice(startIdx, endIdx)
	}, [proposals, page])


	const handleVote = useCallback(async (proposalId, support) => {
		try {
			await castVote({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'castVote',
				args: [proposalId, support],
			})

		} catch (error) {
			console.error('Error voting:', error)
		}
	}, [governorAddress, castVote])

	const handleQueue = useCallback(async (proposal) => {
		try {
			await queueProposal({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'queue',
				args: [proposal.targets, proposal.values, proposal.calldatas, proposal.descriptionHash],
			})

		} catch (error) {
			console.error('Error queuing proposal:', error)
		}
	}, [governorAddress, queueProposal])

	const handleExecute = useCallback(async (proposal) => {
		// Double-check if proposal can be executed with fresh timestamp
		if (!canExecuteProposal(proposal.eta, currentTime)) {
			console.error('Proposal not yet ready for execution')
			return
		}

		const argsForExecuteProposal = {
			targets: proposal.targets,
			values: proposal.values,
			calldatas: proposal.calldatas,
			descriptionHash: proposal.descriptionHash
		}
		console.log(
			"Arguments for executeProposal (JSON.stringify):",
			JSON.stringify(
				argsForExecuteProposal,
				(key, value) => (typeof value === 'bigint' ? value.toString() : value),
				2
			)
		)

		try {
			await executeProposal({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'execute',
				args: [proposal.targets, proposal.values, proposal.calldatas, proposal.descriptionHash],
			})
		} catch (error) {
			console.error('Error executing proposal:', error)
		}
	}, [governorAddress, executeProposal, canExecuteProposal, currentTime])

	const handleNextPage = useCallback(() => {
		if ((page + 1) * PROPOSALS_PER_PAGE < totalProposals) {
			setPage(page + 1)
		}
	}, [page, totalProposals])

	const handlePrevPage = useCallback(() => {
		if (page > 0) {
			setPage(page - 1)
		}
	}, [page])

	//console.log('Rendering ProposalList with proposals:', proposals)

	const formatDate = (timestamp) => {
		if (!timestamp) return ''

		const date = new Date(timestamp * 1000)
		//console.log('Raw timestamp (seconds):', timestamp)
		//console.log('UTC time:', date.toUTCString())

		const formatted = new Intl.DateTimeFormat('default', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: 'Europe/Kyiv',
		}).format(date)

		return formatted
	}

	if (isLoading && !proposals.length) {
		return (
			<div className="mt-8">
				<h2 className="text-2xl font-bold mb-4">Proposals</h2>
				<div className="flex justify-center items-center h-32">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
				</div>
			</div>
		)
	}

	return (
		<div className="mt-8">
			<h2 className="text-2xl font-bold mb-4">Proposals</h2>
			{errors.proposals && (
				<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
					<p>{errors.proposals}</p>
				</div>
			)}
			{errors.timing && (
				<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
					<p>{errors.timing}</p>
				</div>
			)}
			{votingPower === 0 && (
				<div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
					<p>You don&apos;t have any voting power. Get tokens to participate in voting.</p>
				</div>
			)}

			{totalProposals === 0 || proposals.length === 0 ? (
				<div className="bg-white p-6 rounded-lg shadow-md">
					<p className="text-gray-500">No proposals found. Create one to get started!</p>
				</div>
			) : (
				<>
					<div className="space-y-4">
						{paginatedProposals.map((proposal) => (
							<ProposalCard
								key={proposal.id.toString()}
								proposal={proposal}
								governorAddress={governorAddress}
								votingPower={votingPower}
								canExecuteProposal={canExecuteProposal}
								currentTime={currentTime}
								handleVote={handleVote}
								handleQueue={handleQueue}
								handleExecute={handleExecute}
								showForTooltip={showForTooltip}
								setShowForTooltip={setShowForTooltip}
								showAgainstTooltip={showAgainstTooltip}
								setShowAgainstTooltip={setShowAgainstTooltip}
								showAbstainTooltip={showAbstainTooltip}
								setShowAbstainTooltip={setShowAbstainTooltip}
								votingInProgress={votingInProgress}
								queueInProgress={queueInProgress}
								executionInProgress={executionInProgress}
								formatDate={formatDate}
							/>
						))}
					</div>
					{totalProposals > PROPOSALS_PER_PAGE && (
						<div className="flex justify-between items-center mt-6">
							<button
								onClick={handlePrevPage}
								disabled={page === 0}
								className={`px-4 py-2 rounded ${page === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
									}`}
							>
								Previous
							</button>
							<span className="text-gray-600">
								Page {page + 1} of {Math.ceil(totalProposals / PROPOSALS_PER_PAGE)}
							</span>
							<button
								onClick={handleNextPage}
								disabled={(page + 1) * PROPOSALS_PER_PAGE >= totalProposals}
								className={`px-4 py-2 rounded ${(page + 1) * PROPOSALS_PER_PAGE >= totalProposals
									? 'bg-gray-300 text-gray-500 cursor-not-allowed'
									: 'bg-blue-500 text-white hover:bg-blue-600'
									}`}
							>
								Next
							</button>
						</div>
					)}
				</>
			)}
		</div>
	)
}

const ProposalList = () => <ProposalListContent />

export default ProposalList