import { useState, useCallback } from 'react'
import PropTypes from 'prop-types'
import { ErrorContext } from '../hooks/useErrorContext'

export function ErrorProvider({ children }) {
	const [errors, setErrors] = useState({})

	const setError = useCallback((key, message) => {
		setErrors((prev) => ({
			...prev,
			[key]: message,
		}))
	}, [])

	const clearError = useCallback((key) => {
		setErrors((prev) => {
			const newErrors = { ...prev }
			delete newErrors[key]
			return newErrors
		})
	}, [])

	return (
		<ErrorContext.Provider value={{ errors, setError, clearError }}>
			{children}
		</ErrorContext.Provider>
	)
}

ErrorProvider.propTypes = {
	children: PropTypes.node.isRequired,
}