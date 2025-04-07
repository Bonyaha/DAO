import React from 'react'
import PropTypes from 'prop-types'
import VoteButton from './VoteButton'
import ProposalTimingButton from './ProposalTimingButton'

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

const ProposalCard = React.memo(({
	proposal,
	governorAddress,
	votingPower,
	canExecuteProposal,
	currentTime,
	handleVote,
	handleQueue,
	handleExecute,
	showForTooltip,
	setShowForTooltip,
	showAgainstTooltip,
	setShowAgainstTooltip,
	showAbstainTooltip,
	setShowAbstainTooltip,
	votingInProgress,
	queueInProgress,
	executionInProgress,
	formatDate,
}) => {
	const isVoteDisabled = votingInProgress || votingPower <= 0 || proposal.hasVoted
	const tooltipText = proposal.hasVoted
		? 'You have already voted on this proposal'
		: 'You need voting power to vote'

	const renderProposalStatus = () => {
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
						{proposal.executedAt && proposal.executedAt > 0
							? formatDate(proposal.executedAt)
							: 'Processing...'}
					</span>
				)}
			</div>
		)
	}

	const renderExecuteButton = () => {
		if (proposal.state !== 5) return null

		if (canExecuteProposal(proposal.eta, currentTime)) {
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

	return (
		<div className="bg-white p-6 rounded-lg shadow-md">
			<h3 className="text-xl font-bold">{proposal.title}</h3>
			<p className="my-2 text-gray-700">{proposal.description}</p>
			<div className="flex justify-between items-center mt-4">
				<div className="flex items-center">
					{renderProposalStatus()}
					<div className="ml-2">
						<ProposalTimingButton
							proposal={{ ...proposal, id: proposal.id.toString() }}
							governorAddress={governorAddress}
						/>
					</div>
				</div>
				<div className="space-x-2">
					{proposal.state === 1 && (
						<>
							<VoteButton
								onVote={() => handleVote(proposal.id, 1)}
								label="For"
								activeColor="bg-green-500"
								disabledColor="bg-green-300 cursor-not-allowed"
								isDisabled={isVoteDisabled}
								showTooltip={showForTooltip}
								setShowTooltip={setShowForTooltip}
								tooltipText={tooltipText}
								hasVoted={proposal.hasVoted}
								hasVotingPower={votingPower > 0}
							/>
							<VoteButton
								onVote={() => handleVote(proposal.id, 0)}
								label="Against"
								activeColor="bg-red-500"
								disabledColor="bg-red-300 cursor-not-allowed"
								isDisabled={isVoteDisabled}
								showTooltip={showAgainstTooltip}
								setShowTooltip={setShowAgainstTooltip}
								tooltipText={tooltipText}
								hasVoted={proposal.hasVoted}
								hasVotingPower={votingPower > 0}
							/>
							<VoteButton
								onVote={() => handleVote(proposal.id, 2)}
								label="Abstain"
								activeColor="bg-gray-500"
								disabledColor="bg-gray-300 cursor-not-allowed"
								isDisabled={isVoteDisabled}
								showTooltip={showAbstainTooltip}
								setShowTooltip={setShowAbstainTooltip}
								tooltipText={tooltipText}
								hasVoted={proposal.hasVoted}
								hasVotingPower={votingPower > 0}
							/>
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
					{proposal.state === 5 && renderExecuteButton()}
				</div>
			</div>
			<div className="mt-4 text-sm text-gray-500">
				<p>Votes For: {proposal.forVotes}</p>
				<p>Votes Against: {proposal.againstVotes}</p>
				<p>Abstained: {proposal.abstainVotes}</p>
			</div>
		</div>
	)
})

ProposalCard.displayName = 'ProposalCard'

ProposalCard.propTypes = {
	proposal: PropTypes.object.isRequired,
	governorAddress: PropTypes.string.isRequired,
	votingPower: PropTypes.number.isRequired,
	canExecuteProposal: PropTypes.func.isRequired,
	currentTime: PropTypes.number.isRequired,
	handleVote: PropTypes.func.isRequired,
	handleQueue: PropTypes.func.isRequired,
	handleExecute: PropTypes.func.isRequired,
	showForTooltip: PropTypes.bool.isRequired,
	setShowForTooltip: PropTypes.func.isRequired,
	showAgainstTooltip: PropTypes.bool.isRequired,
	setShowAgainstTooltip: PropTypes.func.isRequired,
	showAbstainTooltip: PropTypes.bool.isRequired,
	setShowAbstainTooltip: PropTypes.func.isRequired,
	votingInProgress: PropTypes.bool.isRequired,
	queueInProgress: PropTypes.bool.isRequired,
	executionInProgress: PropTypes.bool.isRequired,
	formatDate: PropTypes.func.isRequired,
}

export default ProposalCard