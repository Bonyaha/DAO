// frontend/src/components/ProposalForm.jsx
import React, { useState } from 'react'
import { useAccount, useContractWrite } from 'wagmi'
import { ethers } from 'ethers'

const ProposalForm = (/* { governorContract, refreshProposals } */) => {
	/* const [title, setTitle] = useState('')
	const [description, setDescription] = useState('')
	const [executionValue, setExecutionValue] = useState('0')
	const [targetAddress, setTargetAddress] = useState('')
	const [calldata, setCalldata] = useState('')
	const { address } = useAccount()

	const { write: createProposal, isLoading } = useContractWrite({
		address: governorContract.address,
		abi: governorContract.abi,
		functionName: 'propose',
	})

	const handleSubmit = async (e) => {
		e.preventDefault()

		try {
			const targets = [targetAddress]
			const values = [ethers.parseEther(executionValue)]
			const calldatas = [calldata]
			const description = `${title}\\n\\n${description}`

			await createProposal({
				args: [targets, values, calldatas, description]
			})

			refreshProposals()
			// Reset form
			setTitle('')
			setDescription('')
			setExecutionValue('0')
			setTargetAddress('')
			setCalldata('')
		} catch (error) {
			console.error("Error creating proposal:", error)
		}
	} */

	return (
		<div className="bg-white p-6 rounded-lg shadow-md">
			<h2 className="text-2xl font-bold mb-4">Create New Proposal</h2>
			{/* <form onSubmit={handleSubmit}>
				<div className="mb-4">
					<label className="block text-gray-700 mb-2">Title</label>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="w-full p-2 border rounded"
						required
					/>
				</div>

				<div className="mb-4">
					<label className="block text-gray-700 mb-2">Description</label>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="w-full p-2 border rounded"
						rows="4"
						required
					/>
				</div>

				<div className="mb-4">
					<label className="block text-gray-700 mb-2">Target Address</label>
					<input
						type="text"
						value={targetAddress}
						onChange={(e) => setTargetAddress(e.target.value)}
						className="w-full p-2 border rounded"
						placeholder="0x..."
						required
					/>
				</div>

				<div className="mb-4">
					<label className="block text-gray-700 mb-2">Value (ETH)</label>
					<input
						type="number"
						value={executionValue}
						onChange={(e) => setExecutionValue(e.target.value)}
						className="w-full p-2 border rounded"
						min="0"
						step="0.001"
					/>
				</div>

				<div className="mb-4">
					<label className="block text-gray-700 mb-2">Calldata (hex)</label>
					<input
						type="text"
						value={calldata}
						onChange={(e) => setCalldata(e.target.value)}
						className="w-full p-2 border rounded"
						placeholder="0x..."
					/>
				</div>

				<button
					type="submit"
					className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
					disabled={isLoading}
				>
					{isLoading ? 'Submitting...' : 'Create Proposal'}
				</button>
			</form> */}
		</div>
	)
}

export default ProposalForm
