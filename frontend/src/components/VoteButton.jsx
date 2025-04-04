import PropTypes from 'prop-types'

const VoteButton = ({
	onVote,
	label,
	activeColor,
	disabledColor,
	isDisabled,
	showTooltip,
	setShowTooltip,
	tooltipText
}) => (
	<div
		className="relative inline-block"
		onMouseEnter={() => setShowTooltip(true)}
		onMouseLeave={() => setShowTooltip(false)}
	>
		<button
			onClick={onVote}
			className={`${!isDisabled ? `${activeColor} hover:bg-opacity-90` : disabledColor} text-white px-3 py-1 rounded`}
			disabled={isDisabled}
		>
			{label}
		</button>
		{showTooltip && isDisabled && (
			<div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg -left-24">
				{tooltipText}
			</div>
		)}
	</div>
)

VoteButton.propTypes = {
	onVote: PropTypes.func.isRequired,
	label: PropTypes.string.isRequired,
	activeColor: PropTypes.string.isRequired,
	disabledColor: PropTypes.string.isRequired,
	isDisabled: PropTypes.bool.isRequired,
	showTooltip: PropTypes.bool.isRequired,
	setShowTooltip: PropTypes.func.isRequired,
	tooltipText: PropTypes.string.isRequired,
}

export default VoteButton