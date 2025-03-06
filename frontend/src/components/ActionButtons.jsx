import { useEffect, useState } from 'react'
import { useReadContract, useAccount} from 'wagmi'
import Box from '../artifacts/contracts/Box.sol/Box.json'
import addresses from '../addresses.json'

function ActionButtons() {
	const [displayValue, setDisplayValue] = useState(null)
	const [showValueInButton, setShowValueInButton] = useState(false)
	const [boxAddress, setBoxAddress] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const { chain } = useAccount()

	// Initialize network and contract addresses using Wagmi
	useEffect(() => {
		const initializeNetwork = async () => {
			if (!chain) {
				console.error('No chain detected')
				return
			}
			const currentNetwork = chain.id === 31337 ? 'localhost' : chain.name.toLowerCase()
			if (addresses[currentNetwork]) {
				setBoxAddress(addresses[currentNetwork].box.address)
			} else {
				console.error(`Network ${currentNetwork} not found in addresses.json`)
			}
		}
		initializeNetwork()
	}, [chain])

	const { data, refetch } = useReadContract({
		address: boxAddress,
		abi: Box.abi,
		functionName: 'retrieve',
		enabled: false,
	})

	// Handle button click
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

	// Determine the text to show on the value button
	const valueButtonText = isLoading ? 'LOADING...' :
		(showValueInButton && displayValue !== null) ?
			`Value: ${displayValue}` : 'CURRENT VALUE'

	return (
		<div className="bg-blue-500 p-4 mt-8 flex flex-wrap justify-center space-x-4 rounded-lg">
			<button
				onClick={handleGetCurrentValue}
				disabled={isLoading}
				className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow disabled:opacity-50"
			>
				{valueButtonText}
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				GET FUNDS
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				PROPOSE
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				VOTE
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				EXECUTE
			</button>
		</div>
	)
}

export default ActionButtons