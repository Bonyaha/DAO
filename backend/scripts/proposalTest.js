const { ethers, network } = require("hardhat")
const { toUtf8Bytes, keccak256 } = ethers
const { addresses, updateProposalId } = require("../addresses")

/**
 * Create a governance proposal to store a value in the Box contract
 * @param {Object} options - Proposal options
 * @param {number|string} options.value - Value to store in Box (defaults to env or 42)
 * @param {Object} options.proposer - Signer creating the proposal (defaults to first signer)
 * @param {string} options.network - Network to use (defaults to hardhat network name)
 * @returns {Promise<Object>} Result of proposal creation
 */
async function createProposal(options = {}) {
	// Default value from environment or 42
	const value = options.value || process.env.PROPOSAL_VALUE || 42
	//const proposer = options.proposer || (await ethers.getSigners())[0]
	const networkName = options.network || network.name
	const isLocalNetwork = ["localhost", "hardhat"].includes(networkName)

	console.log(`Running on network: ${networkName}`)


	// Get contract addresses from config
	const config = addresses[networkName]
	if (!config) {
		throw new Error(`Network configuration not found for ${networkName}`)
	}

	const GOVERNOR_ADDRESS = config.governor.address
	const BOX_ADDRESS = config.box.address
	const GOVERNANCE_TOKEN_ADDRESS = config.governanceToken.address

	console.log(`Using governor address: ${GOVERNOR_ADDRESS}`)
	console.log(`Using box address: ${BOX_ADDRESS}`)
	console.log(`Using governance token address: ${GOVERNANCE_TOKEN_ADDRESS}`)

	// Get contract instances
	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const box = await ethers.getContractAt("Box", BOX_ADDRESS)
	const governanceToken = await ethers.getContractAt(
		"GovernanceToken",
		GOVERNANCE_TOKEN_ADDRESS
	)

	// Determine the proposer to use
	let proposer

	if (options.proposerAddress) {
		console.log(`Attempting to use proposer address: ${options.proposerAddress}`)
		// For frontend use - use the provided address with the provider's signer
		if (options.signer) {
			// If a signer is provided (from frontend)
			proposer = options.signer
		} else {
			// For local/test networks, connect using the provided address
			try {
				// Get all available signers
				const signers = await ethers.getSigners()
				proposer = signers.find(s => s.address.toLowerCase() === options.proposerAddress.toLowerCase())

				if (!proposer) {
					throw new Error(`Proposer address ${options.proposerAddress} not found in available signers`)
				}
			} catch (err) {
				console.error("Error finding/creating signer:", err)
				throw new Error(`Could not create signer for address ${options.proposerAddress}`)
			}
		}
	} else {
		// Default to first signer if no specific address provided
		const signers = await ethers.getSigners()
		proposer = signers[0]
	}

	console.log("Creating proposal with account:", proposer.address)

	// Ensure proposer has tokens and has delegated them
	console.log("Checking token balance and delegation...")
	const balance = await governanceToken.balanceOf(proposer.address)
	if (balance === 0n) {
		console.log("Claiming tokens...")
		const claimTx = await governanceToken.connect(proposer).claimTokens()
		await claimTx.wait()
	}

	const votes = await governanceToken.getVotes(proposer.address)
	if (votes === 0n) {
		console.log("Delegating tokens...")
		const delegateTx = await governanceToken.connect(proposer).delegate(proposer.address)
		await delegateTx.wait()

		// Wait for one block - use appropriate method based on network
		if (isLocalNetwork) {
			console.log("Mining block on local network...")
			await network.provider.send("evm_mine")
		} else {
			console.log("Waiting for next block on test/main network...")
			await ethers.provider.waitForBlock(await ethers.provider.getBlockNumber() + 1)
		}
	}

	// Create proposal
	console.log("Creating proposal...")
	const encodedFunctionCall = box.interface.encodeFunctionData("store", [value])
	const descriptionString = `Proposal #${(await governor.getNumberOfProposals()) + 1n
		}: Store ${value} in Box`

	console.log("Proposing...")
	const proposeTx = await governor.connect(proposer).propose(
		[box.target], // target contract
		[0], // value in ETH
		[encodedFunctionCall], // encoded function call
		descriptionString // description
	)

	const proposeReceipt = await proposeTx.wait()
	const newProposalId = proposeReceipt.logs[0].args[0]
	console.log("Proposal created with ID:", newProposalId.toString())

	console.log(`value: ${value}`)

	// Update proposal ID in addresses config
	updateProposalId(networkName, newProposalId, value)

	// Get proposal state and details
	const state = await governor.state(newProposalId)
	const snapshot = await governor.proposalSnapshot(newProposalId)
	const deadline = await governor.proposalDeadline(newProposalId)

	console.log("\nProposal Details:")
	console.log("- State:", getProposalState(state))
	console.log("- Snapshot Block:", snapshot.toString())
	console.log("- Deadline Block:", deadline.toString())
	console.log("- Description:", descriptionString)
	console.log("- Description Hash:", keccak256(toUtf8Bytes(descriptionString)))

	console.log("\nNext Steps:")
	console.log("1. Wait for the voting delay period")
	console.log("2. Cast votes using the proposalId")
	console.log("3. Wait for the voting period to end")
	console.log("4. Queue and execute the proposal if it passed")

	return {
		proposalId: newProposalId.toString(),
		description: descriptionString,
		intendedValue: value.toString(),
		state: getProposalState(state),
	}
}

function getProposalState(state) {
	const states = {
		0: "Pending",
		1: "Active",
		2: "Canceled",
		3: "Defeated",
		4: "Succeeded",
		5: "Queued",
		6: "Expired",
		7: "Executed",
	}
	return states[state] || "Unknown"
}

// Main function for terminal execution
async function main() {
	const value = process.env.PROPOSAL_VALUE || 42
	const proposerAddress = process.env.PROPOSER_ADDRESS
	if (proposerAddress) {
		console.log(`proposerAddress: ${proposerAddress}`)
	}

	try {
		const options = {
			value,
			...(proposerAddress && { proposerAddress }) // Only add proposerAddress if it exists
		}
		const result = await createProposal( options )
		console.log("Proposal created:", JSON.stringify(result, null, 2))
	} catch (error) {
		console.error("Error:", error.message)
	}
}

// Run if executed directly
if (require.main === module) {
	main()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error)
			process.exit(1)
		})
}

// Export for frontend or other script use
module.exports = { createProposal }