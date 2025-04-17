import { createContext, useContext } from 'react'

export const ErrorContext = createContext()

export function useErrorContext() {
	const context = useContext(ErrorContext)
	if (!context) {
		throw new Error('useErrorContext must be used within an ErrorProvider')
	}
	return context
}