import { useEffect, useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { BaseError, ContractFunctionRevertedError } from 'viem'
import Box from '../artifacts/contracts/Box.sol/Box.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'
import ProposalForm from './ProposalForm';

function ActionButtons() {
	const [displayValue, setDisplayValue] = useState(null)
	const [showValueInButton, setShowValueInButton] = useState(false)
	const [boxAddress, setBoxAddress] = useState('')
	const [tokenAddress, setTokenAddress] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isClaimLoading, setIsClaimLoading] = useState(false)
	const [, setCurrentNetwork] = useState('')
	const [errorMessage, setErrorMessage] = useState('')
	const [showError, setShowError] = useState(false)
	const [showProposalForm, setShowProposalForm] = useState(false);

	const { chain } = useAccount()

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

	// Contract writes with error handling
	const { writeContract, data: claimTxHash, isPending, error: writeError } = useWriteContract()

	// Track transaction status
	const { isLoading: isTxLoading, isSuccess: isTxSuccess, error: txError } =
		useWaitForTransactionReceipt({
			hash: claimTxHash,
			enabled: !!claimTxHash,
		})

	// Handle errors from contract interactions
	useEffect(() => {
		// Clear error when starting new transaction
		if (isPending || isClaimLoading) {
			setErrorMessage('')
			setShowError(false)
		}

		// Handle write contract errors
		if (writeError) {
			//console.error('Write contract error:', writeError)
			let message = 'Failed to claim tokens'

			// Check if writeError is a BaseError and extract the revert reason
			if (writeError instanceof BaseError) {
				const revertedError = writeError.walk(err => err instanceof ContractFunctionRevertedError)
				if (revertedError && revertedError.reason === 'Internal JSON-RPC error.') {
					console.log('revertedError:', revertedError.reason)
					message = "Already claimed tokens"
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

		// Handle transaction errors
		if (txError) {
			console.error('Transaction error:', txError)
			setErrorMessage('Transaction failed')
			setShowError(true)
			setIsClaimLoading(false)
		}
	}, [writeError, txError, isPending, isClaimLoading])

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
						decimals: 18,
						// Optional: Add your token image if you have one
						// image: 'https://yourwebsite.com/token-logo.png',
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
			setErrorMessage('Failed MTF')
			setShowError(true)
		}
	}

	// Handle Propose button click
	const handlePropose = () => {
		setShowProposalForm(true)
	}

	// Handle proposal success
	const handleProposalSuccess = () => {
		// You can refresh proposals or show a success message
		console.log('Proposal submitted successfully!')
	};

	// Close error message
	const closeError = () => {
		setShowError(false)
	}

	// Effect to handle successful transaction
	useEffect(() => {
		if (isTxSuccess) {
			setIsClaimLoading(false)
			// Prompt to add token to MetaMask after successful claim
			addTokenToMetamask()
		}
	}, [isTxSuccess, addTokenToMetamask])

	// Determine button text states
	const valueButtonText = isLoading ? 'LOADING...' :
		(showValueInButton && displayValue !== null) ?
			`Value: ${displayValue}` : 'CURRENT VALUE'

	const fundButtonText = isClaimLoading || isPending || isTxLoading ?
		'CLAIMING...' : 'GET FUNDS'

	return (
		<div className="flex flex-col items-center">
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
					disabled={isClaimLoading || isPending || isTxLoading}
					className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow disabled:opacity-50"
				>
					{fundButtonText}
				</button>
				<button
					onClick={addTokenToMetamask}
					className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow ml-2"
				>
					ADD TOKEN TO WALLET
				</button>
				<button
					onClick={handlePropose}
					className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
				>
					PROPOSE
				</button>
				<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
					VOTE
				</button>
				<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
					EXECUTE
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
	)
}

export default ActionButtons