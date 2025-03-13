import { useEffect, useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi'
import Box from '../artifacts/contracts/Box.sol/Box.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'

function ActionButtons() {
	const [displayValue, setDisplayValue] = useState(null)
	const [showValueInButton, setShowValueInButton] = useState(false)
	const [boxAddress, setBoxAddress] = useState('')
	const [tokenAddress, setTokenAddress] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isClaimLoading, setIsClaimLoading] = useState(false)
	const [showProposalList, setShowProposalList] = useState(false)
	const [, setCurrentNetwork] = useState('')

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

	// Contract writes
	const { writeContract, data: claimTxHash, isPending } = useWriteContract()

	// Track transaction status
	const { isLoading: isTxLoading, isSuccess: isTxSuccess } =
		useWaitForTransactionReceipt({
			hash: claimTxHash,
			enabled: !!claimTxHash,
		})

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
		}
	}, [tokenAddress])

	// Handle Current Value button click
	const handleGetCurrentValue = async () => {
		try {
			setIsLoading(true)
			await refetch()
			const valueStr = data ? data.toString() : '0'
			setDisplayValue(valueStr)
			setShowValueInButton(!showValueInButton)
		} catch (error) {
			console.error('Error fetching current value:', error)
		} finally {
			setIsLoading(false)
		}
	}

	// Handle Get Funds button click
	const handleGetFunds = async () => {
		if (!tokenAddress) {
			console.error('Token address not set')
			return
		}

		try {
			setIsClaimLoading(true)
			writeContract({
				address: tokenAddress,
				abi: GovernanceToken.abi,
				functionName: 'claimTokens',
			})
		} catch (error) {
			console.error('Error claiming tokens:', error)
			setIsClaimLoading(false)
		}
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

	const toggleProposalList = () => {
		setShowProposalList(!showProposalList)
	};


	return (
		<div className="bg-blue-500 p-4 mt-8 flex flex-wrap justify-center space-x-4 rounded-lg">
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
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				PROPOSE
			</button>
			<button
				onClick={toggleProposalList}
				className="bg-purple-500 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200"
			>
				{showProposalList ? 'Hide Proposals' : 'View Proposals'}
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				EXECUTE
			</button>
		</div>
	)
}

export default ActionButtons