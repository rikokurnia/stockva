// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MockUSD} from "../src/MockUSD.sol";
import {StockCityVault} from "../src/StockCityVault.sol";

contract StockCityTest is Test {
    MockUSD public token;
    StockCityVault public vault;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    function setUp() public {
        token = new MockUSD();
        vault = new StockCityVault(address(token));

        // Seed vault with initial reserves from deployer
        token.approve(address(vault), 100_000 * 1e18);
        vault.depositReserves(100_000 * 1e18);
    }

    function test_FaucetMinting() public {
        vm.startPrank(alice);
        token.claimFaucet();
        assertEq(token.balanceOf(alice), 10_000 * 1e18);

        // Immediate second claim should revert due to cooldown
        vm.expectRevert("Faucet cooldown active. Try again later.");
        token.claimFaucet();

        // Warp 1 hour forward
        vm.warp(block.timestamp + 1 hours + 1 seconds);
        token.claimFaucet();
        assertEq(token.balanceOf(alice), 20_000 * 1e18);
        vm.stopPrank();
    }

    function test_BuyPosition() public {
        vm.startPrank(alice);
        token.claimFaucet();

        uint256 buyAmount = 500 * 1e18; // $500
        uint256 nvdaPrice = 14287 * 1e16; // $142.87

        token.approve(address(vault), buyAmount);
        bytes32 posId = vault.buyPosition("NVDA", buyAmount, nvdaPrice, 1);

        assertNotEq(posId, bytes32(0));
        assertEq(token.balanceOf(alice), 9_500 * 1e18);

        StockCityVault.Position memory pos = vault.getUserPositions(alice)[0];
        assertEq(pos.ticker, "NVDA");
        assertEq(pos.usdCost, buyAmount);
        assertEq(pos.entryPrice, nvdaPrice);
        assertEq(pos.buildingTier, 1);
        assertTrue(pos.active);
        vm.stopPrank();
    }

    function test_UpdateBuildingTier() public {
        vm.startPrank(alice);
        token.claimFaucet();

        uint256 buyAmount = 1000 * 1e18;
        uint256 price = 100 * 1e18;

        token.approve(address(vault), buyAmount);
        bytes32 posId = vault.buyPosition("TSLA", buyAmount, price, 1);

        // Update tier to Level 2 (e.g. +5% milestone reached)
        vault.updateTier(posId, 2);
        assertEq(vault.getUserPositions(alice)[0].buildingTier, 2);

        // Update tier to Level 3 (e.g. +15% milestone reached)
        vault.updateTier(posId, 3);
        assertEq(vault.getUserPositions(alice)[0].buildingTier, 3);
        vm.stopPrank();
    }

    function test_PartialAndFullLiquidation() public {
        vm.startPrank(alice);
        token.claimFaucet();

        uint256 buyAmount = 1000 * 1e18; // $1000 invested
        uint256 entryPrice = 100 * 1e18; // $100 per share -> 10 shares

        token.approve(address(vault), buyAmount);
        bytes32 posId = vault.buyPosition("AMZN", buyAmount, entryPrice, 1);

        // Price rises to $150 (+50%)
        uint256 newPrice = 150 * 1e18;

        // Sell 50% (5000 bps)
        uint256 payout = vault.sellPosition(posId, newPrice, 5000);
        // 5 shares * $150 = $750 payout
        assertEq(payout, 750 * 1e18);
        assertEq(token.balanceOf(alice), 9_000 * 1e18 + 750 * 1e18);

        StockCityVault.Position memory pos = vault.getUserPositions(alice)[0];
        assertTrue(pos.active);
        assertEq(pos.quantity, 5 * 1e18); // 5 shares remaining

        // Sell remaining 100% of remaining position
        uint256 finalPayout = vault.sellPosition(posId, newPrice, 10000);
        assertEq(finalPayout, 750 * 1e18);

        StockCityVault.Position memory closedPos = vault.getUserPositions(alice)[0];
        assertFalse(closedPos.active);
        assertEq(closedPos.quantity, 0);
        vm.stopPrank();
    }
}
