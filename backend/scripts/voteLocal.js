const { ethers } = require("hardhat")
const addresses = require("../addresses")

async function main() {
// Get network information
	const networkName = network.name
	const isLocalNetwork = ['localhost', 'hardhat'].includes(networkName)
	console.log(`Running on network: ${networkName}`)

	const config = addresses[network.name]
	//console.log(config)
	const GOVERNOR_ADDRESS = config.governor.address	
	const PROPOSAL_ID = config.proposalId.id

	//console.log(`Using governor address: ${GOVERNOR_ADDRESS}`)
	

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

		

	// If it's still Pending, handle voting delay based on network
	if (state == 0) { // 0 = Pending
		const currentBlock = BigInt(await ethers.provider.getBlockNumber())
		const votingStarts = await governor.proposalSnapshot(proposalId)
		console.log(`Current block: ${currentBlock}`)
		console.log(`Voting starts at block: ${votingStarts}`)

		if (currentBlock <= votingStarts) {
			const blocksToWait = Number(votingStarts - currentBlock + 1n)
			console.log(`Need to wait for ${blocksToWait} blocks`)

			if (isLocalNetwork) {
				console.log("Mining blocks on local network...")
				for (let i = 0; i < blocksToWait; i++) {
					await network.provider.send("evm_mine")
					if (i % 5 === 0) { // Log progress every 5 blocks
						console.log(`Mined block ${i + 1} of ${blocksToWait}`)
					}
				}
			} else {
				console.log(`Waiting for block ${votingStarts} on ${networkName}...`)
				await ethers.provider.waitForBlock(Number(votingStarts + 1n))
			}

			console.log("Voting delay period completed.")
			// Re-check the proposal state
			state = await governor.state(proposalId)
			console.log(`New proposal state: ${states[state]}`)
		}
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