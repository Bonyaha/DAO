const { ethers } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers

const GOVERNOR_ADDRESS ='0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'
const PROPOSAL_ID = '5230289835011103672823903198228406806565753183275807746014809080855812650699'
const BOX_ADDRESS = '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'

async function main() {
	const proposalId = PROPOSAL_ID
	const boxAddress = BOX_ADDRESS
	const value = process.env.PROPOSAL_VALUE || 42
	const description = `Proposal #1: Store 42 in Box`

	if (!proposalId || !boxAddress) {
		throw new Error("Please set PROPOSAL_ID and BOX_ADDRESS environment variables")
	}

	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const box = await ethers.getContractAt("Box", boxAddress)

	// Encode function call
	const encodedFunctionCall = box.interface.encodeFunctionData("store", [value])
	const descriptionHash = keccak256(toUtf8Bytes(description))

	// Cancel proposal
	console.log(`Cancelling proposal ${proposalId}...`)
	const cancelTx = await governor.cancel(
		[boxAddress],
		[0],
		[encodedFunctionCall],
		descriptionHash
	)
	await cancelTx.wait()

	console.log("Proposal cancelled!")

	// Verify state
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

	console.log(`Current state: ${stateMap[state]}`)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})