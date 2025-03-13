import { useEffect, useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useWatchContractEvent, useAccount, usePublicClient, useBlockNumber } from 'wagmi'
//import { getContract } from 'viem'
import { ethers } from 'ethers'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
//import MyToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'

const ProposalStatusMap = {
	0: 'Pending',
	1: 'Active',
	2: 'Canceled',
	3: 'Defeated',
	4: 'Succeeded',
	5: 'Queued',
	6: 'Expired',
	7: 'Executed',
}

const PROPOSALS_PER_PAGE = 5

const ProposalList = () => {
	const [proposals, setProposals] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [page, setPage] = useState(0)
	const [totalProposals, setTotalProposals] = useState(0)
	const [governorAddress, setGovernorAddress] = useState('')
	//const [tokenAddress, setTokenAddress] = useState('')

	const { chain } = useAccount()
	const publicClient = usePublicClient()
	//console.log('Public Client:', publicClient)
	//console.log('Connected Address:', address)
	//console.log('Connected Chain:', chain?.name)
	//if (isConnected) console.log('isConnected:', isConnected);

	// Initialize network and contract addresses using Wagmi
	useEffect(() => {
		const initializeNetwork = async () => {
			if (!chain) {
				console.error('No chain detected')
				return
			}

			// Map chain ID to network name (e.g., 31337 for localhost)
			const currentNetwork = chain.id === 31337 ? 'localhost' : chain.name.toLowerCase()

			if (addresses[currentNetwork]) {
				setGovernorAddress(addresses[currentNetwork].governor.address)
				//setTokenAddress(addresses[currentNetwork].governanceToken.address)
			} else {
				console.error(`Network ${currentNetwork} not found in addresses.json`)
			}
		}

		initializeNetwork()
	}, [chain])

	// Get total proposal count from contract
	const { data: proposalCount } = useReadContract({
		address: governorAddress,
		abi: MyGovernor.abi,
		functionName: 'getNumberOfProposals',
		enabled: !!governorAddress,
	})

	useEffect(() => {
		if (proposalCount) {
			setTotalProposals(Number(proposalCount))
		}
	}, [proposalCount])

	// Fetch proposal events using Wagmi's publicClient
	const fetchProposalEvents = useCallback(async () => {
		if (!publicClient) {
			console.error('Public client is not available')
			return
		}

		if (!governorAddress) return

		setIsLoading(true)
		try {
			/* const governor = getContract({
				address: governorAddress,
				abi: MyGovernor.abi,
				publicClient,
			}) */

			//console.log('Governor Contract:', governor);

			//const latestBlock = await publicClient.getBlockNumber()
			//const startBlock = Math.max(0, Number(latestBlock) - 5000);

			// Get ProposalCreated events
			const events = await publicClient.getContractEvents({
				address: governorAddress,
				abi: MyGovernor.abi,
				eventName: 'ProposalCreated',
				fromBlock: 'earliest', // or use a specific block number that you know exists
				toBlock: 'latest'
			})

			// Sort by blockNumber in descending order
			events.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))
			//console.log('Events:', events);

			const startIdx = page * PROPOSALS_PER_PAGE
			const endIdx = startIdx + PROPOSALS_PER_PAGE
			const paginatedEvents = events.slice(startIdx, endIdx)

			const proposalPromises = paginatedEvents.map(async (event) => {
				const { proposalId, description, targets, values, calldatas } = event.args

				// Get proposal state
				const state = await publicClient.readContract({
					address: governorAddress,
					abi: MyGovernor.abi,
					functionName: 'state',
					args: [proposalId],
				})

				// Get proposal votes
				const proposalVotes = await publicClient.readContract({
					address: governorAddress,
					abi: MyGovernor.abi,
					functionName: 'proposalVotes',
					args: [proposalId],
				})
				//const [title, desc] = description.split('#').map((s) => s.trim())

				return {
					id: proposalId,
					title: 'Untitled Proposal',
					description: description,
					state: Number(state),
					forVotes: ethers.formatEther(proposalVotes[1]),
					againstVotes: ethers.formatEther(proposalVotes[0]),
					abstainVotes: ethers.formatEther(proposalVotes[2]),
					targets,
					values,
					calldatas,
					descriptionHash: ethers.id(description),
				}
			})

			const proposalData = await Promise.all(proposalPromises)
			setProposals(proposalData)
		} catch (error) {
			console.error('Error fetching proposals:', error)
		} finally {
			setIsLoading(false)
		}
	}, [governorAddress, page, publicClient])

	// Get the current block number using Wagmi
	const { data: currentBlock } = useBlockNumber()

	useEffect(() => {
		if (!currentBlock || !governorAddress || !publicClient) return

		const checkProposalStatus = async () => {
			setProposals(prevProposals => {
				if (!prevProposals.length) return prevProposals

				const proposalsToUpdate = [...prevProposals]

					// Using async IIFE (Immediately Invoked Function Expression)
					; (async () => {
						const results = await Promise.all(proposalsToUpdate.map(async (proposal) => {
							const proposalSnapshot = await publicClient.readContract({
								address: governorAddress,
								abi: MyGovernor.abi,
								functionName: 'proposalSnapshot',
								args: [proposal.id],
							})

							const thresholdBlock = Number(proposalSnapshot) + 1

							if (currentBlock >= thresholdBlock && proposal.state === 0) {
								const state = await publicClient.readContract({
									address: governorAddress,
									abi: MyGovernor.abi,
									functionName: 'state',
									args: [proposal.id],
								})

								proposal.state = Number(state)
								return true
							}
							return false
						}))

						// Check if any proposals changed and update state if needed
						if (results.some(changed => changed)) {
							setProposals([...proposalsToUpdate])
						}
					})()

				return prevProposals
			})
		}		
		// Call the check when a new block is detected
		checkProposalStatus()
	}, [currentBlock, governorAddress, publicClient])

	// Event listeners
	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalCreated',
		onLogs() {
			fetchProposalEvents()
		},
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'VoteCast',
		onLogs() {
			fetchProposalEvents()
		},
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalQueued',
		onLogs() {
			fetchProposalEvents()
		},
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalExecuted',
		onLogs() {
			fetchProposalEvents()
		},
		enabled: !!governorAddress,
	})


	useEffect(() => {
		if (governorAddress) {
			fetchProposalEvents()
		}
	}, [governorAddress, page, fetchProposalEvents])

	const { writeContract: castVote, isPending: votingInProgress } = useWriteContract()
	const { data: executionHash, writeContract: executeProposal, isPending: executionInProgress } = useWriteContract()

	// useEffect to handle executionHash updates
	useEffect(() => {
		if (executionHash) {
			console.log('Transaction hash:', executionHash) // Now it will log the actual hash

			const waitForReceipt = async () => {
				try {
					const receipt = await publicClient.waitForTransactionReceipt({ hash: executionHash })
					if (receipt.status === 'success') {
						console.log('Proposal executed successfully') // Now this should log correctly
					} else {
						console.error('Transaction failed:', receipt)
					}
				} catch (waitError) {
					console.error('Error waiting for transaction:', waitError)
				}
			}

			waitForReceipt()
		}
	}, [executionHash, publicClient])

	const handleVote = async (proposalId, support) => {
		try {
			await castVote({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'castVote',
				args: [proposalId, support],
			})
		} catch (error) {
			console.error('Error voting:', error)
		}
	}

	const handleExecute = async (proposal) => {
		const argsForExecuteProposal = { // Create a variable for clarity
			targets: proposal.targets,
			values: proposal.values,
			calldatas: proposal.calldatas,
			descriptionHash: proposal.descriptionHash
		}
		console.log(
			"Arguments for executeProposal (JSON.stringify):",
			JSON.stringify(
				argsForExecuteProposal,
				(key, value) => (typeof value === 'bigint' ? value.toString() : value), // Replacer function
				2
			)
		)

		try {
			await executeProposal({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'execute',
				args: [proposal.targets, proposal.values, proposal.calldatas, proposal.descriptionHash],
			})

		} catch (error) {
			console.error('Error executing proposal:', error)
		}
	}

	//console.log('Transaction hash:', executionHash)

	const handleNextPage = () => {
		if ((page + 1) * PROPOSALS_PER_PAGE < totalProposals) {
			setPage(page + 1)
		}
	}

	const handlePrevPage = () => {
		if (page > 0) {
			setPage(page - 1)
		}
	}

	if (isLoading && !proposals.length) {
		return (
			<div className="mt-8">
				<h2 className="text-2xl font-bold mb-4">Proposals</h2>
				<div className="flex justify-center items-center h-32">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
				</div>
			</div>
		)
	}

	return (
		<div className="mt-8">
			<h2 className="text-2xl font-bold mb-4">Proposals</h2>
			{totalProposals === 0 || proposals.length === 0 ? (
				<div className="bg-white p-6 rounded-lg shadow-md">
					<p className="text-gray-500">No proposals found. Create one to get started!</p>
				</div>
			) : (
				<>
					<div className="space-y-4">
						{proposals.map((proposal) => (
							<div key={proposal.id.toString()} className="bg-white p-6 rounded-lg shadow-md">
								<h3 className="text-xl font-bold">{proposal.title}</h3>
								<p className="my-2 text-gray-700">{proposal.description}</p>
								<div className="flex justify-between items-center mt-4">
									<span
										className={`px-3 py-1 rounded-full text-sm ${['Succeeded', 'Executed'].includes(ProposalStatusMap[proposal.state])
											? 'bg-green-100 text-green-800'
											: ['Defeated', 'Canceled', 'Expired'].includes(ProposalStatusMap[proposal.state])
												? 'bg-red-100 text-red-800'
												: 'bg-blue-100 text-blue-800'
											}`}
									>
										{ProposalStatusMap[proposal.state]}
									</span>
									<div className="space-x-2">
										{proposal.state === 1 && (
											<>
												<button
													onClick={() => handleVote(proposal.id, 1)}
													className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
													disabled={votingInProgress}
												>
													For
												</button>
												<button
													onClick={() => handleVote(proposal.id, 0)}
													className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
													disabled={votingInProgress}
												>
													Against
												</button>
												<button
													onClick={() => handleVote(proposal.id, 2)}
													className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
													disabled={votingInProgress}
												>
													Abstain
												</button>
											</>
										)}
										{proposal.state === 5 && (
											<button
												onClick={() => handleExecute(proposal)}
												className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600"
												disabled={executionInProgress}
											>
												Execute
											</button>
										)}
									</div>
								</div>
								<div className="mt-4 text-sm text-gray-500">
									<p>Votes For: {proposal.forVotes}</p>
									<p>Votes Against: {proposal.againstVotes}</p>
									<p>Abstained: {proposal.abstainVotes}</p>
								</div>
							</div>
						))}
					</div>
					{totalProposals > PROPOSALS_PER_PAGE && (
						<div className="flex justify-between items-center mt-6">
							<button
								onClick={handlePrevPage}
								disabled={page === 0}
								className={`px-4 py-2 rounded ${page === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'
									}`}
							>
								Previous
							</button>
							<span className="text-gray-600">
								Page {page + 1} of {Math.ceil(totalProposals / PROPOSALS_PER_PAGE)}
							</span>
							<button
								onClick={handleNextPage}
								disabled={(page + 1) * PROPOSALS_PER_PAGE >= totalProposals}
								className={`px-4 py-2 rounded ${(page + 1) * PROPOSALS_PER_PAGE >= totalProposals
									? 'bg-gray-300 text-gray-500 cursor-not-allowed'
									: 'bg-blue-500 text-white hover:bg-blue-600'
									}`}
							>
								Next
							</button>
						</div>
					)}
				</>
			)}
		</div>
	)
}

export default ProposalList