const { ethers, network } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers
const { addresses } = require("../addresses")

/**
 * Queues a succeeded proposal to prepare it for execution
 * @param {Object} options - Options for the function
 * @param {string} options.network - Network to use (defaults to hardhat network name)
 * @param {string} options.proposalId - Optional override for proposal ID
 * @returns {Promise<Object>} Result of the operation
 */
async function queueProposal(options = {}) {
	// Get network information
	const networkName = options.network || network.name
	console.log(`Running on network: ${networkName}`)

	// Get contract addresses from config
	const config = addresses[networkName]
	if (!config) {
		throw new Error(`Network configuration not found for ${networkName}`)
	}

	const GOVERNOR_ADDRESS = config.governor.address
	const BOX_ADDRESS = config.box.address
	const PROPOSAL_ID = options.proposalId || config.proposalId.id
	const PROPOSAL_VALUE = config.proposalValue.value
	const value = PROPOSAL_VALUE || 42
	const description = `test`
	if (!PROPOSAL_ID) {
		throw new Error("Proposal ID not found in config")
	}

	// Get contract instances
	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const box = await ethers.getContractAt("Box", BOX_ADDRESS)

	// Check proposal state
	let state = await governor.state(PROPOSAL_ID)
	const states = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"]
	console.log(`Current proposal state: ${states[state]}`)

	// Only proceed if the proposal is in Succeeded state
	if (state != 4 && state != 5) { // 4 = Succeeded
		return {
			success: false,
			status: states[state],
			message: `Cannot queue proposal: it is in ${states[state]} state, not in Succeeded state`
		}
	}

	try {
		// Get proposal details
		const encodedFunctionCall = box.interface.encodeFunctionData("store", [value])
		const descriptionHash = keccak256(toUtf8Bytes(description))
		console.log("Retrieved proposal data")


		// Queue the proposal
		console.log("Queueing proposal...")
		const queueTx = await governor.queue(
			[BOX_ADDRESS],
			[0],
			[encodedFunctionCall],
			descriptionHash
		)
		console.log(`Queue transaction submitted: ${queueTx.hash}`)

		const receipt = await queueTx.wait()
		console.log("Queue transaction mined:", receipt.hash)
		console.log("Proposal queued successfully!")

		// Re-check proposal state after queueing
		state = await governor.state(PROPOSAL_ID)
		console.log(`New proposal state: ${states[state]}`)

		// If proposal is in Queued state
		if (state == 5) { // 5 = Queued
			try {
				// Get the earliest execution time
				const proposalEta = await governor.proposalEta(PROPOSAL_ID) //timestamp when the proposal can be executed
				const latestBlock = await ethers.provider.getBlock('latest')
				const currentTimestamp = BigInt(latestBlock.timestamp)

				console.log(`Proposal ETA: ${new Date(Number(proposalEta) * 1000).toLocaleString()}`)
				console.log(`Current time: ${new Date(Number(currentTimestamp) * 1000).toLocaleString()}`)

				if (currentTimestamp < proposalEta) {
					const waitTime = Number(proposalEta - currentTimestamp)
					console.log(`Proposal is in timelock. Need to wait ${waitTime} more seconds before execution.`)

					console.log(`Fast-forwarding time by ${waitTime} seconds...`)
					await network.provider.send("evm_increaseTime", [waitTime])
					await network.provider.send("evm_mine")
					console.log(`Time fast-forwarded`)

				}
				return {
					success: true,
					status: "Queued",
					message: "Successfully queued proposal",
					proposalId: PROPOSAL_ID,
					txHash: receipt.hash
				};
				
			} catch (error) {
				if (error.message.includes("TimelockController: operation is not ready")) {
					console.log("Proposal cannot be executed yet because the timelock period hasn't passed.")
				} else {
					console.error("Error executing proposal:", error.message)
				}
			}
		}

		else {
			return {
				success: false,
				status: states[state],
				message: `Failed to queue proposal. Current state: ${states[state]}`
			}
		}
	} catch (error) {
		console.error("Error details:", error)
		return {
			success: false,
			message: `Error queueing proposal: ${error.message}`
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
		const result = await queueProposal(options)
		console.log("Result:", JSON.stringify(result, null, 2))

		if (result.success) {
			console.log(`Proposal successfully queued`)
			console.log(`Transaction hash: ${result.txHash}`)
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

module.exports = { queueProposal }