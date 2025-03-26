import { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { usePublicClient } from 'wagmi'
import { TimingContext } from './hooks/useTiming'

export function TimingProvider({ children }) {
	const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))
	const publicClient = usePublicClient()

	const updateCurrentTime = useCallback(async () => {
		try {
			const block = await publicClient.getBlock()
			setCurrentTime(Number(block.timestamp))
		} catch (error) {
			console.error('Error fetching block timestamp:', error)
		}
	},[publicClient])

	// Update the c	urrent time every second
	useEffect(() => {
		if (!publicClient) return
		updateCurrentTime()
		const interval = setInterval(updateCurrentTime, 1000)
		return () => clearInterval(interval)
	}, [updateCurrentTime, publicClient])

	// Function to check if a proposal can be executed
	const canExecuteProposal = (eta) => {
		return eta > 0 && currentTime >= eta
	}

	return (
		<TimingContext.Provider value={{ currentTime, canExecuteProposal }}>
			{children}
		</TimingContext.Provider>
	)
}

TimingProvider.propTypes = {
	children: PropTypes.node.isRequired
}