// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
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

    function test_PartialAndFullLiquidation() public {        vm.startPrank(alice);
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

    function test_BatchBuyRecordsManyPositionsInOneTx() public {
        vm.startPrank(alice);
        token.claimFaucet();

        string[] memory tickers = new string[](3);
        tickers[0] = "NVDA";
        tickers[1] = "TSLA";
        tickers[2] = "AMZN";
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 500 * 1e18;
        amounts[1] = 300 * 1e18;
        amounts[2] = 200 * 1e18;
        uint256[] memory prices = new uint256[](3);
        prices[0] = 14287 * 1e16;
        prices[1] = 24850 * 1e16;
        prices[2] = 22432 * 1e16;
        uint8[] memory tiers = new uint8[](3);
        tiers[0] = 1;
        tiers[1] = 1;
        tiers[2] = 1;

        // Single approval covers the whole batch
        token.approve(address(vault), 1000 * 1e18);
        bytes32[] memory ids = vault.buyPositionsBatch(tickers, amounts, prices, tiers);

        assertEq(ids.length, 3);
        assertEq(vault.totalPositionsCount(), 3);
        assertEq(vault.totalVolumeUSD(), 1000 * 1e18);
        assertEq(token.balanceOf(alice), 9_000 * 1e18);

        StockCityVault.Position[] memory list = vault.getUserPositions(alice);
        assertEq(list.length, 3);
        assertEq(list[0].ticker, "NVDA");
        assertEq(list[1].ticker, "TSLA");
        assertEq(list[2].ticker, "AMZN");
        vm.stopPrank();
    }

    function test_BatchBuyRejectsBadInput() public {
        vm.startPrank(alice);
        token.claimFaucet();
        token.approve(address(vault), 1000 * 1e18);

        string[] memory tickers = new string[](2);
        tickers[0] = "NVDA";
        tickers[1] = "TSLA";
        uint256[] memory oneAmount = new uint256[](1);
        oneAmount[0] = 100 * 1e18;
        uint256[] memory prices = new uint256[](2);
        prices[0] = 100 * 1e18;
        prices[1] = 100 * 1e18;
        uint8[] memory tiers = new uint8[](2);
        tiers[0] = 1;
        tiers[1] = 1;

        vm.expectRevert("Array length mismatch");
        vault.buyPositionsBatch(tickers, oneAmount, prices, tiers);

        uint8[] memory badTier = new uint8[](2);
        badTier[0] = 1;
        badTier[1] = 9;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 1e18;
        amounts[1] = 100 * 1e18;
        vm.expectRevert("Invalid tier level");
        vault.buyPositionsBatch(tickers, amounts, prices, badTier);

        vm.expectRevert("Empty batch");
        vault.buyPositionsBatch(
            new string[](0),
            new uint256[](0),
            new uint256[](0),
            new uint8[](0)
        );
        vm.stopPrank();
    }

    function test_OnlyOwnerCanSellOrUpdatePosition() public {
        vm.startPrank(alice);
        token.claimFaucet();
        token.approve(address(vault), 500e18);
        bytes32 id = vault.buyPosition("NVDA", 500e18, 100e18, 1);
        vm.stopPrank();
        vm.startPrank(bob);
        vm.expectRevert("Only position owner can sell");
        vault.sellPosition(id, 100e18, 10000);
        vm.expectRevert("Not authorized to update tier");
        vault.updateTier(id, 3);
        vm.stopPrank();
        assertEq(vault.getUserPositions(alice)[0].quantity, 5e18);
    }

    function test_CappedSaleReturnsAndEmitsActualTransferredPayout() public {
        vm.startPrank(alice);
        token.claimFaucet();
        token.approve(address(vault), 500e18);
        bytes32 id = vault.buyPosition("NVDA", 500e18, 100e18, 1);
        uint256 reserves = token.balanceOf(address(vault));
        uint256 before = token.balanceOf(alice);
        vm.recordLogs();
        uint256 paid = vault.sellPosition(id, 1_000_000e18, 10000);
        assertEq(paid, reserves);
        assertEq(token.balanceOf(alice) - before, paid);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool found;
        for (uint256 i; i < logs.length; i++) {
            if (logs[i].emitter != address(vault)) continue;
            (string memory ticker, uint256 quantity, uint256 payout, int256 pnl, uint256 bps, bool closed) =
                abi.decode(logs[i].data, (string, uint256, uint256, int256, uint256, bool));
            assertEq(ticker, "NVDA");
            assertEq(quantity, 5e18);
            assertEq(payout, paid);
            assertEq(pnl, int256(paid) - int256(500e18));
            assertEq(bps, 10000);
            assertTrue(closed);
            found = true;
        }
        assertTrue(found);
        vm.expectRevert("Position is not active");
        vault.sellPosition(id, 100e18, 10000);
        vm.stopPrank();
    }

    function testFuzz_PartialSaleConservesQuantityAndPayout(uint16 fraction) public {
        uint256 bps = bound(uint256(fraction), 1, 9999);
        vm.startPrank(alice);
        token.claimFaucet();
        token.approve(address(vault), 1000e18);
        bytes32 id = vault.buyPosition("NVDA", 1000e18, 100e18, 1);
        uint256 before = token.balanceOf(alice);
        uint256 first = vault.sellPosition(id, 150e18, bps);
        StockCityVault.Position memory remaining = vault.getUserPositions(alice)[0];
        assertEq(remaining.quantity, 10e18 - (10e18 * bps / 10000));
        assertTrue(remaining.active);
        uint256 second = vault.sellPosition(id, 150e18, 10000);
        assertEq(first + second, 1500e18);
        assertEq(token.balanceOf(alice) - before, 1500e18);
        assertFalse(vault.getUserPositions(alice)[0].active);
        vm.stopPrank();
    }

    function test_RebalanceBatchClosesAndOpensInOneTx() public {
        vm.startPrank(alice);
        token.claimFaucet();
        token.approve(address(vault), 1000e18);
        bytes32 sellA = vault.buyPosition("AMZN", 300e18, 100e18, 1);
        bytes32 sellB = vault.buyPosition("MSFT", 200e18, 100e18, 1);
        assertEq(token.balanceOf(alice), 9500e18);

        bytes32[] memory sellIds = new bytes32[](2);
        sellIds[0] = sellA;
        sellIds[1] = sellB;
        uint256[] memory sellPrices = new uint256[](2);
        sellPrices[0] = 110e18;
        sellPrices[1] = 120e18;

        StockCityVault.RebalanceBuy[] memory buys = new StockCityVault.RebalanceBuy[](2);
        buys[0] = StockCityVault.RebalanceBuy("NVDA", 400e18, 100e18, 1);
        buys[1] = StockCityVault.RebalanceBuy("TSLA", 300e18, 100e18, 1);

        // One approval covers the buys; sells pay out first in the same tx.
        token.approve(address(vault), 700e18);
        bytes32[] memory opened = vault.rebalanceBatch(sellIds, sellPrices, buys);
        assertEq(opened.length, 2);

        StockCityVault.Position[] memory list = vault.getUserPositions(alice);
        assertEq(list.length, 4);
        assertFalse(list[0].active);
        assertFalse(list[1].active);
        assertTrue(list[2].active);
        assertTrue(list[3].active);
        assertEq(list[2].ticker, "NVDA");
        assertEq(list[3].ticker, "TSLA");
        // 9500 - 700 buys + 330 + 240 sell proceeds = 9370
        assertEq(token.balanceOf(alice), 9370e18);
        vm.stopPrank();
    }

    function test_RebalanceBatchSellsOnly() public {
        vm.startPrank(alice);
        token.claimFaucet();
        token.approve(address(vault), 500e18);
        bytes32 id = vault.buyPosition("NVDA", 500e18, 100e18, 1);

        bytes32[] memory sellIds = new bytes32[](1);
        sellIds[0] = id;
        uint256[] memory sellPrices = new uint256[](1);
        sellPrices[0] = 150e18;
        StockCityVault.RebalanceBuy[] memory buys = new StockCityVault.RebalanceBuy[](0);

        vault.rebalanceBatch(sellIds, sellPrices, buys);
        assertFalse(vault.getUserPositions(alice)[0].active);
        assertEq(token.balanceOf(alice), 9500e18 + 750e18);
        vm.stopPrank();
    }

    function test_RebalanceBatchRejectsBadInput() public {
        vm.startPrank(alice);
        token.claimFaucet();
        token.approve(address(vault), 1000e18);
        bytes32 id = vault.buyPosition("NVDA", 500e18, 100e18, 1);

        bytes32[] memory sellIds = new bytes32[](1);
        sellIds[0] = id;
        uint256[] memory sellPrices = new uint256[](1);
        sellPrices[0] = 150e18;
        StockCityVault.RebalanceBuy[] memory empty = new StockCityVault.RebalanceBuy[](0);

        // Non-owner cannot close someone else's position.
        vm.stopPrank();
        vm.startPrank(bob);
        vm.expectRevert("Only position owner can sell");
        vault.rebalanceBatch(sellIds, sellPrices, empty);
        vm.stopPrank();

        // Empty rebalance and length mismatch revert.
        vm.startPrank(alice);
        vm.expectRevert("Empty rebalance");
        vault.rebalanceBatch(new bytes32[](0), new uint256[](0), empty);
        uint256[] memory badPrices = new uint256[](2);
        badPrices[0] = 150e18;
        badPrices[1] = 150e18;
        vm.expectRevert("Sell array mismatch");
        vault.rebalanceBatch(sellIds, badPrices, empty);
        vm.stopPrank();
    }
}
