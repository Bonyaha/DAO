import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import MyGovernor from '../artifacts/contracts/MyGovernor.sol/MyGovernor.json';
import addresses from '../addresses.json';

function DashboardCards() {
  const [proposalCount, setProposalCount] = useState(0);
  
  useEffect(() => {
    const setupContract = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        const networkName = network.name === 'unknown' ? 'localhost' : network.name;
        const governorAddress = addresses[networkName].governor.address;
        const signer = await provider.getSigner();
        const newContract = new ethers.Contract(governorAddress, MyGovernor.abi, signer);        

				const fetchProposalCount = async () => {
					try {
						const count = await newContract.getNumberOfProposals()
						console.log(count)
						setProposalCount(count.toString())
					} catch (error) {
						console.error('Error fetching proposal count:', error)
					}
				}

				fetchProposalCount() // Initial fetch

        // Listen for ProposalCreated event
        newContract.on('ProposalCreated', () => {
          fetchProposalCount();
        });

        // Clean up event listener
        return () => {
          newContract.removeAllListeners('ProposalCreated');
        };
      } catch (error) {
        console.error('Error setting up contract:', error);
      }
    };

    setupContract();
  }, []);
  

  return (
    <div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
      <div className="bg-white shadow rounded-lg p-4 flex-1">
        <h2 className="text-xl font-bold text-black">PROPOSALS</h2>
        <p className="text-gray-700">{proposalCount} Total proposals</p>
        <p className="text-gray-500">PARTICIPATE AND PROPOSE NOW</p>
      </div>
      <div className="bg-white shadow rounded-lg p-4 flex-1">
        <h2 className="text-xl font-bold text-black">ELIGIBLE VOTERS</h2>
        <p className="text-gray-700">1 Total Voters</p>
        <p className="text-gray-500">JOIN THE DAO NOW AND BECOME ONE</p>
      </div>
      <div className="bg-white shadow rounded-lg p-4 flex-1">
        <h2 className="text-xl font-bold text-black">YOUR VOTING POWER</h2>
        <p className="text-3xl font-bold text-black">0</p>
        <p className="text-gray-500">BASED ON YOUR TOKEN BALANCE</p>
      </div>
    </div>
  );
}

export default DashboardCards;