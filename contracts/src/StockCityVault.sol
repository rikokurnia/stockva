// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title StockCityVault — On-Chain Stock Building Position Manager
/// @notice Testnet simulation ledger. Caller-supplied prices are not an authenticated oracle.
contract StockCityVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct Position {
        bytes32 id;
        address owner;
        string ticker;
        uint256 usdCost;      // Initial USD spent (18 decimals)
        uint256 entryPrice;   // Entry price in USD (18 decimals)
        uint256 quantity;     // Remaining quantity (18 decimals)
        uint256 openedAt;     // Timestamp when position was opened
        uint8 buildingTier;   // 0: minus, 1: level 1, 2: level 2, 3: level 3
        bool active;          // True while position is still held
    }

    IERC20 public immutable paymentToken;

    mapping(bytes32 => Position) public positions;
    mapping(address => bytes32[]) private _userPositionIds;

    uint256 public totalPositionsCount;
    uint256 public totalVolumeUSD;

    event PositionOpened(
        bytes32 indexed id,
        address indexed owner,
        string ticker,
        uint256 usdCost,
        uint256 entryPrice,
        uint256 quantity,
        uint8 initialTier
    );

    event PositionTierUpdated(
        bytes32 indexed id,
        address indexed owner,
        uint8 oldTier,
        uint8 newTier
    );

    event PositionSold(
        bytes32 indexed id,
        address indexed owner,
        string ticker,
        uint256 soldQuantity,
        uint256 payoutUSD,
        int256 pnlUSD,
        uint256 fractionBps,
        bool fullyClosed
    );

    constructor(address _paymentToken) Ownable(msg.sender) {
        require(_paymentToken != address(0), "Invalid payment token");
        paymentToken = IERC20(_paymentToken);
    }

    /// @notice Buy and construct a stock building position
    /// @param ticker The company stock ticker (e.g. "NVDA", "TSLA")
    /// @param usdAmount The USD amount to invest (18 decimals)
    /// @param entryPrice The current market entry price (18 decimals)
    /// @param initialTier The starting visual building tier (usually 1 for level_1)
    function buyPosition(
        string calldata ticker,
        uint256 usdAmount,
        uint256 entryPrice,
        uint8 initialTier
    ) external nonReentrant returns (bytes32 positionId) {
        require(bytes(ticker).length > 0, "Ticker cannot be empty");
        require(usdAmount > 0, "Amount must be greater than 0");
        require(entryPrice > 0, "Entry price must be greater than 0");
        require(initialTier <= 3, "Invalid tier level");

        // Transfer payment token from user to vault
        paymentToken.safeTransferFrom(msg.sender, address(this), usdAmount);

        positionId = _openPosition(msg.sender, ticker, usdAmount, entryPrice, initialTier);
    }

    /// @notice Demo-friendly batch buy: record many stock buildings in ONE tx
    /// @dev Place freely in the UI, then confirm everything with one signature.
    function buyPositionsBatch(
        string[] calldata tickers,
        uint256[] calldata usdAmounts,
        uint256[] calldata entryPrices,
        uint8[] calldata initialTiers
    ) external nonReentrant returns (bytes32[] memory positionIds) {
        uint256 n = tickers.length;
        require(n > 0, "Empty batch");
        require(n <= 50, "Batch too large");
        require(
            usdAmounts.length == n &&
                entryPrices.length == n &&
                initialTiers.length == n,
            "Array length mismatch"
        );

        uint256 totalCost = 0;
        for (uint256 i = 0; i < n; i++) {
            require(bytes(tickers[i]).length > 0, "Ticker cannot be empty");
            require(usdAmounts[i] > 0, "Amount must be greater than 0");
            require(entryPrices[i] > 0, "Entry price must be greater than 0");
            require(initialTiers[i] <= 3, "Invalid tier level");
            totalCost += usdAmounts[i];
        }

        // Single transfer for the whole batch (one approval covers it)
        paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);

        positionIds = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) {
            positionIds[i] = _openPosition(
                msg.sender,
                tickers[i],
                usdAmounts[i],
                entryPrices[i],
                initialTiers[i]
            );
        }
    }

    function _openPosition(
        address owner,
        string calldata ticker,
        uint256 usdAmount,
        uint256 entryPrice,
        uint8 initialTier
    ) internal returns (bytes32 positionId) {
        // Calculate position quantity: (usdAmount * 1e18) / entryPrice
        uint256 quantity = (usdAmount * 1e18) / entryPrice;
        require(quantity > 0, "Calculated quantity too small");

        // Generate deterministic, unique position ID
        positionId = keccak256(
            abi.encodePacked(
                owner,
                ticker,
                block.timestamp,
                _userPositionIds[owner].length,
                totalPositionsCount
            )
        );

        positions[positionId] = Position({
            id: positionId,
            owner: owner,
            ticker: ticker,
            usdCost: usdAmount,
            entryPrice: entryPrice,
            quantity: quantity,
            openedAt: block.timestamp,
            buildingTier: initialTier,
            active: true
        });

        _userPositionIds[owner].push(positionId);
        totalPositionsCount++;
        totalVolumeUSD += usdAmount;

        emit PositionOpened(
            positionId,
            owner,
            ticker,
            usdAmount,
            entryPrice,
            quantity,
            initialTier
        );
    }

    /// @notice Update the building visual tier on-chain based on RWA performance
    /// @param positionId The ID of the position
    /// @param newTier The new visual tier (0: minus, 1: level 1, 2: level 2, 3: level 3)
    function updateTier(bytes32 positionId, uint8 newTier) external {
        Position storage pos = positions[positionId];
        require(pos.active, "Position is not active");
        require(
            msg.sender == pos.owner || msg.sender == owner(),
            "Not authorized to update tier"
        );
        require(newTier <= 3, "Invalid tier level");

        uint8 oldTier = pos.buildingTier;
        pos.buildingTier = newTier;

        emit PositionTierUpdated(positionId, pos.owner, oldTier, newTier);
    }

    /// @notice Partially or fully liquidate a position
    /// @param positionId The ID of the position to sell
    /// @param currentPrice Caller-supplied simulation price (18 decimals); never safe for real collateral
    /// @param fractionBps Basis points to sell (1 to 10000, where 10000 = 100%)
    function sellPosition(
        bytes32 positionId,
        uint256 currentPrice,
        uint256 fractionBps
    ) external nonReentrant returns (uint256 payout) {
        Position storage pos = positions[positionId];
        require(pos.active, "Position is not active");
        require(pos.owner == msg.sender, "Only position owner can sell");
        require(fractionBps > 0 && fractionBps <= 10000, "Invalid fraction bps");
        require(currentPrice > 0, "Invalid current price");
        payout = _executeSale(pos, currentPrice, fractionBps);
    }

    /// @notice One-signature rebalance: close positions and open new ones in ONE tx.
    /// @dev Sells settle first (plan order), then a single pull funds all buys.
    /// Any plain EOA wallet signs once — no EIP-7702 atomic batching required.
    struct RebalanceBuy {
        string ticker;
        uint256 usdAmount;
        uint256 entryPrice;
        uint8 initialTier;
    }

    function rebalanceBatch(
        bytes32[] calldata sellIds,
        uint256[] calldata sellPrices,
        RebalanceBuy[] calldata buys
    ) external nonReentrant returns (bytes32[] memory positionIds) {
        uint256 sells = sellIds.length;
        uint256 n = buys.length;
        require(sells + n > 0, "Empty rebalance");
        require(sells <= 16, "Too many sells");
        require(n <= 50, "Too many buys");
        require(sellPrices.length == sells, "Sell array mismatch");

        for (uint256 i = 0; i < sells; i++) {
            require(sellPrices[i] > 0, "Invalid current price");
        }
        _closePositions(sellIds, sellPrices);

        uint256 totalCost = 0;
        for (uint256 i = 0; i < n; i++) {
            require(bytes(buys[i].ticker).length > 0, "Ticker cannot be empty");
            require(buys[i].usdAmount > 0, "Amount must be greater than 0");
            require(buys[i].entryPrice > 0, "Entry price must be greater than 0");
            require(buys[i].initialTier <= 3, "Invalid tier level");
            totalCost += buys[i].usdAmount;
        }

        positionIds = new bytes32[](n);
        if (totalCost > 0) {
            // Single pull for the whole rebalance (one approval covers it)
            paymentToken.safeTransferFrom(msg.sender, address(this), totalCost);
            for (uint256 i = 0; i < n; i++) {
                positionIds[i] = _openPosition(
                    msg.sender,
                    buys[i].ticker,
                    buys[i].usdAmount,
                    buys[i].entryPrice,
                    buys[i].initialTier
                );
            }
        }
    }

    /// @notice Full-close every listed position. Split out to avoid stack pressure.
    function _closePositions(
        bytes32[] calldata sellIds,
        uint256[] calldata sellPrices
    ) internal {
        for (uint256 i = 0; i < sellIds.length; i++) {
            Position storage pos = positions[sellIds[i]];
            require(pos.active, "Position is not active");
            require(pos.owner == msg.sender, "Only position owner can sell");
            _executeSale(pos, sellPrices[i], 10000);
        }
    }

    /// @notice Shared sale settlement: identical math + events for single and batch sells.
    function _executeSale(
        Position storage pos,
        uint256 currentPrice,
        uint256 fractionBps
    ) internal returns (uint256 payout) {
        uint256 soldQuantity = (pos.quantity * fractionBps) / 10000;
        require(soldQuantity > 0, "Sold quantity too small");

        // Calculate payout: (soldQuantity * currentPrice) / 1e18
        payout = (soldQuantity * currentPrice) / 1e18;
        uint256 costBasis = (soldQuantity * pos.entryPrice) / 1e18;

        // Update position remaining quantity
        pos.quantity -= soldQuantity;
        bool fullyClosed = (pos.quantity == 0);
        if (fullyClosed) {
          pos.active = false;
        }

        // Payout to user (capped at vault balance in testnet reserves)
        uint256 vaultBal = paymentToken.balanceOf(address(this));
        uint256 actualPayout = payout > vaultBal ? vaultBal : payout;
        if (actualPayout > 0) {
            paymentToken.safeTransfer(msg.sender, actualPayout);
        }
        payout = actualPayout;
        int256 pnl = int256(actualPayout) - int256(costBasis);

        emit PositionSold(
            pos.id,
            msg.sender,
            pos.ticker,
            soldQuantity,
            payout,
            pnl,
            fractionBps,
            fullyClosed
        );
    }

    /// @notice Get all position IDs for a user
    function getUserPositionIds(address user) external view returns (bytes32[] memory) {
        return _userPositionIds[user];
    }

    /// @notice Get all active Position details for a user
    function getUserPositions(address user) external view returns (Position[] memory) {
        bytes32[] memory ids = _userPositionIds[user];
        Position[] memory result = new Position[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = positions[ids[i]];
        }
        return result;
    }

    /// @notice Owner reserve deposit for testnet vault liquidity
    function depositReserves(uint256 amount) external {
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
    }
}
