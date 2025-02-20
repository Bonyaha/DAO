const { ethers, network } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers
const addresses = require("../addresses")

const GOVERNOR_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
const PROPOSAL_ID = '5230289835011103672823903198228406806565753183275807746014809080855812650699'
const BOX_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'

async function main() {
	const config = addresses[network.name]
	//console.log(config);
	const governorAddress = config.governor.address
	const boxAddress = config.box.address

	const proposalId = PROPOSAL_ID
	//const boxAddress = BOX_ADDRESS
	const value = process.env.PROPOSAL_VALUE || 42
	const description = `Proposal #1: Store 42 in Box`

	console.log(`Using governor address: ${governorAddress}`)
	console.log(`Using box address: ${boxAddress}`)

	if (!proposalId || !boxAddress) {
		throw new Error("Please set PROPOSAL_ID and BOX_ADDRESS environment variables")
	}

	const governor = await ethers.getContractAt("MyGovernor", governorAddress)
	const box = await ethers.getContractAt("Box", boxAddress)

	// Get blocks info
	const currentBlock = await ethers.provider.getBlockNumber()
	const snapshot = await governor.proposalSnapshot(proposalId)
	const deadline = await governor.proposalDeadline(proposalId)

	console.log("\nBlock Information:")
	console.log(`Current block: ${currentBlock}`)
	console.log(`Snapshot block: ${snapshot}`)
	console.log(`Deadline block: ${deadline}`);

	// Get current signer
	const [signer] = await ethers.getSigners()
	const signerAddress = await signer.getAddress()

	// Check proposal state
	const state = await governor.state(proposalId)
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
		//console.log("descriptionHash", descriptionHash)

		// Cancel proposal
		console.log(`Cancelling proposal ${proposalId}...`)
		const cancelTx = await governor.cancel(
			[boxAddress],
			[0],
			[encodedFunctionCall],
			descriptionHash
		)
		console.log("Waiting for transaction confirmation...")
		const receipt = await cancelTx.wait()

		// Verify the new state
		const newState = await governor.state(proposalId)

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
			console.error("Unexpected error:", error)
		}
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})