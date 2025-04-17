const { ethers } = require("hardhat")
const {addresses} = require("../addresses")



async function main() {
	const networkName = network.name
	console.log(`Running on network: ${networkName}\n`)

	const config = addresses[network.name]
	//console.log(config)
	const GOVERNOR_ADDRESS = config.governor.address
	const GOVERNANCE_TOKEN_ADDRESS = config.governanceToken.address
	const PROPOSAL_ID = config.proposalId.id

	const [proposer] = await ethers.getSigners()	

	const proposalId = PROPOSAL_ID
	if (!proposalId) {
		throw new Error("Please set PROPOSAL_ID environment variable")
	}

	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const governanceToken = await ethers.getContractAt("GovernanceToken", GOVERNANCE_TOKEN_ADDRESS)

	const balance = await governanceToken.balanceOf(proposer.address)
	const votes = await governanceToken.getVotes(proposer.address)
	console.log("Current balance:", balance.toString())
	console.log("Current votes:", votes.toString())

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

	console.log(`\nProposal id: ${proposalId}`)

	// Get proposal details
	const snapshot = await governor.proposalSnapshot(proposalId)
	const deadline = await governor.proposalDeadline(proposalId)
	const { againstVotes, forVotes, abstainVotes } = await governor.proposalVotes(proposalId)

	console.log(`Proposal state: ${stateMap[state]}`)
	console.log(`Snapshot block: ${snapshot}`)
	console.log(`Deadline block: ${deadline}`)
	console.log(`Current block: ${await ethers.provider.getBlockNumber()}`)
	console.log(`Votes - For: ${forVotes}, Against: ${againstVotes}, Abstain: ${abstainVotes}`)

}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})