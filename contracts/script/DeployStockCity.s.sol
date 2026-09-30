// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {StockCityVault} from "../src/StockCityVault.sol";

contract DeployStockCity is Script {
    function run() external returns (MockUSD token, StockCityVault vault) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("-----------------------------------------");
        console.log("Deploying StockCity Contracts to BSC Testnet");
        console.log("Deployer Address:", deployer);
        console.log("Deployer Balance:", deployer.balance);
        console.log("-----------------------------------------");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSD
        token = new MockUSD();
        console.log("MockUSD Deployed At:", address(token));

        // 2. Deploy StockCityVault
        vault = new StockCityVault(address(token));
        console.log("StockCityVault Deployed At:", address(vault));

        // 3. Seed Vault with 200,000 mUSD reserves for sell payouts
        uint256 reserveAmount = 200_000 * 1e18;
        token.approve(address(vault), reserveAmount);
        vault.depositReserves(reserveAmount);
        console.log("Seeded Vault with 200,000 mUSD reserves");

        vm.stopBroadcast();

        console.log("-----------------------------------------");
        console.log("Deployment Completed Successfully!");
        console.log("Token Address: ", address(token));
        console.log("Vault Address: ", address(vault));
        console.log("-----------------------------------------");
    }
}
