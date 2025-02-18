const { ethers } = require("hardhat")

const GOVERNOR_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
const PROPOSAL_ID = "5230289835011103672823903198228406806565753183275807746014809080855812650699"

async function main() {
	const proposalId = PROPOSAL_ID
	if (!proposalId) {
		throw new Error("Please set PROPOSAL_ID environment variable")
	}

	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)

	// Get proposal state
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

	console.log(`Proposal ${proposalId} state: ${stateMap[state]}`)

	// Get proposal details
	const snapshot = await governor.proposalSnapshot(proposalId)
	const deadline = await governor.proposalDeadline(proposalId)
	const { againstVotes, forVotes, abstainVotes } = await governor.proposalVotes(proposalId)

	console.log(`Snapshot block: ${snapshot}`)
	console.log(`Deadline block: ${deadline}`)
	console.log(`Current block: ${await ethers.provider.getBlockNumber()}`)
	console.log(`Votes - For: ${forVotes}, Against: ${againstVotes}, Abstain: ${abstainVotes}`)

	// Calculate quorum
	const quorum = await governor.quorum(snapshot)
	console.log(`Quorum required: ${quorum}`)
	console.log(`Total votes cast: ${BigInt(forVotes) + BigInt(againstVotes) + BigInt(abstainVotes)}`)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})