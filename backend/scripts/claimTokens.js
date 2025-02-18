const { ethers } = require("hardhat")

async function main() {
	const governanceTokenAddress = process.env.TOKEN_ADDRESS
	if (!governanceTokenAddress) {
		throw new Error("Please set TOKEN_ADDRESS environment variable")
	}

	const governanceToken = await ethers.getContractAt("GovernanceToken", governanceTokenAddress)

	// Claim tokens
	const claimTx = await governanceToken.claimTokens()
	await claimTx.wait()

	// Get balance
	const signer = await ethers.getSigner()
	const balance = await governanceToken.balanceOf(signer.address)

	console.log(`Successfully claimed tokens. Your balance: ${ethers.formatEther(balance)} MTK`)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})