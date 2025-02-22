const { ethers } = require("hardhat")
const { toUtf8Bytes, keccak256 } = ethers

const GOVERNOR_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
const BOX_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
const GOVERNANCE_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

async function main() {
	const [proposer] = await ethers.getSigners()
	console.log("Creating proposal with account:", proposer.address)

	// Get contract instances
	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const box = await ethers.getContractAt("Box", BOX_ADDRESS)
	const governanceToken = await ethers.getContractAt("GovernanceToken", GOVERNANCE_TOKEN_ADDRESS)

	// Ensure proposer has tokens and has delegated them
	console.log("Checking token balance and delegation...")
	const balance = await governanceToken.balanceOf(proposer.address)
	if (balance === 0n) {
		console.log("Claiming tokens...")
		const claimTx = await governanceToken.claimTokens()
		await claimTx.wait()
	}

	const votes = await governanceToken.getVotes(proposer.address)
	if (votes === 0n) {
		console.log("Delegating tokens...")
		const delegateTx = await governanceToken.delegate(proposer.address)
		await delegateTx.wait()
		// Wait for one block to ensure checkpoint is created
		/* await ethers.provider.waitForBlock(await ethers.provider.getBlockNumber() + 1) */
		await network.provider.send("evm_mine") // for hardhat network
	}

	// Get the total number of proposals
	const proposalCount = await governor.getNumberOfProposals()
	console.log(`Total number of proposals: ${proposalCount}`)

	// Create proposal
	console.log("Creating proposal...")
	const newValue = 42 // The value we want to store in the Box contract
	const encodedFunctionCall = box.interface.encodeFunctionData("store", [newValue])
	const descriptionString = `Proposal #${await governor.getNumberOfProposals() + 1n}: Store ${newValue} in Box`

	// Propose
	console.log("Proposing...")
	const proposeTx = await governor.propose(
		[box.target],         // target contract
		[0],                  // value in ETH
		[encodedFunctionCall], // encoded function call
		descriptionString      // description
	)

	const proposeReceipt = await proposeTx.wait()
	const proposalId = proposeReceipt.logs[0].args[0]
	console.log("Proposal created with ID:", proposalId.toString())

	// Get proposal state and details
	const state = await governor.state(proposalId)
	const snapshot = await governor.proposalSnapshot(proposalId)
	const deadline = await governor.proposalDeadline(proposalId)

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
		7: "Executed"
	}
	return states[state] || "Unknown"
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})