import { useState } from 'react'
import { useWriteContract } from 'wagmi'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import ProposalTimingButton from './ProposalTimingButton'
import { useProposalContext } from './hooks/useProposalContext'

const ProposalStatusMap = {
	0: 'Pending',
	1: 'Active',
	2: 'Canceled',
	3: 'Defeated',
	4: 'Succeeded',
	5: 'Queued',
	6: 'Expired',
	7: 'Executed',
}

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
		error
	} = useProposalContext()


	const [page, setPage] = useState(0)
	const [showForTooltip, setShowForTooltip] = useState(false)
	const [showAgainstTooltip, setShowAgainstTooltip] = useState(false)
	const [showAbstainTooltip, setShowAbstainTooltip] = useState(false)

	const { writeContract: castVote, isPending: votingInProgress } = useWriteContract()
	const { writeContract: executeProposal, isPending: executionInProgress } = useWriteContract()
	const { writeContract: queueProposal, isPending: queueInProgress } = useWriteContract()

	const startIdx = page * PROPOSALS_PER_PAGE
	const endIdx = startIdx + PROPOSALS_PER_PAGE
	const paginatedProposals = proposals.slice(startIdx, endIdx)


	const handleVote = async (proposalId, support) => {
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
	}

	const handleQueue = async (proposal) => {
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
	}

	const handleExecute = async (proposal) => {
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
	}

	const handleNextPage = () => {
		if ((page + 1) * PROPOSALS_PER_PAGE < totalProposals) {
			setPage(page + 1)
		}
	}

	const handlePrevPage = () => {
		if (page > 0) {
			setPage(page - 1)
		}
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

	const renderProposalStatus = (proposal) => {
		const statusText = ProposalStatusMap[proposal.state]
		const statusClass = ['Succeeded', 'Executed'].includes(statusText)
			? 'bg-green-100 text-green-800'
			: ['Defeated', 'Canceled', 'Expired'].includes(statusText)
				? 'bg-red-100 text-red-800'
				: 'bg-blue-100 text-blue-800'

		return (
			<div className="flex items-center">
				<span className={`px-3 py-1 rounded-full text-sm ${statusClass}`}>
					{statusText}
				</span>
				{statusText === 'Executed' && (
					<span className="ml-2 text-sm text-gray-600">
						{proposal.executedAt && proposal.executedAt > 0 ?
							formatDate(proposal.executedAt) :
							"Processing..."}
					</span>
				)}
			</div>
		)
	}
	// Execute button rendering in the JSX
	const renderExecuteButton = (proposal) => {
		if (proposal.state !== 5) return null

		if (canExecuteProposal(proposal.eta)) {
			return (
				<button
					onClick={() => handleExecute(proposal)}
					className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600"
					disabled={executionInProgress}
				>
					Execute
				</button>
			)
		} else {
			return (
				<button
					className="bg-gray-300 text-gray-600 px-3 py-1 rounded cursor-not-allowed"
					disabled={true}
				>
					Waiting
				</button>
			)
		}
	}

	//console.log("proposals", paginatedProposals);
	//console.log(`timelockPeriod: ${timelockPeriod}`);
	//console.log(`totalProposals: ${totalProposals}`);

	return (
		<div className="mt-8">
			<h2 className="text-2xl font-bold mb-4">Proposals</h2>
			{error && (
				<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
					<p>{error}</p>
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
							<div key={proposal.id.toString()} className="bg-white p-6 rounded-lg shadow-md">
								<h3 className="text-xl font-bold">{proposal.title}</h3>
								<p className="my-2 text-gray-700">{proposal.description}</p>
								<div className="flex justify-between items-center mt-4">
									{/* Updated status section with timing button */}
									<div className="flex items-center">
										{renderProposalStatus(proposal)}
										<div className="ml-2">
											<ProposalTimingButton
												proposal={{
													...proposal,
													id: proposal.id.toString()  // Convert BigInt to string
												}}
												governorAddress={governorAddress}
											/>
										</div>
									</div>
									<div className="space-x-2">
										{proposal.state === 1 && (
											<>
												<div
													className="relative inline-block"
													onMouseEnter={() => setShowForTooltip(true)}
													onMouseLeave={() => setShowForTooltip(false)}
												>
													<button
														onClick={() => handleVote(proposal.id, 1)}
														className={`${votingPower > 0 && !proposal.hasVoted
															? 'bg-green-500 hover:bg-green-600'
															: 'bg-green-300 cursor-not-allowed'
															} text-white px-3 py-1 rounded`}
														disabled={votingInProgress || votingPower <= 0 || proposal.hasVoted}
													>
														For
													</button>
													{showForTooltip && (proposal.hasVoted || votingPower <= 0) && (
														<div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg -left-24">
															{proposal.hasVoted
																? 'You have already voted on this proposal'
																: votingPower <= 0
																	? 'You need voting power to vote'
																	: ''}
														</div>
													)}
												</div>

												<div
													className="relative inline-block"
													onMouseEnter={() => setShowAgainstTooltip(true)}
													onMouseLeave={() => setShowAgainstTooltip(false)}
												>
													<button
														onClick={() => handleVote(proposal.id, 0)}
														className={`${votingPower > 0 && !proposal.hasVoted
															? 'bg-red-500 hover:bg-red-600'
															: 'bg-red-300 cursor-not-allowed'
															} text-white px-3 py-1 rounded`}
														disabled={votingInProgress || votingPower <= 0 || proposal.hasVoted}
													>
														Against
													</button>
													{showAgainstTooltip && (proposal.hasVoted || votingPower <= 0) && (
														<div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg -left-24">
															{proposal.hasVoted
																? 'You have already voted on this proposal'
																: votingPower <= 0
																	? 'You need voting power to vote'
																	: ''}
														</div>
													)}
												</div>

												<div
													className="relative inline-block"
													onMouseEnter={() => setShowAbstainTooltip(true)}
													onMouseLeave={() => setShowAbstainTooltip(false)}
												>
													<button
														onClick={() => handleVote(proposal.id, 2)}
														className={`${votingPower > 0 && !proposal.hasVoted
															? 'bg-gray-500 hover:bg-gray-600'
															: 'bg-gray-300 cursor-not-allowed'
															} text-white px-3 py-1 rounded`}
														disabled={votingInProgress || votingPower <= 0 || proposal.hasVoted}
													>
														Abstain
													</button>
													{showAbstainTooltip && (proposal.hasVoted || votingPower <= 0) && (
														<div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg -left-24">
															{proposal.hasVoted
																? 'You have already voted on this proposal'
																: votingPower <= 0
																	? 'You need voting power to vote'
																	: ''}
														</div>
													)}
												</div>
											</>
										)}
										{proposal.state === 4 && (
											<button
												onClick={() => handleQueue(proposal)}
												className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
												disabled={queueInProgress}
											>
												Queue
											</button>
										)}
										{proposal.state === 5 && renderExecuteButton(proposal)}
									</div>
								</div>
								<div className="mt-4 text-sm text-gray-500">
									<p>Votes For: {proposal.forVotes}</p>
									<p>Votes Against: {proposal.againstVotes}</p>
									<p>Abstained: {proposal.abstainVotes}</p>
								</div>
							</div>
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