// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAaveDataProvider} from "./IAavePool.sol";
import {AaveAddresses} from "./AaveAddresses.sol";

/**
 * @title PriceOracle
 * @notice Thin Chainlink wrapper for ETH/USD on Arbitrum Sepolia.
 *         USDC is hardcoded at $1.00 (1e8, matching Chainlink's 8-decimal convention).
 *         Also exposes Aave v3 USDC supply APY for display.
 *
 * Asset IDs:
 *   0 = ETH
 *   1 = USDC
 *
 * ShadowFund's 2-asset basket: WETH + USDC. USDC is the only asset supplied
 * to Aave (100% of productive capital). The encrypted `wethBps` is the
 * manager's "virtual" allocation — revealed at period end, used for allocation
 * alpha scoring only.
 */
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80  roundId,
            int256  answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80  answeredInRound
        );

    function decimals() external view returns (uint8);
}

contract PriceOracle {
    uint8 public constant ETH_ID  = 0;
    uint8 public constant USDC_ID = 1;

    /// @dev Maximum age of a price feed answer before we consider it stale.
    uint256 public constant MAX_STALENESS = 86_400; // 24 hours

    AggregatorV3Interface public immutable ethFeed;

    /**
     * @param _ethFeed ETH/USD feed — Arb Sepolia: 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165
     */
    constructor(address _ethFeed) {
        require(_ethFeed != address(0), "PriceOracle: zero ETH feed");
        ethFeed = AggregatorV3Interface(_ethFeed);
    }

    /**
     * @notice Returns the latest price for the given asset (1e8 scale).
     * @param assetId 0=ETH 1=USDC
     */
    function getPrice(uint8 assetId) external view returns (int256 priceE8) {
        if (assetId == USDC_ID) {
            return 1e8; // $1.00
        }
        if (assetId == ETH_ID) {
            return _fetchEth();
        }
        revert("PriceOracle: unknown assetId");
    }

    /**
     * @notice Returns prices for both assets in a single call.
     * @return prices Array [ETH, USDC], each scaled to 1e8.
     */
    function getAllPrices() external view returns (int256[2] memory prices) {
        prices[ETH_ID]  = _fetchEth();
        prices[USDC_ID] = 1e8;
    }

    /**
     * @notice Current Aave v3 USDC supply APY in basis points.
     *         Reads liquidityRate from Aave's PoolDataProvider (RAY, 1e27,
     *         already annualised) and converts to bps.
     *
     *         This is a display helper — not consumed by reveal/alpha logic.
     *
     * @return apyBps APY in basis points (integer truncation).
     */
    function getAaveUsdcSupplyApyBps() external view returns (uint256 apyBps) {
        (
            ,,,,,
            uint256 liquidityRate,
            ,,,,,
        ) = IAaveDataProvider(AaveAddresses.POOL_DATA_PROVIDER)
                .getReserveData(AaveAddresses.USDC);
        // liquidityRate is in RAY (1e27). Convert to bps (1e4).
        apyBps = (liquidityRate * 10_000) / 1e27;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _fetchEth() internal view returns (int256) {
        (, int256 answer, , uint256 updatedAt, ) = ethFeed.latestRoundData();
        require(answer > 0, "PriceOracle: non-positive price");
        require(
            block.timestamp - updatedAt <= MAX_STALENESS,
            "PriceOracle: stale price"
        );
        return answer;
    }
}
