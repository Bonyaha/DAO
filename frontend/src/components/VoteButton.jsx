import React from 'react'
import PropTypes from 'prop-types'

const VoteButton = React.memo(({
	onVote,
	label,
	activeColor,
	disabledColor,
	isDisabled,
	showTooltip,
	setShowTooltip,
	tooltipText,
	hasVoted,
	hasVotingPower
}) => (
	<div
		className="relative inline-block"
		onMouseEnter={() => setShowTooltip(true)}
		onMouseLeave={() => setShowTooltip(false)}
	>
		<button
			onClick={onVote}
			className={`${!isDisabled ? `${activeColor} hover:bg-green-600` : disabledColor} text-white px-3 py-1 rounded`}
			disabled={isDisabled}
		>
			{label}
		</button>
		{showTooltip && (hasVoted || !hasVotingPower) && (
			<div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg -left-24">
				{tooltipText}
			</div>
		)}
	</div>
))

VoteButton.displayName = 'VoteButton'

VoteButton.propTypes = {
	onVote: PropTypes.func.isRequired,
	label: PropTypes.string.isRequired,
	activeColor: PropTypes.string.isRequired,
	disabledColor: PropTypes.string.isRequired,
	isDisabled: PropTypes.bool.isRequired,
	showTooltip: PropTypes.bool.isRequired,
	setShowTooltip: PropTypes.func.isRequired,
	tooltipText: PropTypes.string.isRequired,
	hasVoted: PropTypes.bool.isRequired,
	hasVotingPower: PropTypes.bool.isRequired
}

export default VoteButton