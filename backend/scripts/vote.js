const { ethers } = require("hardhat")

async function main() {
	const proposalId = process.env.PROPOSAL_ID
	if (!proposalId) {
		throw new Error("Please set PROPOSAL_ID environment variable")
	}

	const governor = await ethers.getContractAt("MyGovernor", process.env.GOVERNOR_ADDRESS)

	// 0 = Against, 1 = For, 2 = Abstain
	const votingWay = 1
	const voteTx = await governor.castVote(proposalId, votingWay)
	await voteTx.wait()

	console.log(`Vote cast on proposal ${proposalId}`)

	const { againstVotes, forVotes, abstainVotes } = await governor.proposalVotes(proposalId)
	console.log(`Current votes - For: ${forVotes}, Against: ${againstVotes}, Abstain: ${abstainVotes}`)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})