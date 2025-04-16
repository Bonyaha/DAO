const { ethers } = require("hardhat")
const { addresses } = require("../addresses")

/**
 * Cast a vote on a governance proposal
 * @param {Object} options - Voting options
 * @param {number} options.voteWay - How to vote: 0=Against, 1=For, 2=Abstain
 * @param {string} options.network - Network to use (defaults to hardhat network name)
 * @param {string} options.voterAddress - Specific voter address (optional, for frontend use)
 * @param {string} options.proposalId - Optional override for proposal ID
 * @returns {Promise<Object>} Result of voting operation
 */
async function castVote(options = {}) {
	// Default vote is "For" (1)
	const voteWay = options.voteWay ?? 1

	// Get network information
	const networkName = options.network || network.name
	const isLocalNetwork = ["localhost", "hardhat"].includes(networkName)
	console.log(`Running on network: ${networkName}`)

	// Get contract addresses from config
	const config = addresses[networkName]
	if (!config) {
		throw new Error(`Network configuration not found for ${networkName}`)
	}

	const GOVERNOR_ADDRESS = config.governor.address
	const TOKEN_ADDRESS = config.governanceToken.address
	const PROPOSAL_ID = options.proposalId || config.proposalId.id

	if (!PROPOSAL_ID) {
		throw new Error("Proposal ID not found in config")
	}

	// Get contract instances
	const provider = ethers.provider
	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const governanceToken = await ethers.getContractAt("GovernanceToken", TOKEN_ADDRESS)

	// Validate vote type
	if (![0, 1, 2].includes(voteWay)) {
		throw new Error("Invalid vote way. Must be 0 (Against), 1 (For), or 2 (Abstain).")
	}

	// Check proposal state
	let state = await governor.state(PROPOSAL_ID)
	const states = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"]
	console.log(`Current proposal state: ${states[state]}`)

	// Handle voting delay if Pending
	if (state == 0) { // 0 = Pending
		const currentBlock = BigInt(await provider.getBlockNumber())
		const votingStarts = await governor.proposalSnapshot(PROPOSAL_ID)
		const proposalEta = await governor.proposalEta(PROPOSAL_ID)
		const latestBlock = await provider.getBlock("latest")
		const currentTimestamp = BigInt(latestBlock.timestamp)

		if (currentBlock <= votingStarts) {
			const waitTime = Number(proposalEta - currentTimestamp)
			const blocksToWait = Number(votingStarts - currentBlock + 1n)

			if (isLocalNetwork) {
				console.log(`Mining ${blocksToWait} blocks on local network...`)
				for (let i = 0; i < blocksToWait; i++) {
					await network.provider.send("evm_mine")
				}
				console.log("Mining complete.")
			} else {
				// For non-local networks, just return information about when voting will start
				const estimatedTime = new Date(Number(proposalEta) * 1000).toLocaleString()
				return {
					success: false,
					status: "pending",
					message: "Voting period has not started yet",
					votingStartsAtBlock: votingStarts.toString(),
					estimatedStartTime: estimatedTime,
					blocksToWait: blocksToWait
				}
			}

			// Re-check proposal state after mining blocks
			state = await governor.state(PROPOSAL_ID)
			console.log(`New proposal state: ${states[state]}`)
		}
	}

	// Ensure proposal is Active
	if (state != 1) { // 1 = Active
		return {
			success: false,
			status: states[state].toLowerCase(),
			message: `Cannot vote: Proposal is ${states[state]}`
		}
	}

	// Determine the voter to use
	let voter

	if (options.voterAddress) {
		// For frontend use - use the provided address with the provider's signer
		if (options.signer) {
			// If a signer is provided (from frontend)
			voter = options.signer
		} else {
			// For testing with specific addresses
			const signers = await ethers.getSigners()
			voter = signers.find(s => s.address.toLowerCase() === options.voterAddress.toLowerCase())

			if (!voter) {
				throw new Error(`Voter address ${options.voterAddress} not found in available signers`)
			}
		}
	} else {
		// Default to first signer if no specific address provided
		const signers = await ethers.getSigners()
		voter = signers[0]
	}

	console.log(`Casting vote as: ${voter.address}`)

	try {
		// Check voting power
		const votes = await governanceToken.getVotes(voter.address)
		if (votes === 0n) {
			return {
				success: false,
				voterAddress: voter.address,
				message: "No voting power",
				votePower: "0"
			}
		}

		// Check if already voted
		const hasVoted = await governor.hasVoted(PROPOSAL_ID, voter.address)
		if (hasVoted) {
			return {
				success: false,
				voterAddress: voter.address,
				message: "Already voted on this proposal"
			}
		}

		// Cast the vote
		const voteTx = await governor.connect(voter).castVote(PROPOSAL_ID, voteWay)
		const receipt = await voteTx.wait()

		// Get updated vote counts
		const { againstVotes, forVotes, abstainVotes } = await governor.proposalVotes(PROPOSAL_ID)

		return {
			success: true,
			voterAddress: voter.address,
			votePower: ethers.formatEther(votes),
			voteType: voteWay === 0 ? "Against" : voteWay === 1 ? "For" : "Abstain",
			txHash: voteTx.hash,
			proposalId: PROPOSAL_ID,
			currentVotes: {
				for: forVotes.toString(),
				against: againstVotes.toString(),
				abstain: abstainVotes.toString()
			}
		}
	} catch (error) {
		return {
			success: false,
			voterAddress: voter.address,
			message: error.message
		}
	}
}

// Export for importing in other files (backend or frontend)
module.exports = { castVote }

// Main function for hardhat run - simple solution without arguments
async function main() {
	// Get VOTE_TYPE from environment if available
	const voteType = process.env.VOTE_TYPE
	let voteWay = 1 // Default to "For"

	if (voteType === "against" || voteType === "0") {
		voteWay = 0
	} else if (voteType === "abstain" || voteType === "2") {
		voteWay = 2
	}

	// Get VOTER_ADDRESS from environment if available
	const voterAddress = process.env.VOTER_ADDRESS
	console.log(`voterAddress is ${voterAddress}`)

	console.log(`Voting: "${voteWay === 0 ? 'Against' : voteWay === 1 ? 'For' : 'Abstain'}" the proposal`)
	if (voterAddress) {
		console.log(`Using voter address: ${voterAddress}`)
	}

	try {
		const options = {
			voteWay,
			...(voterAddress && { voterAddress }) // Only add voterAddress if it exists
		}


		const result = await castVote(options)
		console.log("Result:", JSON.stringify(result, null, 2))

		if (result.success) {
			console.log(`Vote successfully cast as: ${result.voteType}`)
			console.log(`Transaction hash: ${result.txHash}`)
		} else {
			console.log(`Failed to cast vote: ${result.message}`)
		}
	} catch (error) {
		console.error("Error:", error.message)
	}
}

// Run main function if script is executed directly
if (require.main === module) {
	main()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error)
			process.exit(1)
		})
}