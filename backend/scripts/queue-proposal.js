const { ethers, network } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers
const { addresses } = require("../addresses")

/**
 * Queues a proposal and handles timelock fast-forwarding based on state
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
	const PROPOSAL_VALUE = config.proposalValue?.value || 42
	const description = `Proposal #1: Store ${PROPOSAL_VALUE} in Box`

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

	// Prepare proposal data that will be needed for queueing
	const encodedFunctionCall = box.interface.encodeFunctionData("store", [PROPOSAL_VALUE])
	const descriptionHash = keccak256(toUtf8Bytes(description))

	try {
		// Case 1: If the proposal is in Succeeded state, queue it
		if (state == 4) { // 4 = Succeeded
			console.log("Proposal is in Succeeded state. Queueing it now...")

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

			// Update the state after queueing
			state = await governor.state(PROPOSAL_ID)
			console.log(`New proposal state: ${states[state]}`)

			// Continue to case 2 since we now have a queued proposal
		}

		// Case 2: If the proposal is in Queued state, fast-forward past the timelock
		if (state == 5) { // 5 = Queued
			// Get the earliest execution time
			const proposalEta = await governor.proposalEta(PROPOSAL_ID)
			const latestBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = BigInt(latestBlock.timestamp)

			console.log(`Proposal ETA: ${new Date(Number(proposalEta) * 1000).toLocaleString()}`)
			console.log(`Current time: ${new Date(Number(currentTimestamp) * 1000).toLocaleString()}`)

			// Check if we need to fast-forward
			if (currentTimestamp < proposalEta) {
				const waitTime = Number(proposalEta - currentTimestamp)
				console.log(`Proposal is in timelock. Fast-forwarding by ${waitTime} seconds...`)

				// Fast-forward time
				await network.provider.send("evm_increaseTime", [waitTime])
				await network.provider.send("evm_mine")

				const newBlock = await ethers.provider.getBlock('latest')
				console.log(`Time fast-forwarded to: ${new Date(Number(newBlock.timestamp) * 1000).toLocaleString()}`)
				console.log(`Proposal is now ready for execution!`)

				return {
					success: true,
					status: "ReadyForExecution",
					message: "Successfully fast-forwarded past timelock period. Proposal is ready for execution.",
					proposalId: PROPOSAL_ID
				}
			} else {
				// Already past the timelock period
				console.log("Proposal is already past the timelock period and ready for execution.")
				return {
					success: true,
					status: "ReadyForExecution",
					message: "Proposal is already past timelock and ready for execution.",
					proposalId: PROPOSAL_ID
				}
			}
		}

		// If we get here, the proposal is in neither Succeeded nor Queued state
		return {
			success: false,
			status: states[state],
			message: `Cannot process proposal: it is in ${states[state]} state, not in Succeeded or Queued state`
		}

	} catch (error) {
		console.error("Error details:", error)
		return {
			success: false,
			message: `Error processing proposal: ${error.message}`
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
			console.log(`Operation completed successfully: ${result.status}`)
			if (result.txHash) {
				console.log(`Transaction hash: ${result.txHash}`)
			}
		} else {
			console.log(`Operation failed: ${result.message}`)
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