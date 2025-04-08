import { useEffect, useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { BaseError, ContractFunctionRevertedError } from 'viem'

import Box from '../artifacts/contracts/Box.sol/Box.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import ProposalForm from './ProposalForm'
import ProposalList from './ProposalList'
import { useProposalContext } from './hooks/useProposalContext'
import { useErrorContext } from './hooks/useErrorContext'

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

	const { address } = useAccount()
	const { proposals, governorAddress, tokenAddress, boxAddress } = useProposalContext()
	const { setError, clearError } = useErrorContext()

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
	const { data: hasClaimedData } = useReadContract({
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
	const { writeContract, data: claimTxHash, isPending, error: writeError } = useWriteContract()
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

	// Handle errors from contract interactions
	useEffect(() => {
		// Clear error when starting new transaction
		if (isPending || isClaimLoading || isCancelPending || isCanceling) {
			clearError('actionButtons')
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

			setError('actionButtons', message)
			setIsClaimLoading(false)
		}

		// Handle delegation errors
		if (delegateError) {
			console.error('Delegation error:', delegateError)
			setError('actionButtons', 'Failed to delegate voting power')
			setIsDelegating(false)
		}

		// Handle cancel proposal errors
		if (cancelError) {
			console.error('Cancel proposal error:', cancelError)
			setError('actionButtons', 'Failed to cancel proposal')
			setIsCanceling(false)
		}

		// Handle transaction errors
		if (txError) {
			console.error('Transaction error:', txError)
			setError('actionButtons', 'Transaction failed')
			setIsClaimLoading(false)
		}
		if (delegateTxError) {
			console.error('Delegation transaction error:', delegateTxError)
			setError('actionButtons', 'Delegation transaction failed')
			setIsDelegating(false)
		}
		if (cancelTxError) {
			console.error('Cancel transaction error:', cancelTxError)
			setError('actionButtons', 'Cancel transaction failed')
			setIsCanceling(false)
		}
	}, [writeError, txError, delegateError, delegateTxError, cancelError, cancelTxError, isPending, isClaimLoading, isCancelPending, isCanceling, setError, clearError])

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
			setError('actionButtons', 'Failed to add token to wallet')
		}
	}, [tokenAddress, setError])

	// Handle Current Value button click
	const handleGetCurrentValue = async () => {
		try {
			setIsLoading(true)
			clearError('actionButtons')
			await refetch()
			const valueStr = data ? data.toString() : '0'
			setDisplayValue(valueStr)
			setShowValueInButton(!showValueInButton)
		} catch (error) {
			console.error('Error fetching current value:', error)
			setError('actionButtons', 'Failed to fetch current value')
		} finally {
			setIsLoading(false)
		}
	}

	// Delegate voting power to self
	const delegateVotingPower = useCallback(async () => {
		if (!tokenAddress || !address) {
			setError('actionButtons', 'Address not set')
			return
		}

		try {
			setIsDelegating(true)
			clearError('actionButtons')

			writeDelegation({
				address: tokenAddress,
				abi: GovernanceToken.abi,
				functionName: 'delegate',
				args: [address], // Delegate to self
			})
		} catch (error) {
			console.error('Error delegating tokens:', error)
			setIsDelegating(false)
			setError('actionButtons', 'Error delegating tokens')
		}
	}, [tokenAddress, address, writeDelegation, setError, clearError])

	// Handle Get Funds button click
	const handleGetFunds = async () => {
		if (!tokenAddress) {
			setError('actionButtons', 'Token address not set')
			return
		}

		try {
			setIsClaimLoading(true)
			clearError('actionButtons')
			
			writeContract({
				address: tokenAddress,
				abi: GovernanceToken.abi,
				functionName: 'claimTokens',
			})
		} catch (error) {
			console.error('Error claiming tokens:', error)
			setIsClaimLoading(false)
			setError('actionButtons', 'Error claiming tokens')
		}
	}

	// Handle Cancel Proposal button click
	const handleCancelProposal = async () => {
		if (!governorAddress || !latestProposal) {
			setError('actionButtons', 'No proposal to cancel')
			return
		}

		try {
			setIsCanceling(true)
			clearError('actionButtons')

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
			setError('actionButtons', 'Error canceling proposal')
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

	// Effect to handle successful transaction
	useEffect(() => {
		if (isTxSuccess) {
			setIsClaimLoading(false)
			setHasClaimedTokens(true)
			// Prompt to add token to MetaMask after successful claim
			addTokenToMetamask()
			// Automatically trigger delegation after successful claim
			delegateVotingPower()
		}
	}, [isTxSuccess, addTokenToMetamask, delegateVotingPower])

	// Effect to handle successful delegation
	useEffect(() => {
		if (isDelegateTxSuccess) {
			setIsDelegating(false)
			setHasVotingPower(true)
		}
	}, [isDelegateTxSuccess])

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

	const fundButtonText = isClaimLoading || isPending || isTxLoading ?
		'CLAIMING...' : hasClaimedTokens ? 'ALREADY CLAIMED' : 'GET FUNDS'
	const delegateButtonText = isDelegating || isDelegatePending || isDelegateTxLoading ?
		'DELEGATING...' : hasVotingPower ? 'VOTING POWER ACTIVE' : 'ACTIVATE VOTING'
	const cancelButtonText = isCanceling || isCancelPending || isCancelTxLoading ?
		'CANCELING...' : 'CANCEL PROPOSAL'

	// Determine if the cancel button should be enabled
	const canCancelProposal = latestProposal !== null && latestProposal.state === 0 // 0 is Pending

	const toggleProposalList = () => {
		setShowProposalList(!showProposalList)
	}

	return (
		<>
			<div className="flex flex-col items-center w-full">				
				{/* Action Buttons */}
				<div className="bg-blue-500 p-4 mt-2 flex flex-wrap justify-center space-x-4 rounded-lg">
					<button
						onClick={handleGetCurrentValue}
						disabled={isLoading}
						className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow disabled:opacity-50"
					>
						{valueButtonText}
					</button>
					<button
						onClick={handleGetFunds}
						disabled={isClaimLoading || isPending || isTxLoading || hasClaimedTokens}
						className={`${hasClaimedTokens ? 'bg-gray-500' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded shadow disabled:opacity-50`}
					>
						{fundButtonText}
					</button>
					<button
						onClick={delegateVotingPower}
						disabled={isDelegating || isDelegatePending || isDelegateTxLoading || hasVotingPower || !hasClaimedTokens}
						className={`${hasVotingPower ? 'bg-gray-500' : !hasClaimedTokens ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white px-4 py-2 rounded shadow disabled:opacity-50`}
					>
						{delegateButtonText}
					</button>

					<button
						onClick={handlePropose}
						disabled={!canPropose}
						className={`${canPropose ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500'} text-white px-4 py-2 rounded shadow disabled:opacity-50`}
						title={!canPropose ? 'A proposal is already in progress' : ''}
					>
						PROPOSE
					</button>
					<button
						onClick={handleCancelProposal}
						disabled={!canCancelProposal || isCanceling || isCancelPending || isCancelTxLoading}
						className={`${canCancelProposal ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-500'} text-white px-4 py-2 rounded shadow disabled:opacity-50`}
						title={!canCancelProposal ? 'No pending proposal to cancel' : ''}
					>
						{cancelButtonText}
					</button>
					<button
						onClick={toggleProposalList}
						className="bg-purple-500 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
					>
						{showProposalList ? 'Hide Proposals' : 'View Proposals'}
					</button>

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