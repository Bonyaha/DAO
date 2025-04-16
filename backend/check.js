const { ethers } = require("hardhat")

async function main() {
	const governanceToken = await ethers.getContractAt("GovernanceToken", "0xfDc316600193DdfA09a906d592f5a45dD37e90aC")
	const deployer = "0x9652f953a1b67E0Af4b5Daf77C6bAF10948E2932" // Replace with your deployer address
	console.log("Deployer claimed tokens:", await governanceToken.s_claimedTokens(deployer))
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1;
})