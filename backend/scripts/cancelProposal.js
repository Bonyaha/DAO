const { ethers, network } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers
const {addresses} = require("../addresses")


async function main() {
	const config = addresses[network.name]
	//console.log(config);
	const GOVERNOR_ADDRESS = config.governor.address
	const BOX_ADDRESS = config.box.address
	const PROPOSAL_ID = config.proposalId.id

	if (!PROPOSAL_ID || !BOX_ADDRESS) {
		throw new Error("Please set PROPOSAL_ID and BOX_ADDRESS environment variables")
	}

	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const box = await ethers.getContractAt("Box", BOX_ADDRESS)

	console.log(`Using governor address: ${GOVERNOR_ADDRESS}`)
	console.log(`Using box address: ${BOX_ADDRESS}`)

	const value = process.env.PROPOSAL_VALUE || 42
	console.log(`Number of proposals: ${await governor.getNumberOfProposals()}`)
	const description = `Proposal #${await governor.getNumberOfProposals()}: Store ${value} in Box`
	console.log(`Proposal description: ${description}`)

	// Get blocks info
	const currentBlock = await ethers.provider.getBlockNumber()
	const snapshot = await governor.proposalSnapshot(PROPOSAL_ID)
	const deadline = await governor.proposalDeadline(PROPOSAL_ID)

	console.log("\nBlock Information:")
	console.log(`Current block: ${currentBlock}`)
	console.log(`Snapshot block: ${snapshot}`)
	console.log(`Deadline block: ${deadline}`)

	// Get current signer
	const [signer] = await ethers.getSigners()
	const signerAddress = await signer.getAddress()

	// Check proposal state
	const state = await governor.state(PROPOSAL_ID)
	const stateMap = {
		0: "Pending",
		1: "Active",
		2: "Canceled",
		3: "Defeated",
		4: "Succeeded",
		5: "Queued",
		6: "Expired",
		7: "Executed"
	}

	console.log("\nProposal Status:")
	console.log(`Current state: ${stateMap[state]}`)
	console.log(`Your address: ${signerAddress}`)

	// Check if proposal is in a terminal state
	if ([2, 3, 6, 7].includes(state)) {
		console.log(`\nCannot cancel: Proposal is already in ${stateMap[state]} state`)
		return
	}

	try {
		// Encode function call
		const encodedFunctionCall = box.interface.encodeFunctionData("store", [value])
		const descriptionHash = keccak256(toUtf8Bytes(description))
		console.log("descriptionHash", descriptionHash)

		// Cancel proposal
		console.log(`Cancelling proposal ${PROPOSAL_ID}...`)
		const cancelTx = await governor.cancel(
			[BOX_ADDRESS],
			[0],
			[encodedFunctionCall],
			descriptionHash
		)
		console.log("Waiting for transaction confirmation...")
		const receipt = await cancelTx.wait()

		// Verify the new state
		const newState = await governor.state(PROPOSAL_ID)

		console.log("\nCancellation Result:")
		console.log(`Transaction confirmed in block ${receipt.blockNumber}`)
		console.log(`New state: ${stateMap[newState]}`)
	} catch (error) {
		console.error("\nError occurred:")
		// Handle common error cases with user-friendly messages
		if (error.message.includes("Governor: proposer above threshold")) {
			console.error("Your voting power is still above the threshold. You need to reduce your voting power to cancel.")
		} else if (error.message.includes("Governor: only proposer")) {
			console.error("Only the original proposer can cancel this proposal.")
		} else if (error.message.includes("Governor: proposal not active")) {
			console.error("The proposal is not in a state that can be cancelled.")
		} else {
			console.error("Raw error:", error.message)

			if (error.data) {
				try {
					const decodedError = governor.interface.parseError(error.data)
					console.error(`Contract error: ${decodedError.name}`)
				} catch (parseError) {
					console.error("Failed to parse contract error")
				}
			}
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})