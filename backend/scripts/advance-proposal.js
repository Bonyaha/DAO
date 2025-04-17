const { ethers, network } = require("hardhat")
const { addresses } = require("../addresses")

/**
 * Advances a pending proposal to active state by mining blocks
 * @param {Object} options - Options for the function
 * @param {string} options.network - Network to use (defaults to hardhat network name)
 * @param {string} options.proposalId - Optional override for proposal ID
 * @returns {Promise<Object>} Result of the operation
 */
async function advanceProposal(options = {}) {
	// Get network information
	const networkName = options.network || network.name
	const isLocalNetwork = ["localhost", "hardhat"].includes(networkName)
	console.log(`Running on network: ${networkName}`)

	if (!isLocalNetwork) {
		return {
			success: false,
			message: "This script is intended for local networks only (localhost or hardhat)"
		}
	}

	// Get contract addresses from config
	const config = addresses[networkName]
	if (!config) {
		throw new Error(`Network configuration not found for ${networkName}`)
	}

	const GOVERNOR_ADDRESS = config.governor.address
	const PROPOSAL_ID = options.proposalId || config.proposalId.id
console.log(`Proposal ID: ${PROPOSAL_ID}`);

	if (!PROPOSAL_ID) {
		throw new Error("Proposal ID not found in config")
	}

	// Get contract instances
	const provider = ethers.provider
	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)

	// Check proposal state
	let state = await governor.state(PROPOSAL_ID)
	const states = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"]
	console.log(`Current proposal state: ${states[state]}`)

	// Only proceed if the proposal is in Pending state
	if (state != 0) { // 0 = Pending
		return {
			success: false,
			status: states[state],
			message: `Proposal is already in ${states[state]} state, no action needed`
		}
	}

	// Get information about the proposal
	const currentBlock = BigInt(await provider.getBlockNumber())
	const votingStarts = await governor.proposalSnapshot(PROPOSAL_ID)
	const proposalEta = await governor.proposalEta(PROPOSAL_ID)
	const latestBlock = await provider.getBlock("latest")
	const currentTimestamp = BigInt(latestBlock.timestamp)
	const blocksToWait = Number(votingStarts - currentBlock + 1n)

	console.log(`Current block: ${currentBlock}`)
	console.log(`Voting starts at block: ${votingStarts}`)
	console.log(`Blocks to wait: ${blocksToWait}`)

	if (blocksToWait <= 0) {
		return {
			success: false,
			message: "Proposal should already be active. Check if there are other issues."
		}
	}

	// Mine blocks to advance to active state
	console.log(`Mining ${blocksToWait} blocks on local network...`)
	for (let i = 0; i < blocksToWait; i++) {
		if (i % 10 === 0 && i > 0) {
			console.log(`Mined ${i}/${blocksToWait} blocks...`)
		}
		await network.provider.send("evm_mine")
	}
	console.log("Mining complete.")

	// Re-check proposal state after mining blocks
	state = await governor.state(PROPOSAL_ID)
	console.log(`New proposal state: ${states[state]}`)

	if (state == 1) { // 1 = Active
		return {
			success: true,
			status: "Active",
			message: "Successfully advanced proposal to Active state",
			proposalId: PROPOSAL_ID,
			initialBlock: currentBlock.toString(),
			finalBlock: (await provider.getBlockNumber()).toString(),
			blocksMined: blocksToWait
		}
	} else {
		return {
			success: false,
			status: states[state],
			message: `Failed to advance proposal to Active state. Current state: ${states[state]}`
		}
	}
}

// Main function for hardhat run
async function main() {
	// Get PROPOSAL_ID from environment if available
	const proposalId = process.env.PROPOSAL_ID

	const options = {}
	if (proposalId) {
		options.proposalId = proposalId
		console.log(`Using provided proposal ID: ${proposalId}`)
	}

	try {
		const result = await advanceProposal(options)
		console.log("Result:", JSON.stringify(result, null, 2))

		if (result.success) {
			console.log(`Proposal successfully advanced to Active state`)
			console.log(`Mined ${result.blocksMined} blocks`)
		} else {
			console.log(`Operation message: ${result.message}`)
		}
	} catch (error) {
		console.error("Error:", error.message)
	}
}

// Run main function if script is executed directly
if (require.main === module) {
	main()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error)
			process.exit(1)
		})
}

module.exports = { advanceProposal }