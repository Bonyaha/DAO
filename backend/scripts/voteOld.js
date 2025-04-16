const { ethers } = require("hardhat")
const {addresses} = require("../addresses")

/* create checking for repeating voting */

async function main() {
// Get network information
	const networkName = network.name
	const isLocalNetwork = ['localhost', 'hardhat'].includes(networkName)
	console.log(`Running on network: ${networkName}`)

//console.log(addresses)
	const config = addresses[network.name]
	//console.log(config)
	const GOVERNOR_ADDRESS = config.governor.address
	const TOKEN_ADDRESS = config.governanceToken.address	
	const PROPOSAL_ID = config.proposalId.id

	//console.log(`Using governor address: ${GOVERNOR_ADDRESS}`)
	

	const proposalId = PROPOSAL_ID
	if (!proposalId) {
		throw new Error("Please set PROPOSAL_ID environment variable")
	}

	console.log("Current block:", await ethers.provider.getBlockNumber());

	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
const governanceToken = await ethers.getContractAt("GovernanceToken", TOKEN_ADDRESS)

	// Check proposal state first
	let state = await governor.state(proposalId)
	const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed']
	console.log(`Current proposal state: ${states[state]}`);

		

	// If it's still Pending, handle voting delay based on network
	if (state == 0) { // 0 = Pending
		const currentBlock = BigInt(await ethers.provider.getBlockNumber())
		const votingStarts = await governor.proposalSnapshot(proposalId)
		const proposalEta = await governor.proposalEta(proposalId) //timestamp when the proposal can be executed
		const latestBlock = await ethers.provider.getBlock('latest')
		const currentTimestamp = BigInt(latestBlock.timestamp)
		console.log(`Current block: ${currentBlock}`)
		console.log(`Voting starts at block: ${votingStarts}`)

		if (currentBlock <= votingStarts) {
			const waitTime = Number(proposalEta - currentTimestamp)
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
				console.log(`Voting delay not yet complete on ${networkName}.`)
				console.log(`Please rerun this script after block ${votingStarts} is reached.`)
				const minutes = Math.ceil(waitTime / 60)  // Total minutes, rounded up
				const hours = Math.floor(waitTime / 3600) // Full hours
				const remainingMinutes = Math.ceil((waitTime % 3600) / 60) // Minutes after full hours

				if (hours >= 1) {
					console.log(`That's approximately ${hours} hours and ${remainingMinutes} minutes.`)
				} else {
					console.log(`That's approximately ${minutes} minutes.`)
				}
				console.log(`Please run this script again at or after: ${new Date(Number(proposalEta) * 1000).toLocaleString()}`)
				console.log(`Estimated wait time: ~${blocksToWait * 15} seconds (assuming 15s/block on Sepolia)`)
				process.exit(0);
			}
			
			// Re-check the proposal state
			state = await governor.state(proposalId)
			console.log(`New proposal state: ${states[state]}`)
		}
	}


	if (state != 1) { // 1 = Active
		console.log(`Cannot vote: Proposal is ${states[state]}`)
		process.exit(0)
	}

	// check voting eligibility
	const [voter] = await ethers.getSigners()
	console.log("Voting with account:", voter.address)

	// Check if voter has voting power
	const votes = await governanceToken.getVotes(voter.address)
	if (votes === 0n) {
		console.log("Error: Account has no voting power. Please delegate tokens first.")
		process.exit(1)
	}

	// Check if voter has already voted
	const hasVoted = await governor.hasVoted(proposalId, voter.address)
	if (hasVoted) {
		console.log("Error: This account has already voted on this proposal.")
		process.exit(1)
	}

	console.log(`Account has ${ethers.formatEther(votes)} voting power.`);
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