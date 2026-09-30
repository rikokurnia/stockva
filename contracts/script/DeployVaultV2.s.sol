// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {StockCityVault} from "../src/StockCityVault.sol";

/// @notice Deploy a new StockCityVault (with batch buy) against the existing
/// MockUSD, and seed it with reserves. Reuses token + faucet.
contract DeployVaultV2 is Script {
    address internal constant MOCK_USD =
        0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21;

    function run() external returns (StockCityVault vault) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        vault = new StockCityVault(MOCK_USD);
        console.log("StockCityVault V2 deployed at:", address(vault));

        uint256 reserveAmount = 200_000 * 1e18;
        MockUSD(MOCK_USD).approve(address(vault), reserveAmount);
        vault.depositReserves(reserveAmount);
        console.log("Seeded vault with 200,000 mUSD");

        vm.stopBroadcast();
    }
}
