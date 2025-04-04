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

export function useTiming({ publicClient, chain }) {
	const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))
	const [currentBlock, setCurrentBlock] = useState(0)
	const [blockTime, setBlockTime] = useState(1)
	const previousBlockRef = useRef(0)
	const { data: blockNumberData } = useBlockNumber({ watch: true })
	const debouncedBlockNumber = useDebounce(blockNumberData, 1000)

	// Detect block time
	useEffect(() => {
		const detectBlockTime = async () => {
			if (!publicClient) return
			try {
				const latestBlock = await publicClient.getBlock()
				const previousBlock = await publicClient.getBlock(latestBlock.number - 1n)
				const timeDiff = Number(latestBlock.timestamp - previousBlock.timestamp)
				setBlockTime(timeDiff > 0 ? timeDiff : chain?.id === 31337 ? 1 : 12)
			} catch (error) {
				console.error('Error detecting block time:', error)
				setBlockTime(chain?.id === 31337 ? 1 : 12)
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
			try {
				const block = await publicClient.getBlock()
				setCurrentTime(Number(block.timestamp))
			} catch (error) {
				console.error('Error fetching block timestamp:', error)
			}
		}
		updateTime()
		const interval = setInterval(updateTime, 10000)
		return () => clearInterval(interval)
	}, [publicClient])


	return { currentTime, currentBlock, blockTime }
}