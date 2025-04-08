import { useErrorContext } from './hooks/useErrorContext'

export function ErrorDisplay() {
	const { errors, clearError } = useErrorContext()

	if (!Object.values(errors).some((error) => error)) {
		return null
	}


	return (
		<div className="fixed top-4 right-4 space-y-2 z-50">
			{Object.entries(errors).map(([key, message]) => (
				message && (
					<div
						key={key}
						className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between items-center"
						role="alert"
					>
						<p>{message}</p>
						<button
							onClick={() => clearError(key)}
							className="text-red-700 hover:text-red-900"
						>
							✕
						</button>
					</div>
				)
			))}
		</div>
	)
}