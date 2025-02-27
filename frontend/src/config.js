import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected, metaMask, safe } from 'wagmi/connectors'

// Define the custom Hardhat localhost chain
const hardhat = {
	id: 31337, // Default chain ID for Hardhat
	name: 'Hardhat',
	network: 'localhost',
	nativeCurrency: {
		name: 'Ether',
		symbol: 'ETH',
		decimals: 18,
	},
	rpcUrls: {
		default: { http: ['http://127.0.0.1:8545'] }, // Hardhat's default RPC URL
	},
}

// Create the Wagmi config with sepolia and hardhat
export const config = createConfig({
	chains: [sepolia, hardhat],
	connectors: [
		injected(),		
		metaMask(),
		safe(),
	],
	transports: {
		[sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/zVlySCLmb1_5hBMu7qthyYRwSAKQvfRW'), // Default HTTP transport for Sepolia
		[hardhat.id]: http('http://127.0.0.1:8545'), // Hardhat's RPC URL
	},
})