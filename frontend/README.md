# DAO Frontend

This is the frontend application for the DAO project. It provides a user interface for interacting with the DAO smart contracts, participating in governance, and managing DAO-related activities.

## Purpose
The frontend allows users to:
- Connect their Ethereum wallet (e.g., MetaMask)
- Claim governance tokens
- Delegate voting power
- View dashboard statistics (proposals, eligible voters, voting power)
- Create and view proposals
- Vote on proposals
- Cancel pending proposals (if eligible)

## Main Features
- Wallet connection and authentication
- Real-time dashboard for DAO statistics
- Proposal creation and management
- Token claiming and delegation
- Transaction status and error handling
- Responsive and modern UI with Tailwind CSS

## Tools & Technologies
- **React**: UI library for building the application
- **Vite**: Fast build tool and development server
- **Wagmi & Viem**: React hooks and utilities for Ethereum/web3 interactions
- **Ethers.js**: Ethereum blockchain interaction
- **Tailwind CSS**: Utility-first CSS framework
- **React Query**: Data fetching and caching
- **ESLint**: Linting and code quality

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure
- `src/` — Main source code
  - `components/` — React components (dashboard, proposals, wallet, etc.)
  - `artifacts/` — Compiled contract ABIs
  - `App.jsx` — Main application logic

## Original Vite/React Template Info

This project was bootstrapped with the Vite React template. See below for original template details:

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
