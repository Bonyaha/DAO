import { useState, useEffect, useCallback } from 'react'
import { useReadContract, usePublicClient } from 'wagmi'
import PropTypes from 'prop-types'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import { useTiming } from './hooks/useTiming'

const ProposalTimingButton = ({ proposal, governorAddress }) => {
	const [timeLeft, setTimeLeft] = useState('')
	const [buttonStyle, setButtonStyle] = useState({})
	const [tooltipText, setTooltipText] = useState('')
	const [showTooltip, setShowTooltip] = useState(false)	

	const { currentTime, canExecuteProposal } = useTiming()
	const publicClient = usePublicClient()

	const AVERAGE_BLOCK_TIME = 15

	// Get proposal deadline
	const { data: proposalDeadline } = useReadContract({
		address: governorAddress,
		abi: MyGovernor.abi,
		functionName: 'proposalDeadline',
		args: [proposal.id],
		enabled: !!governorAddress && !!proposal.id,
	})

	// Get proposal snapshot
	const { data: proposalSnapshot } = useReadContract({
		address: governorAddress,
		abi: MyGovernor.abi,
		functionName: 'proposalSnapshot',
		args: [proposal.id],
		enabled: !!governorAddress && !!proposal.id,
	})

	// Format time difference
	const formatTimeLeft = useCallback((seconds) => {
		if (seconds <= 0) return 'Ready'

		const days = Math.floor(seconds / 86400)
		const hours = Math.floor((seconds % 86400) / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		const remainingSeconds = seconds % 60

		return [
			days > 0 ? `${days}d` : '',
			hours > 0 ? `${hours}h` : '',
			minutes > 0 ? `${minutes}m` : '',
			`${remainingSeconds}s`
		].filter(Boolean).join(' ')
	}, [])

	// Convert blocks to approximate time
	const blocksToTime = useCallback((blocks) => {
		const seconds = blocks * AVERAGE_BLOCK_TIME
		return formatTimeLeft(seconds)
	}, [formatTimeLeft])

	// Calculate time left based on proposal state
	useEffect(() => {
		const calculateTimeLeft = async () => {
			try {
				if (!proposal || !publicClient || !governorAddress) return

				const currentBlockNumber = await publicClient.getBlockNumber()

				switch (proposal.state) {
					case 0: // Pending
						if (proposalSnapshot) {
							const blocksUntilActive = Number(proposalSnapshot) - Number(currentBlockNumber)
							if (blocksUntilActive > 0) {
								setTimeLeft(`${blocksUntilActive} blocks`)
								setTooltipText(`Voting begins in ${blocksUntilActive} blocks (approx. ${blocksToTime(blocksUntilActive)})`)
								setButtonStyle({
									bg: 'bg-amber-100',
									text: 'text-amber-800',
									hover: 'hover:bg-amber-200'
								})
								
							} else {
								setTimeLeft('Processing')
								setTooltipText('Waiting for next state update')
								setButtonStyle({
									bg: 'bg-amber-100',
									text: 'text-amber-800',
									hover: 'hover:bg-amber-200'
								})
								
							}
						}
						break

					case 1: // Active
						if (proposalDeadline) {
							const blocksUntilDeadline = Number(proposalDeadline) - Number(currentBlockNumber)
							if (blocksUntilDeadline > 0) {
								setTimeLeft(`${blocksUntilDeadline} blocks`)
								setTooltipText(`Voting ends in ${blocksUntilDeadline} blocks (approx. ${blocksToTime(blocksUntilDeadline)})`)
								setButtonStyle({
									bg: 'bg-blue-100',
									text: 'text-blue-800',
									hover: 'hover:bg-blue-200'
								})
								
							} else {
								setTimeLeft('Processing')
								setTooltipText('Waiting for next state update')
								setButtonStyle({
									bg: 'bg-blue-100',
									text: 'text-blue-800',
									hover: 'hover:bg-blue-200'
								})
							
							}
						}
						break

					case 5: // Queued
						if (proposal.eta) {
//console.log(`curentTime: ${currentTime}`);

							const secondsUntilExecution = proposal.eta - currentTime							
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
			}
		}

		calculateTimeLeft()
		const interval = setInterval(calculateTimeLeft, 1000)
		return () => clearInterval(interval)
	}, [proposal, publicClient, currentTime, proposalSnapshot, proposalDeadline, governorAddress, blocksToTime, formatTimeLeft, canExecuteProposal])

	if (!timeLeft) return null

	return (
		<div className="relative inline-block">
			<button
				className={`${buttonStyle.bg} ${buttonStyle.text} px-3 py-1 rounded-full text-sm ${buttonStyle.hover} transition-colors duration-200`}
				onMouseEnter={() => setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				data-ready={proposal.state === 5 && canExecuteProposal(proposal.eta)}
			>
				<span className="flex items-center">
					<svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					{timeLeft}
				</span>
			</button>
			{showTooltip && (
				<div className="absolute z-10 w-48 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg -left-12">
					{tooltipText}
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
		])		
	}).isRequired,
	governorAddress: PropTypes.string.isRequired
}

export default ProposalTimingButton