import { useState, useEffect, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { useProposalContext } from './hooks/useProposalContext'
//import { useErrorContext } from './hooks/useErrorContext'

// eslint-disable-next-line no-unused-vars
const ProposalTimingButton = ({ proposal, governorAddress }) => {
	const [timeLeft, setTimeLeft] = useState('')
	const [buttonStyle, setButtonStyle] = useState({})
	const [tooltipText, setTooltipText] = useState('')
	const [showTooltip, setShowTooltip] = useState(false)
	
	const lastCalculationTimeRef = useRef(0)

	const { currentTime, currentBlock, blockTime, canExecuteProposal, proposals, errors } = useProposalContext()
	
	// Find the latest proposal data from the context
	const latestProposal = proposals.find(p => p.id.toString() === proposal.id.toString())

	// Format time difference
	const formatTimeLeft = useCallback((seconds) => {
		if (seconds <= 0) return 'Ready'

		const days = Math.floor(seconds / 86400)
		const hours = Math.floor((seconds % 86400) / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		const remainingSeconds = Math.floor(seconds % 60)

		return [
			days > 0 ? `${days}d` : '',
			hours > 0 ? `${hours}h` : '',
			minutes > 0 ? `${minutes}m` : '',
			remainingSeconds > 0 ? `${remainingSeconds}s` : ''
		].filter(Boolean).join(' ') || 'Ready'
	}, [])
//console.log(`blockTime: ${blockTime}`);

	// Convert blocks to approximate time
	const blocksToTime = useCallback((blocks) => {
		const seconds = blocks * blockTime
		return formatTimeLeft(seconds)
	}, [formatTimeLeft, blockTime])

	// Calculate time left based on proposal state
	useEffect(() => {
		// Skip too frequent updates
		const now = Date.now()
		if (now - lastCalculationTimeRef.current < 200) {
			return
		}
		lastCalculationTimeRef.current = now

		const calculateTimeLeft = () => {
			if (!latestProposal) return

			try {
				//clearError('proposalTiming')
				switch (latestProposal.state) {
					case 0: // Pending
						if (latestProposal.proposalSnapshot) {
							const blocksUntilActive = latestProposal.proposalSnapshot - currentBlock

							// Handle the case where blocks are negative (already passed)
							if (blocksUntilActive <= 0) {
								setTimeLeft('Processing')
								setTooltipText('Processing complete, waiting for state update')
							} else {
								setTimeLeft('Processing')
								setTooltipText(`Voting begins in ${blocksUntilActive} blocks (approx. ${blocksToTime(blocksUntilActive)})`)
							}

							setButtonStyle({
								bg: 'bg-amber-100',
								text: 'text-amber-800',
								hover: 'hover:bg-amber-200'
							})
						}
						break

					case 1: // Active
						if (latestProposal.proposalDeadline) {
							const blocksUntilDeadline = latestProposal.proposalDeadline - currentBlock

							// Handle the case where blocks are negative (already passed)
							if (blocksUntilDeadline <= 0) {
								setTimeLeft('Voting')
								setTooltipText('Voting period complete, waiting for state update')
							} else {
								setTimeLeft('Voting')
								setTooltipText(`Voting ends in ${blocksUntilDeadline} blocks (approx. ${blocksToTime(blocksUntilDeadline)})`)
							}

							setButtonStyle({
								bg: 'bg-blue-100',
								text: 'text-blue-800',
								hover: 'hover:bg-blue-200'
							})
						}
						break

					case 5: // Queued
						if (latestProposal.eta) {
							const secondsUntilExecution = latestProposal.eta - currentTime
							if (secondsUntilExecution > 0) {
								setTimeLeft(formatTimeLeft(secondsUntilExecution))
								setTooltipText(`Ready for execution in ${formatTimeLeft(secondsUntilExecution)}`)
								setButtonStyle({
									bg: 'bg-purple-100',
									text: 'text-purple-800',
									hover: 'hover:bg-purple-200'
								})
							} else {
								setTimeLeft('Ready')
								setTooltipText('Proposal is ready for execution')
								setButtonStyle({
									bg: 'bg-green-100',
									text: 'text-green-800',
									hover: 'hover:bg-green-200'
								})
							}
						}
						break

					default:
						setTimeLeft('')
						setTooltipText('')
						setButtonStyle({
							bg: 'bg-gray-100',
							text: 'text-gray-800',
							hover: 'hover:bg-gray-200'
						})
				}
			} catch (error) {
				console.error('Error calculating time left:', error)
				//setError('proposalTiming', 'Failed to calculate proposal timing')
			}
		}

		calculateTimeLeft()

		const interval = setInterval(calculateTimeLeft, 1000)
		return () => clearInterval(interval)

	}, [latestProposal, currentTime, currentBlock, formatTimeLeft, blocksToTime])

	if (!timeLeft) return null

	return (
		<div className="relative inline-block">
			<button
				className={`${buttonStyle.bg} ${buttonStyle.text} px-3 py-1 rounded-full text-sm ${buttonStyle.hover} transition-colors duration-200`}
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				data-ready={latestProposal?.state === 5 && canExecuteProposal(latestProposal.eta)}
			>
				<span className="flex items-center">
					{/* Warning icon if there are errors */}
					{(errors?.proposals || errors?.timing) && (
						<svg
							className="w-4 h-4 mr-1 text-yellow-500"
							fill="currentColor"
							viewBox="0 0 20 20"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								fillRule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clipRule="evenodd"
							/>
						</svg>
					)}				
					<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					{timeLeft}
				</span>
			</button>
			{showTooltip && (
				<div className="absolute z-10 w-64 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg -left-24">
					<p>{tooltipText}</p>
					{/* Append error messages if they exist */}
					{errors?.proposals && (
						<p className="mt-2 text-yellow-300">Proposal error: {errors.proposals}</p>
					)}
					{errors?.timing && (
						<p className="mt-2 text-yellow-300">Timing error: {errors.timing}</p>
					)}				
				</div>
			)}
		</div>
	)
}

ProposalTimingButton.propTypes = {
	proposal: PropTypes.shape({
		id: PropTypes.oneOfType([
			PropTypes.string,
			PropTypes.number,
			PropTypes.object // For BigInt or BN objects
		]).isRequired,
		state: PropTypes.number.isRequired,
		eta: PropTypes.oneOfType([
			PropTypes.string,
			PropTypes.number,
			PropTypes.object // For BigInt or BN objects
		]),
		proposalSnapshot: PropTypes.number,
		proposalDeadline: PropTypes.number
	}).isRequired,
	governorAddress: PropTypes.string.isRequired
}

export default ProposalTimingButton