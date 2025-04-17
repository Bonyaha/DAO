/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi'
import { BaseError, encodeFunctionData, decodeEventLog } from 'viem'
import { ethers } from 'ethers'
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json'
import addresses from '../addresses.json'

function ProposalForm({ onClose, onSuccess }) {
  const [boxAddress, setBoxAddress] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showError, setShowError] = useState(false)
  const [governorAddress, setGovernorAddress] = useState('')

  const { chain } = useAccount()

  // Get contract addresses from addresses.json based on connected network
  const { writeContract, data: proposeTxHash } = useWriteContract()

  //console.log(`proposeTxHash: ${proposeTxHash}`)

  // Track transaction status
  const { isLoading: isTxLoading, isSuccess: isTxSuccess, data: txReceiptData } =
    useWaitForTransactionReceipt({
      hash: proposeTxHash,
      enabled: !!proposeTxHash,
    })

  // Initialize network and contract addresses
  useEffect(() => {
    const initializeNetwork = async () => {
      if (!chain) {
        console.error('No chain detected')
        return
      }
      try {
        const network = chain.id === 31337 ? 'localhost' : chain.name.toLowerCase()

        if (addresses[network]) {
          setBoxAddress(addresses[network].box.address)
          setGovernorAddress(addresses[network].governor.address)
        }
      } catch (error) {
        console.error('Error initializing addresses:', error)
      }
    }

    initializeNetwork()
  }, [chain])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!boxAddress || !targetValue || !description) {
      setErrorMessage('Please fill in all required fields')
      setShowError(true)
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage('')
      setShowError(false)

      // Create proposal to call Box.store(value)
      const functionToCall = "store"
      const encodedFunctionCall = encodeFunctionData({
        abi: [
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "newValue",
                "type": "uint256"
              }
            ],
            "name": "store",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
          }
        ],
        functionName: functionToCall,
        args: [targetValue]
      })

      writeContract({
        address: governorAddress,
        abi: MyGovernor.abi,
        functionName: 'propose',
        args: [
          [boxAddress],       // targets (contract to call)
          [0],                // values (no ETH to send)
          [encodedFunctionCall], // calldata (encoded function call)
          description          // description
        ],
      })
    } catch (error) {
      console.error('Error submitting proposal:', error)

      let message = 'Failed to submit proposal'
      if (error instanceof BaseError) {
        message = error.message || message
      }

      setErrorMessage(message)
      setShowError(true)
      setIsSubmitting(false)
    }
  }

  // Handle successful transaction
  useEffect(() => {
    if (isTxSuccess && proposeTxHash) {
      // First get the transaction receipt to extract the proposal ID from events
      const getProposalId = async () => {
        try {
          const receipt = txReceiptData
          console.log(receipt)

          const log = receipt.logs.find(
            (log) => log.address.toLowerCase() === governorAddress.toLowerCase()
          )
          if (!log) {
            throw new Error('No log found for the governor contract')
          }
          const decodedLog = decodeEventLog({
            abi: MyGovernor.abi,
            data: log.data,
            topics: log.topics,
          })
          const proposalId = decodedLog.args.proposalId
          const targets = decodedLog.args.targets
          const values = decodedLog.args.values
          const calldatas = decodedLog.args.calldatas

          const [title, desc] = description.split(':').map((s) => s.trim())

          const newProposal = {
            id: proposalId,
            title,
            description: desc,
            state: 0, // Initial state is Pending (0)
            targets,
            values,
            calldatas,
            descriptionHash: ethers.id(description)
          };


          setIsSubmitting(false)
          if (onSuccess) onSuccess(newProposal)
          if (onClose) onClose()
        } catch (error) {
          console.error('Error getting proposal ID:', error)
          setIsSubmitting(false)
        }
      }

      getProposalId()
    }
  }, [isTxSuccess, proposeTxHash, onSuccess, onClose, governorAddress, txReceiptData, description])

  const closeError = () => setShowError(false)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Create New Proposal</h2>

        {/* Error Alert */}
        {showError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 rounded relative">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{errorMessage}</span>
            <span
              className="absolute top-0 bottom-0 right-0 px-4 py-3 cursor-pointer"
              onClick={closeError}
            >
              <span className="text-red-500">×</span>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="target-value">
              New Box Value
            </label>
            <input
              id="target-value"
              type="number"
              className="w-full p-2 border rounded"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Enter a new value to store"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="description">
              Proposal Description
            </label>
            <textarea
              id="description"
              className="w-full p-2 border rounded"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your proposal"
              rows="4"
            />
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isTxLoading}
              className="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isSubmitting || isTxLoading ? 'Submitting...' : 'Submit Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProposalForm