const { ethers } = require("hardhat")

async function main() {
	const governanceTokenAddress = process.env.TOKEN_ADDRESS
	const delegateAddress = process.env.DELEGATE_ADDRESS

	if (!governanceTokenAddress) {
		throw new Error("Please set TOKEN_ADDRESS environment variable")
	}

	if (!delegateAddress) {
		throw new Error("Please set DELEGATE_ADDRESS environment variable")
	}

	const governanceToken = await ethers.getContractAt("GovernanceToken", governanceTokenAddress)

	// Delegate votes
	const delegateTx = await governanceToken.delegate(delegateAddress)
	await delegateTx.wait()

	console.log(`Successfully delegated voting power to ${delegateAddress}`)

	// Check voting power
	const votingPower = await governanceToken.getVotes(delegateAddress)
	console.log(`Current voting power of ${delegateAddress}: ${ethers.formatEther(votingPower)}`)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})