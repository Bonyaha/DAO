import { useConnect } from 'wagmi'

export function WalletOptions() {
	const { connectors, connect } = useConnect()

	return (
		<div className="space-y-3 w-full">
			{connectors.map((connector) => (
				<button
					key={connector.id}
					onClick={() => connect({ connector })}
					className="bg-fuchsia-600 hover:bg-fuchsia-800 text-white font-medium px-6 py-3 rounded-lg w-full"
				>
					{connector.name}
				</button>
			))}
		</div>
	)
}