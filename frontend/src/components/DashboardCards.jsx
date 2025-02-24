import React from 'react'

function DashboardCards() {
	return (
		<div className="flex flex-col sm:flex-row justify-between space-y-4 sm:space-y-0 sm:space-x-4 mt-8">
			<div className="bg-white shadow rounded-lg p-4 flex-1">
				<h2 className="text-xl font-bold text-black">PROPOSALS</h2>
				<p className="text-gray-700">1 Total proposals</p>
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
	)
}

export default DashboardCards