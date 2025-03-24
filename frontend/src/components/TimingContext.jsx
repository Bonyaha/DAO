import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { TimingContext } from './hooks/useTiming'

export function TimingProvider({ children }) {
	const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))

	// Update the current time every second
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(Math.floor(Date.now() / 1000))
		}, 1000)
		return () => clearInterval(interval)
	}, [])

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