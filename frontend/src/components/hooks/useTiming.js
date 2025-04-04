import { useState, useEffect, useRef } from 'react'
import { useBlockNumber } from 'wagmi'

const useDebounce = (value, delay) => {
	const [debouncedValue, setDebouncedValue] = useState(value)

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value)
		}, delay)

		return () => {
			clearTimeout(handler)
		}
	}, [value, delay])

	return debouncedValue
}

const BLOCK_TIME_FALLBACKS = {
	31337: 1, // Hardhat
	11155111: 12, // Sepolia
	1: 12, // Ethereum Mainnet
}

export function useTiming({ publicClient, chain }) {
	const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))
	const [currentBlock, setCurrentBlock] = useState(0)
	const [blockTime, setBlockTime] = useState(BLOCK_TIME_FALLBACKS[chain?.id] || 12)
	const [timingError, setTimingError] = useState(null)
	const previousBlockRef = useRef(0)
	const { data: blockNumberData } = useBlockNumber({ watch: true })
	const debouncedBlockNumber = useDebounce(blockNumberData, 1000)

	// Detect block time
	useEffect(() => {
		const detectBlockTime = async () => {
			if (!publicClient) return
			setTimingError(null)
			try {
				const latestBlock = await publicClient.getBlock()
				const previousBlock = await publicClient.getBlock(latestBlock.number - 1n)
				const timeDiff = Number(latestBlock.timestamp - previousBlock.timestamp)
				setBlockTime(timeDiff > 0 ? timeDiff : BLOCK_TIME_FALLBACKS[chain?.id] || 12)
			} catch (err) {
				console.error('Error detecting block time:', err)
				setTimingError('Failed to detect block time. Using default value.')
				setBlockTime(BLOCK_TIME_FALLBACKS[chain?.id] || 12) // Fallback to default
			}
		}
		detectBlockTime()
	}, [publicClient, chain])

	// Update current block
	useEffect(() => {
		if (debouncedBlockNumber) {
			const blockNum = Number(debouncedBlockNumber)
			if (blockNum !== previousBlockRef.current) {
				previousBlockRef.current = blockNum
				setCurrentBlock(blockNum)
			}
		}
	}, [debouncedBlockNumber])

	// Update current time periodically
	useEffect(() => {
		if (!publicClient) return
		const updateTime = async () => {
			setTimingError(null)
			try {
				const block = await publicClient.getBlock()
				setCurrentTime(Number(block.timestamp))
			} catch (error) {
				console.error('Error fetching block timestamp:', error)
				setTimingError('Failed to fetch current block timestamp.')
			}
		}
		updateTime()
		const interval = setInterval(updateTime, 10000)
		return () => clearInterval(interval)
	}, [publicClient])


	return { currentTime, currentBlock, blockTime, timingError }
}