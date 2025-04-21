import { useEffect, useState, useCallback, useMemo } from 'react'
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { BaseError, ContractFunctionRevertedError } from 'viem'

import Box from '../artifacts/contracts/Box.sol/Box.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import ProposalForm from './ProposalForm'
import ProposalList from './ProposalList'
import { useProposalContext } from './hooks/useProposalContext'


function ActionButtons() {
	const [displayValue, setDisplayValue] = useState(null)
	const [showValueInButton, setShowValueInButton] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [isClaimLoading, setIsClaimLoading] = useState(false)
	const [isDelegating, setIsDelegating] = useState(false)
	const [showProposalForm, setShowProposalForm] = useState(false)
	const [showProposalList, setShowProposalList] = useState(false)
	const [hasClaimedTokens, setHasClaimedTokens] = useState(false)
	const [hasVotingPower, setHasVotingPower] = useState(false)
	const [isCanceling, setIsCanceling] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const [showError, setShowError] = useState(false)
	const [showCancelTooltip, setShowCancelTooltip] = useState(false)
	const [cancelTooltipText, setCancelTooltipText] = useState('')

	const { address } = useAccount()
	const { proposals, errors, governorAddress, tokenAddress, boxAddress, refetchVotingPower, refetchEligibleVoters } = useProposalContext()


	// Get the latest proposal, assuming proposals are sorted by block number
	const latestProposal = proposals.length > 0 ? proposals[0] : null

	// Contract reads
	const { data, refetch } = useReadContract({
		address: boxAddress,
		abi: Box.abi,
		functionName: 'retrieve',
		enabled: false,
	})

	// Check if the user has already claimed tokens
	const { data: hasClaimedData, refetch: refetchClaimedData } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 's_claimedTokens',
		args: [address],
		enabled: !!tokenAddress && !!address,
	})

	// Check if user has voting power
	const { data: votingPowerData } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getVotes',
		args: [address],
		enabled: !!tokenAddress && !!address,
	})

	// Update claim status on successful data fetch or explicit action
	useEffect(() => {
		if (hasClaimedData !== undefined) {
			setHasClaimedTokens(hasClaimedData)
		}
		if (votingPowerData !== undefined) {
			setHasVotingPower(votingPowerData > 0)
		}
	}, [hasClaimedData, votingPowerData])

	// Contract writes with error handling
	const { writeContract: writeClaim, data: claimTxHash, isPending, error: writeError } = useWriteContract()
	const { writeContract: writeDelegation, data: delegateTxHash, isPending: isDelegatePending, error: delegateError } = useWriteContract()
	const { writeContract: cancelProposal, data: cancelTxHash, isPending: isCancelPending, error: cancelError } = useWriteContract()

	// Track transaction status
	const { isLoading: isTxLoading, isSuccess: isTxSuccess, error: txError } =
		useWaitForTransactionReceipt({
			hash: claimTxHash,
			enabled: !!claimTxHash,
		})

	const { isLoading: isDelegateTxLoading, isSuccess: isDelegateTxSuccess, error: delegateTxError } =
		useWaitForTransactionReceipt({
			hash: delegateTxHash,
			enabled: !!delegateTxHash,
		})

	const { isLoading: isCancelTxLoading, isSuccess: isCancelTxSuccess, error: cancelTxError } =
		useWaitForTransactionReceipt({
			hash: cancelTxHash,
			enabled: !!cancelTxHash,
		})

	// Combined Loading States
	const combinedClaimLoading = isClaimLoading || isPending || isTxLoading
	const combinedDelegateLoading = isDelegating || isDelegatePending || isDelegateTxLoading
	const combinedCancelLoading = isCanceling || isCancelPending || isCancelTxLoading

	// Handle errors from contract interactions
	useEffect(() => {
		// Clear error when starting new transaction
		if (isPending || isClaimLoading || isCancelPending || isCanceling) {
			setErrorMessage('')
			setShowError(false)
		}

		// Handle write contract errors
		if (writeError) {
			let message = 'Failed to claim tokens'

			if (writeError instanceof BaseError) {
				const revertedError = writeError.walk(err => err instanceof ContractFunctionRevertedError)
				if (revertedError && revertedError.reason === 'Internal JSON-RPC error.') {
					console.log('revertedError:', revertedError.reason)
					message = "Already claimed tokens"
					setHasClaimedTokens(true)
				}
			} else if (writeError.message && writeError.message.includes('reverted')) {
				console.error('Unexpected error type:', writeError)
				const match = writeError.message.match(/reverted with reason string '(.+)'/)
				if (match && match[1]) {
					message = match[1]
				}
			} else {
				console.error('Unexpected error type:', writeError)
				message = 'An unknown error occurred'
			}

			setErrorMessage(message)
			setShowError(true)
			setIsClaimLoading(false)
		}

		// Handle delegation errors
		if (delegateError) {
			console.error('Delegation error:', delegateError)
			setErrorMessage('Failed to delegate voting power')
			setShowError(true)
			setIsDelegating(false)
		}

		// Handle cancel proposal errors
		if (cancelError) {
			console.error('Cancel proposal error:', cancelError)
			setErrorMessage('Failed to cancel proposal')
			setShowError(true)
			setIsCanceling(false)
		}

		// Handle transaction errors
		if (txError) {
			console.error('Transaction error:', txError)
			setErrorMessage('Transaction failed')
			setShowError(true)
			setIsClaimLoading(false)
		}
		if (delegateTxError) {
			console.error('Delegation transaction error:', delegateTxError)
			setErrorMessage('Delegation transaction failed')
			setShowError(true)
			setIsDelegating(false)
		}
		if (cancelTxError) {
			console.error('Cancel transaction error:', cancelTxError)
			setErrorMessage('Cancel transaction failed')
			setShowError(true)
			setIsCanceling(false)
		}
	}, [writeError, txError, delegateError, delegateTxError, cancelError, cancelTxError, isPending, isClaimLoading, isCancelPending, isCanceling])

	// Add token to MetaMask using wagmi/viem approach
	const addTokenToMetamask = useCallback(async () => {
		if (!tokenAddress || !window.ethereum) return

		try {
			const wasAdded = await window.ethereum.request({
				method: 'wallet_watchAsset',
				params: {
					type: 'ERC20',
					options: {
						address: tokenAddress,
						symbol: 'MTK',
						decimals: 18
					},
				},
			})

			if (wasAdded) {
				console.log('Token was added to MetaMask')
			}
		} catch (error) {
			console.error('Error adding token to MetaMask', error)
			setErrorMessage('Failed to add token to wallet')
			setShowError(true)
		}
	}, [tokenAddress])

	// Handle Current Value button click
	const handleGetCurrentValue = async () => {
		try {
			setIsLoading(true)
			setErrorMessage('')
			setShowError(false)

			await refetch()
			const valueStr = data ? data.toString() : '0'
			setDisplayValue(valueStr)
			setShowValueInButton(!showValueInButton)
		} catch (error) {
			console.error('Error fetching current value:', error)
			setErrorMessage('Failed to fetch current value')
			setShowError(true)
		} finally {
			setIsLoading(false)
		}
	}

	// Delegate voting power to self
	const delegateVotingPower = useCallback(async () => {
		if (!tokenAddress || !address) {
			setErrorMessage('Address not set')
			setShowError(true)
			return
		}

		try {
			setIsDelegating(true)
			setErrorMessage('')
			setShowError(false)

			writeDelegation({
				address: tokenAddress,
				abi: GovernanceToken.abi,
				functionName: 'delegate',
				args: [address], // Delegate to self
			})
		} catch (error) {
			console.error('Error delegating tokens:', error)
			setIsDelegating(false)
			setErrorMessage('Error delegating tokens')
			setShowError(true)
		}
	}, [tokenAddress, address, writeDelegation])

	// Handle Get Funds button click
	const handleGetFunds = async () => {
		if (!tokenAddress) {
			setErrorMessage('Token address not set')
			setShowError(true)
			return
		}

		try {
			setIsClaimLoading(true)
			setErrorMessage('')
			setShowError(false)


			writeClaim({
				address: tokenAddress,
				abi: GovernanceToken.abi,
				functionName: 'claimTokens',
			})
		} catch (error) {
			console.error('Error claiming tokens:', error)
			setIsClaimLoading(false)
			setErrorMessage('Error claiming tokens:', error)
			setShowError(true)
		}
	}

	// Handle Cancel Proposal button click
	const handleCancelProposal = async () => {
		if (!governorAddress || !latestProposal) {
			setErrorMessage('No proposal to cancel')
			setShowError(true)
			return
		}

		try {
			setIsCanceling(true)
			setErrorMessage('')
			setShowError(false)

			// Convert calldatas to an array if it's a string
			const calldata = Array.isArray(latestProposal.calldatas)
				? latestProposal.calldatas
				: [latestProposal.calldatas] // Wrap in array if it's a string

			cancelProposal({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'cancel',
				args: [
					latestProposal.targets,
					latestProposal.values,
					calldata,
					latestProposal.descriptionHash
				],
			})
		} catch (error) {
			console.error('Error canceling proposal:', error)
			setIsCanceling(false)
			setErrorMessage('Error canceling proposal')
			setShowError(true)
		}
	}

	const canPropose = latestProposal === null ||
		![0, 1, 4, 5].includes(latestProposal.state)

	// Handle Propose button click
	const handlePropose = () => {
		if (canPropose) {
			setShowProposalForm(true)
		}
	}

	// Close error message
	const closeError = () => {
		setShowError(false)
	}

	// Effect to handle successful transaction
	useEffect(() => {
		if (isTxSuccess) {
			setIsClaimLoading(false)
			setHasClaimedTokens(true)
			// Prompt to add token to MetaMask after successful claim
			addTokenToMetamask()			
			// Automatically trigger delegation after successful claim
			//delegateVotingPower()
			refetchClaimedData()
			refetchEligibleVoters?.()
			
		}
	}, [isTxSuccess, addTokenToMetamask, delegateVotingPower, refetchClaimedData, refetchEligibleVoters])

	// Effect to handle successful delegation
	useEffect(() => {
		if (isDelegateTxSuccess) {
			setIsDelegating(false)
			setHasVotingPower(true)
			refetchVotingPower?.()

		}
	}, [isDelegateTxSuccess, refetchVotingPower])

	// Effect to handle successful cancel
	useEffect(() => {
		if (isCancelTxSuccess) {
			setIsCanceling(false)
		}
	}, [isCancelTxSuccess])

	// Determine button text states
	const valueButtonText = isLoading ? 'LOADING...' :
		(showValueInButton && displayValue !== null) ?
			`Value: ${displayValue}` : 'CURRENT VALUE'

	const fundButtonText = combinedClaimLoading ?
		'CLAIMING...' : hasClaimedTokens ? 'ALREADY CLAIMED' : 'GET FUNDS'
	const delegateButtonText = combinedDelegateLoading ?
		'DELEGATING...' : hasVotingPower ? 'VOTING POWER ACTIVE' : 'ACTIVATE VOTING'
	const cancelButtonText = combinedCancelLoading ?
		'CANCELING...' : 'CANCEL PROPOSAL'

	// Determine if the cancel button should be enabled
	const canCancelProposal = latestProposal !== null && latestProposal.state === 0 // 0 is Pending

	const toggleProposalList = () => {
		setShowProposalList(!showProposalList)
	}

	const proposalStateNames = useMemo(() => ({
		0: 'Pending',
		1: 'Active',
		2: 'Canceled',
		3: 'Defeated',
		4: 'Succeeded',
		5: 'Queued',
		6: 'Expired',
		7: 'Executed'
	}), [])

	// Effect to set the tooltip text for the cancel button
	useEffect(() => {
		if (!canCancelProposal) {
			if (!latestProposal) {
				setCancelTooltipText('No proposal available to cancel.')
			} else if (latestProposal.state !== 0) { // Ensure it must be Pending (state 0)
				const stateName = proposalStateNames[latestProposal.state] || `State ${latestProposal.state}`
				setCancelTooltipText(`Proposal cannot be canceled (Status: ${stateName}). Must be Pending.`)
			} else {				
				setCancelTooltipText('Cancellation not possible currently.')
			}
		} else if (combinedCancelLoading) {
			setCancelTooltipText('Cancellation transaction in progress...')
		}
		else {
			// Default text when cancellation is possible and not loading
			setCancelTooltipText('Cancel the latest pending proposal.')
		}		
	}, [canCancelProposal, latestProposal, combinedCancelLoading, proposalStateNames])

	return (
		<>
			<div className="flex flex-col items-center w-full">
				{/* Transaction Error Alert */}
				{showError && (
					<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded relative w-full max-w-lg">
						<strong className="font-bold">Error: </strong>
						<span className="block sm:inline">{errorMessage}</span>
						<span
							className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer"
							onClick={closeError}
						>
							<span className="text-red-500">×</span>
						</span>
					</div>
				)}

				{/* Proposal Error Alert */}
				{errors?.proposals && (
					<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded relative w-full max-w-lg">
						<strong className="font-bold">Proposal Error: </strong>
						<span className="block sm:inline">{errors.proposals}</span>
						<br />
						<span className="block sm:inline"> Please, refresh the page</span>

					</div>
				)}

				{/* Action Buttons */}
				<div className="bg-gradient-to-b from-slate-100 to-slate-300 p-4 mt-2 flex flex-col justify-center items-center gap-4 rounded-lg shadow-md w-full max-w-4xl">
					<div className="flex justify-center items-center gap-4">
					<button
						onClick={handleGetCurrentValue}
						disabled={isLoading}
							className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded shadow-md transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
					>
						{valueButtonText}
					</button>
					<button
						onClick={handleGetFunds}
						disabled={combinedClaimLoading || hasClaimedTokens}
						className={`text-white font-medium px-4 py-2 rounded shadow-md transition duration-150 ease-in-out ${hasClaimedTokens ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
              disabled:opacity-60 disabled:cursor-not-allowed shrink-0`}
					>
						{fundButtonText}
					</button>
						{hasClaimedTokens && (
							<button
								onClick={delegateVotingPower}
								disabled={combinedDelegateLoading || hasVotingPower}
								className={`text-white font-medium px-4 py-2 rounded shadow-md transition duration-150 ease-in-out ${hasVotingPower ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
									} disabled:opacity-60 disabled:cursor-not-allowed shrink-0`}
							>
								{delegateButtonText}
							</button>
						)}

					<button
						onClick={handlePropose}
						disabled={!canPropose}
						className={`text-white font-medium px-4 py-2 rounded shadow-md transition duration-150 ease-in-out ${canPropose ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 cursor-not-allowed'}
              disabled:opacity-60 disabled:cursor-not-allowed shrink-0`}
					>
						PROPOSE
					</button>
					{/* Wrapper for Cancel Button and Tooltip */}
						<div className="relative inline-block shrink-0"						
						onMouseEnter={() => setShowCancelTooltip(true)}
						onMouseLeave={() => setShowCancelTooltip(false)}>
						<button
							onClick={handleCancelProposal}
							disabled={!canCancelProposal || combinedCancelLoading}
							className={`text-white font-medium px-4 py-2 rounded shadow-md transition duration-150 ease-in-out ${canCancelProposal
								? 'bg-red-600 hover:bg-red-700'
								: 'bg-gray-500 cursor-not-allowed'
								} disabled:opacity-60 disabled:cursor-not-allowed`}

						>
							{cancelButtonText}
						</button>

						{/* Conditionally Rendered Tooltip */}
						{showCancelTooltip && (
							<div className="absolute z-10 w-58 p-2 mt-2 text-sm text-white bg-gray-800 rounded-md shadow-lg left-1/2 transform -translate-x-1/2 top-full"
								role="tooltip"
							>
								<p>{cancelTooltipText}</p>
							</div>
						)}
					</div>
					</div>
					<div className="flex justify-center items-center">
					<button
						onClick={toggleProposalList}
						className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded shadow-md transition duration-150 ease-in-out"
					>
						{showProposalList ? 'Hide Proposals' : 'View Proposals'}
					</button>
					</div>
					{/* Proposal Form Modal */}
					{showProposalForm && (
						<ProposalForm
							onClose={() => setShowProposalForm(false)}
						/>
					)}
				</div>
			</div>
			{
				showProposalList && (
					<div className="mt-8">
						<ProposalList />
					</div>
				)
			}
		</>
	)
}

export default ActionButtons