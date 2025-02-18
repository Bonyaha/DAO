const { ethers } = require("hardhat")

const GOVERNOR_ADDRESS = "0xA64fFB0e4CF1F49ea2dbCE4C871FF8d39481D9FC"
const PROPOSAL_ID = "13333668535660679219098534105939188806920359908433547209339039615474533999535"

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