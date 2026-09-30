// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSD — Demo Funds Token for StockCity
/// @notice An ERC-20 token representing Demo USD with a built-in public faucet for testing
contract MockUSD is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 10_000 * 1e18; // 10,000 mUSD
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastFaucetClaim;

    event FaucetClaimed(address indexed recipient, uint256 amount);

    constructor() ERC20("Stockva Demo USD", "mUSD") Ownable(msg.sender) {
        // Mint initial reserve to deployer
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    /// @notice Free demo funds faucet for testing
    function claimFaucet() external {
        if (lastFaucetClaim[msg.sender] != 0) {
            require(
                block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
                "Faucet cooldown active. Try again later."
            );
        }
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Free faucet for direct recipient targeting without cooldown (dev/admin)
    function dispense(address to, uint256 amount) external {
        require(to != address(0), "Invalid recipient");
        _mint(to, amount);
        emit FaucetClaimed(to, amount);
    }

    /// @notice Owner mint function for seeding testnet vaults
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        _mint(to, amount);
    }
}
