import { createContext, useContext } from 'react'

export const TimingContext = createContext(null)

export function useTiming() {
	const context = useContext(TimingContext)
	if (!context) {
		throw new Error('useTiming must be used within a TimingProvider')
	}
	return context
}