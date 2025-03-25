import { useEffect, useState, useCallback } from 'react'
import { useReadContract, useWriteContract, useWatchContractEvent, useAccount, usePublicClient, useBlockNumber } from 'wagmi'
import { ethers } from 'ethers'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import GovernanceToken from '../artifacts/contracts/GovernanceToken.sol/GovernanceToken.json'
import addresses from '../addresses.json'
import ProposalTimingButton from './ProposalTimingButton'
import { TimingProvider } from './TimingContext';
import { useTiming } from './hooks/useTiming'

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

const ProposalListContent = () => {
	const [proposals, setProposals] = useState([])
	const [currentNetwork, setCurrentNetwork] = useState('')
	const [isLoading, setIsLoading] = useState(true)
	const [page, setPage] = useState(0)
	const [totalProposals, setTotalProposals] = useState(0)
	const [governorAddress, setGovernorAddress] = useState('')
	const {currentTime, canExecuteProposal } = useTiming();
	const [timelockPeriod, setTimelockPeriod] = useState(0) // Store timelock period in seconds
	const [votingPower, setVotingPower] = useState(0)
	const [tokenAddress, setTokenAddress] = useState('')


	const { address, chain } = useAccount()
	const publicClient = usePublicClient()
	
	// Initialize network and contract addresses using Wagmi
	useEffect(() => {
		const initializeNetwork = async () => {
			if (!chain) {
				console.error('No chain detected')
				return
			}

			// Map chain ID to network name (e.g., 31337 for localhost)
			const network = chain.id === 31337 ? 'localhost' : chain.name.toLowerCase()
			setCurrentNetwork(network)

			if (addresses[network]) {
				setGovernorAddress(addresses[network].governor.address)
				setTokenAddress(addresses[network].governanceToken.address)
			} else {
				console.error(`Network ${network} not found in addresses.json`)
			}
		}

		initializeNetwork()		
	}, [chain])

	// Get total proposal count from contract
	const { data: proposalCount, refetch: refetchProposalCount } = useReadContract({
		address: governorAddress,
		abi: MyGovernor.abi,
		functionName: 'getNumberOfProposals',
		enabled: !!governorAddress,
	})

	const { data: userVotingPower, refetch: refetchVotingPower } = useReadContract({
		address: tokenAddress,
		abi: GovernanceToken.abi,
		functionName: 'getVotes',
		args: [address],
		enabled: !!tokenAddress && !!address,
	})


	useEffect(() => {
		if (userVotingPower !== undefined) {
			setVotingPower(Number(ethers.formatEther(userVotingPower)))
		}
	}, [userVotingPower])

	// Refresh voting power periodically
	useEffect(() => {
		if (tokenAddress && address) {
			// Initial fetch
			refetchVotingPower()

			// Setup interval for periodic refresh
			const interval = setInterval(() => {
				refetchVotingPower()
			}, 30000) // Every 30 seconds

			return () => clearInterval(interval)
		}
	}, [tokenAddress, address, refetchVotingPower])

	// Get the timelock period from the contract
	const { data: timelockData } = useReadContract({
		address: governorAddress,
		abi: MyGovernor.abi,
		functionName: 'getMinDelay',
		enabled: !!governorAddress,
	})

	// Set the timelock period when data is available
	useEffect(() => {
		if (timelockData) {
			setTimelockPeriod(Number(timelockData))
		}
	}, [timelockData])

	useEffect(() => {
		if (proposalCount) {
			setTotalProposals(Number(proposalCount))
		}
	}, [proposalCount])
	
	const formatTimelockPeriod = (seconds) => {
		const days = Math.floor(seconds / 86400)
		const hours = Math.floor((seconds % 86400) / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		return `${days}d ${hours}h ${minutes}m`
	}


	// Fetch proposal events using Wagmi's publicClient
	const fetchProposalEvents = useCallback(async () => {
		//console.log('Starting fetchProposalEvents')
		if (!publicClient) {
			console.error('Public client is not available')
			return
		}

		if (!governorAddress) return

		setIsLoading(true)
		try {
			// Get ProposalCreated events
			const events = await publicClient.getContractEvents({
				address: governorAddress,
				abi: MyGovernor.abi,
				eventName: 'ProposalCreated',
				fromBlock: 'earliest',
				toBlock: 'latest'
			})

			// Sort by blockNumber in descending order
			events.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber))

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

				// Get proposal ETA (execution time) if it's queued
				let eta = 0
				if (Number(state) === 5) { // 5 is 'Queued'
					try {
						eta = await publicClient.readContract({
							address: governorAddress,
							abi: MyGovernor.abi,
							functionName: 'proposalEta',
							args: [proposalId],
						})
						eta = Number(eta)
					} catch (error) {
						console.error('Error fetching proposal ETA:', error)
					}
				}

				const [title, desc] = description.split(':').map((s) => s.trim())
				return {
					id: proposalId,
					title,
					description: desc,
					state: Number(state),
					forVotes: ethers.formatEther(proposalVotes[1]),
					againstVotes: ethers.formatEther(proposalVotes[0]),
					abstainVotes: ethers.formatEther(proposalVotes[2]),
					targets,
					values,
					calldatas,
					descriptionHash: ethers.id(description),
					eta: eta					
				}
			})

			const proposalData = await Promise.all(proposalPromises)
			//console.log('Fetched proposal data:', proposalData)
			setProposals(proposalData)
			//console.log('Proposals state updated with:', proposalData)

		} catch (error) {
			console.error('Error fetching proposals:', error)
		} finally {
			setIsLoading(false)
			//console.log('Finished fetchProposalEvents')
		}
	}, [governorAddress, page, publicClient])

	// Get the current block number using Wagmi
	const { data: currentBlock } = useBlockNumber()
	
	useEffect(() => {
		if (!currentBlock || !governorAddress || !publicClient) return

		const checkProposalStatus = async () => {
			// Create a copy of the current proposals
			const proposalsToCheck = [...proposals]
			let hasUpdates = false

			// Check each proposal
			for (let i = 0; i < proposalsToCheck.length; i++) {
				const proposal = proposalsToCheck[i]

				// Only check proposals in Pending state
				if (proposal.state === 0) {
					try {
						// Get the current state from the contract
						const currentState = await publicClient.readContract({
							address: governorAddress,
							abi: MyGovernor.abi,
							functionName: 'state',
							args: [proposal.id],
						})

						const newState = Number(currentState)

						// Update proposal state if it has changed
						if (newState !== proposal.state) {
							proposalsToCheck[i] = { ...proposal, state: newState }
							hasUpdates = true
							console.log(`Proposal ${proposal.id} state updated: ${ProposalStatusMap[proposal.state]} -> ${ProposalStatusMap[newState]}`)
						}
					} catch (error) {
						console.error(`Error checking proposal ${proposal.id} state:`, error)
					}
				}
			}

			if (hasUpdates) {
				setProposals(proposalsToCheck)
			}
		}

		// Check proposal status when a new block is detected
		checkProposalStatus()
	}, [currentBlock, governorAddress, publicClient, proposals])

	// Event listeners
	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'ProposalCreated',
		onLogs() {
			
			fetchProposalEvents()
			refetchProposalCount()
		},
		enabled: !!governorAddress,
	})

	useWatchContractEvent({
		address: governorAddress,
		abi: MyGovernor.abi,
		eventName: 'VoteCast',
		onLogs(logs) {
			console.log('VoteCast event detected:', logs)
			
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
	const { writeContract: queueProposal, isPending: queueInProgress } = useWriteContract()

	// useEffect to handle executionHash updates
	useEffect(() => {
		if (executionHash) {
			//console.log('Transaction hash:', executionHash)

			const waitForReceipt = async () => {
				try {
					const receipt = await publicClient.waitForTransactionReceipt({ hash: executionHash })
					if (receipt.status === 'success') {
						//console.log('Proposal executed successfully')
						
						fetchProposalEvents()
					} else {
						console.error('Transaction failed:', receipt)
					}
				} catch (waitError) {
					console.error('Error waiting for transaction:', waitError)
				}
			}

			waitForReceipt()
		}
	}, [executionHash, publicClient, fetchProposalEvents])

	const handleVote = async (proposalId, support) => {
		try {
			await castVote({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'castVote',
				args: [proposalId, support],
			})

			// Force a refresh after vote is sent
			setTimeout(() => {
				//console.log('Vote cast, refreshing proposal data...')				
				fetchProposalEvents()
			}, 1000)
		} catch (error) {
			console.error('Error voting:', error)
		}
	}

	const handleQueue = async (proposal) => {
		try {
			await queueProposal({
				address: governorAddress,
				abi: MyGovernor.abi,
				functionName: 'queue',
				args: [proposal.targets, proposal.values, proposal.calldatas, proposal.descriptionHash],
			})

			// Force a refresh after queue transaction is sent
			setTimeout(() => {
				//console.log('Proposal queued, refreshing data...')				
				fetchProposalEvents()
			}, 1000)
		} catch (error) {
			console.error('Error queuing proposal:', error)
		}
	}

	const handleExecute = async (proposal) => {
		// Double-check if proposal can be executed with fresh timestamp
		if (!canExecuteProposal(proposal.eta, currentTime)) {
			console.error('Proposal not yet ready for execution')
			return
		}

		const argsForExecuteProposal = {
			targets: proposal.targets,
			values: proposal.values,
			calldatas: proposal.calldatas,
			descriptionHash: proposal.descriptionHash
		}
		console.log(
			"Arguments for executeProposal (JSON.stringify):",
			JSON.stringify(
				argsForExecuteProposal,
				(key, value) => (typeof value === 'bigint' ? value.toString() : value),
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

			// Force a refresh after execution transaction is sent
			setTimeout(() => {
				//console.log('Proposal execution submitted, refreshing data...')				
				fetchProposalEvents()
			}, 1000)
		} catch (error) {
			console.error('Error executing proposal:', error)
		}
	}

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


	useEffect(() => {
		if (!chain || !governorAddress) return
		if (totalProposals > 0) {
			const pollingInterval = currentNetwork === 'localhost' ? 10000 : 30000
			const interval = setInterval(fetchProposalEvents, pollingInterval)
			return () => clearInterval(interval)
		}

	}, [chain, governorAddress, fetchProposalEvents, currentNetwork, totalProposals])


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

	//console.log('Rendering ProposalList with proposals:', proposals)

	// Execute button rendering in the JSX
	const renderExecuteButton = (proposal) => {
		if (proposal.state !== 5) return null

		if (canExecuteProposal(proposal.eta)) {
			return (
				<button
					onClick={() => handleExecute(proposal)}
					className="bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600"
					disabled={executionInProgress}
				>
					Execute
				</button>
			)
		} else {
			return (
				<button
					className="bg-gray-300 text-gray-600 px-3 py-1 rounded cursor-not-allowed"
					disabled={true}
				>
					Waiting
				</button>
			)
		}
	};

console.log("proposals", proposals);

	return (
		<div className="mt-8">
			<h2 className="text-2xl font-bold mb-4">Proposals</h2>
			{votingPower === 0 && (
				<div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
					<p>You don&apos;t have any voting power. Get tokens to participate in voting.</p>
				</div>
			)}
			{timelockPeriod > 0 && (
				<p className="text-sm text-gray-600 mb-4">
					Note: After queuing, proposals must wait {formatTimelockPeriod(timelockPeriod)} before execution
				</p>
			)}
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
									{/* Updated status section with timing button */}
									<div className="flex items-center">
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
										<div className="ml-2">
											<ProposalTimingButton
												proposal={{
													...proposal,
													id: proposal.id.toString()  // Convert BigInt to string
												}}
												governorAddress={governorAddress}
											/>
										</div>
									</div>
									<div className="space-x-2">
										{proposal.state === 1 && (
											<>
												<button
													onClick={() => handleVote(proposal.id, 1)}
													className={`${votingPower > 0 ? 'bg-green-500 hover:bg-green-600' : 'bg-green-300 cursor-not-allowed'} text-white px-3 py-1 rounded`}
													disabled={votingInProgress || votingPower <= 0}
													title={votingPower <= 0 ? 'You need voting power to vote' : ''}
												>
													For
												</button>
												<button
													onClick={() => handleVote(proposal.id, 0)}
													className={`${votingPower > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-red-300 cursor-not-allowed'} text-white px-3 py-1 rounded`}
													disabled={votingInProgress || votingPower <= 0}
													title={votingPower <= 0 ? 'You need voting power to vote' : ''}
												>
													Against
												</button>
												<button
													onClick={() => handleVote(proposal.id, 2)}
													className={`${votingPower > 0 ? 'bg-gray-500 hover:bg-gray-600' : 'bg-gray-300 cursor-not-allowed'} text-white px-3 py-1 rounded`}
													disabled={votingInProgress || votingPower <= 0}
													title={votingPower <= 0 ? 'You need voting power to vote' : ''}
												>
													Abstain
												</button>
											</>
										)}
										{proposal.state === 4 && (
											<button
												onClick={() => handleQueue(proposal)}
												className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
												disabled={queueInProgress}
											>
												Queue
											</button>
										)}
										{proposal.state === 5 && renderExecuteButton(proposal)}
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

const ProposalList = () => {
	return (
		<TimingProvider>
			<ProposalListContent />
		</TimingProvider>
	)
};

export default ProposalList