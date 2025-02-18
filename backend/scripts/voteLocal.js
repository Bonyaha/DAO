const { ethers } = require("hardhat")

const GOVERNOR_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
const PROPOSAL_ID = "5230289835011103672823903198228406806565753183275807746014809080855812650699"


async function main() {
	const proposalId = PROPOSAL_ID
	if (!proposalId) {
		throw new Error("Please set PROPOSAL_ID environment variable")
	}

	console.log("Current block:", await ethers.provider.getBlockNumber());

	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)

	// Check proposal state first
	let state = await governor.state(proposalId)
	const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed']
	console.log(`Current proposal state: ${states[state]}`);

	// If it's still Pending, mine an extra block to advance to Active
	if (state == 0) { // 0 = Pending
		console.log("Proposal is still pending. Mining a block...")
		//await ethers.provider.send("evm_mine", [])
		await network.provider.send("evm_mine") // for hardhat network
		console.log("Block mined.")

		// Re-check the proposal state
		state = await governor.state(proposalId)
		console.log(`New proposal state: ${states[state]}`)
	}



	if (state != 1) { // 1 = Active
		console.log(`Cannot vote: Proposal is ${states[state]}`)
		process.exit(0)
	}

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