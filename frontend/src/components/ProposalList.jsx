// frontend/src/components/ProposalList.jsx
import React from 'react'
import { useContractRead, useContractWrite } from 'wagmi'

const ProposalStatusMap = {
	0: 'Pending',
	1: 'Active',
	2: 'Canceled',
	3: 'Defeated',
	4: 'Succeeded',
	5: 'Queued',
	6: 'Expired',
	7: 'Executed'
}

const ProposalList = ({ proposals, governorContract, tokenContract }) => {
	const { write: castVote, isLoading: votingInProgress } = useContractWrite({
		address: governorContract.address,
		abi: governorContract.abi,
		functionName: 'castVote',
	})

	const { write: executeProposal, isLoading: executionInProgress } = useContractWrite({
		address: governorContract.address,
		abi: governorContract.abi,
		functionName: 'execute',
	})

	const handleVote = async (proposalId, support) => {
		try {
			await castVote({
				args: [proposalId, support]
			})
		} catch (error) {
			console.error("Error voting:", error)
		}
	}

	const handleExecute = async (proposal) => {
		try {
			await executeProposal({
				args: [
					proposal.targets,
					proposal.values,
					proposal.calldatas,
					proposal.descriptionHash,
				]
			})
		} catch (error) {
			console.error("Error executing proposal:", error)
		}
	}

	return (
		<div className="mt-8">
			<h2 className="text-2xl font-bold mb-4">Proposals</h2>
			{proposals.length === 0 ? (
				<p className="text-gray-500">No proposals found. Create one to get started!</p>
			) : (
				<div className="space-y-4">
					{proposals.map((proposal) => (
						<div key={proposal.id} className="bg-white p-6 rounded-lg shadow-md">
							<h3 className="text-xl font-bold">{proposal.title}</h3>
							<p className="my-2 text-gray-700">{proposal.description}</p>

							<div className="flex justify-between items-center mt-4">
								<span className={`px-3 py-1 rounded-full text-sm ${['Succeeded', 'Executed'].includes(ProposalStatusMap[proposal.state])
										? 'bg-green-100 text-green-800'
										: ['Defeated', 'Canceled', 'Expired'].includes(ProposalStatusMap[proposal.state])
											? 'bg-red-100 text-red-800'
											: 'bg-blue-100 text-blue-800'
									}`}>
									{ProposalStatusMap[proposal.state]}
								</span>

								<div className="space-x-2">
									{proposal.state === 1 && ( // Active state
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

									{proposal.state === 4 && ( // Succeeded state
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
			)}
		</div>
	)
}

export default ProposalList