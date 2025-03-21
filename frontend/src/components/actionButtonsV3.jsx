import { useEffect, useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { BaseError, ContractFunctionRevertedError } from 'viem'

import Box from '../artifacts/contracts/Box.sol/Box.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import addresses from '../addresses.json'
import ProposalForm from './ProposalForm'
import ProposalList from './lists'

function ActionButtons() {
	const [displayValue, setDisplayValue] = useState(null)
	const [showValueInButton, setShowValueInButton] = useState(false)
	const [boxAddress, setBoxAddress] = useState('')
	const [tokenAddress, setTokenAddress] = useState('')
	const [governorAddress, setGovernorAddress] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isClaimLoading, setIsClaimLoading] = useState(false)
	const [isDelegating, setIsDelegating] = useState(false)
	const [, setCurrentNetwork] = useState('')
	const [errorMessage, setErrorMessage] = useState('')
	const [showError, setShowError] = useState(false)
	const [showProposalForm, setShowProposalForm] = useState(false)
	const [showProposalList, setShowProposalList] = useState(false)
	const [hasClaimedTokens, setHasClaimedTokens] = useState(false)
	const [hasVotingPower, setHasVotingPower] = useState(false)
	const [latestProposal, setLatestProposal] = useState(null)
	const [isCanceling, setIsCanceling] = useState(false)

	const { chain, address } = useAccount()
	//const publicClient = usePublicClient()

	// Initialize network and contract addresses using Wagmi
	useEffect(() => {
		const initializeNetwork = async () => {
			if (!chain) {
				console.error('No chain detected')
				return
			}
			const network = chain.id === 31337 ? 'localhost' : chain.name.toLowerCase()
			setCurrentNetwork(network)

			if (addresses[network]) {
				setBoxAddress(addresses[network].box.address)
				setTokenAddress(addresses[network].governanceToken.address)
				setGovernorAddress(addresses[network].governor.address)
			} else {
				console.error(`Network ${network} not found in addresses.json`)
			}
		}
		initializeNetwork()
	}, [chain])

	// Contract reads
	const { data, refetch } = useReadContract({
		address: boxAddress,
		abi: Box.abi,
		functionName: 'retrieve',
		enabled: false,
	})

	// Check if the user has already claimed tokens using s_claimedTokens mapping
	const { data: hasClaimedData, refetch: refetchHasClaimed } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 's_claimedTokens',
		args: [address],
		enabled: !!tokenAddress && !!address,
	})

	// Check if user has voting power
	const { data: votingPowerData, refetch: refetchVotingPower } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getVotes',
		args: [address],
		enabled: !!tokenAddress && !!address,
	})

	// Fetch the latest proposal


	/* 	// Fetch latest proposal when governor address is set
		useEffect(() => {
			if (governorAddress && publicClient) {
				fetchLatestProposal()
			}
		}, [governorAddress, publicClient, fetchLatestProposal]) */



	// Update claim status whenever address or token address changes
	useEffect(() => {
		if (tokenAddress && address) {
			refetchHasClaimed().then(() => {
				if (hasClaimedData !== undefined) {
					setHasClaimedTokens(hasClaimedData)
				}
			})
			refetchVotingPower().then(() => {
				if (votingPowerData !== undefined) {
					setHasVotingPower(votingPowerData > 0)
				}
			})
		}
	}, [tokenAddress, address, hasClaimedData, refetchHasClaimed, votingPowerData, refetchVotingPower])

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
			setErrorMessage('')
			setShowError(false)
		}

		// Handle write contract errors
		if (writeError) {
			let message = 'Failed to claim tokens'

			// Check if writeError is a BaseError and extract the revert reason
			if (writeError instanceof BaseError) {
				const revertedError = writeError.walk(err => err instanceof ContractFunctionRevertedError)
				if (revertedError && revertedError.reason === 'Internal JSON-RPC error.') {
					console.log('revertedError:', revertedError.reason)
					message = "Already claimed tokens"
					setHasClaimedTokens(true)
				}
			} else if (writeError.message && writeError.message.includes('reverted')) {
				// Fallback to regex if not a BaseError
				console.error('Unexpected error type:', writeError)
				const match = writeError.message.match(/reverted with reason string '(.+)'/)
				if (match && match[1]) {
					message = match[1]
				}
			} else {
				// Fallback for unexpected error types
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
	}, [tokenAddress, address, writeDelegation, setErrorMessage, setShowError, setIsDelegating]);

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

			writeContract({
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

	// Handle Propose button click
	const handlePropose = () => {
		setShowProposalForm(true)
	}

	// Handle proposal success
	const handleProposalSuccess = (newProposal) => {
		console.log('Proposal submitted successfully!', newProposal)
		setLatestProposal(newProposal)

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
			delegateVotingPower()
		}
	}, [isTxSuccess, addTokenToMetamask, delegateVotingPower])

	// Effect to handle successful delegation
	useEffect(() => {
		if (isDelegateTxSuccess) {
			setIsDelegating(false)
			setHasVotingPower(true)
			refetchVotingPower()
		}
	}, [isDelegateTxSuccess, refetchVotingPower])

	// Effect to handle successful cancel
	useEffect(() => {
		//console.log("isCancelTxSuccess", isCancelTxSuccess);

		if (isCancelTxSuccess) {
			setIsCanceling(false)
			setLatestProposal(null)
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
				{/* Error Alert */}
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
						className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
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
							onSuccess={handleProposalSuccess}
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