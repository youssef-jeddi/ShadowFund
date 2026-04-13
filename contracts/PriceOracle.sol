// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title PriceOracle
 * @notice Thin Chainlink wrapper for ETH/USD, BTC/USD, LINK/USD on Arbitrum Sepolia.
 *         USDC is hardcoded at $1.00 (1e8, matching Chainlink's 8-decimal convention).
 *
 * Asset IDs:
 *   0 = ETH
 *   1 = BTC
 *   2 = LINK
 *   3 = USDC
 *
 * IMPORTANT: Verify feed addresses on chain.link/data-feeds before deploy.
 * Testnet feeds occasionally migrate to new addresses.
 */
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}

contract PriceOracle {
    uint8 public constant ETH_ID  = 0;
    uint8 public constant BTC_ID  = 1;
    uint8 public constant LINK_ID = 2;
    uint8 public constant USDC_ID = 3;

    /// @dev Maximum age of a price feed answer before we consider it stale.
    uint256 public constant MAX_STALENESS = 86_400; // 24 hours

    AggregatorV3Interface public immutable ethFeed;
    AggregatorV3Interface public immutable btcFeed;
    AggregatorV3Interface public immutable linkFeed;

    /**
     * @param _ethFeed  ETH/USD feed — Arb Sepolia: 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165
     * @param _btcFeed  BTC/USD feed — Arb Sepolia: 0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69
     * @param _linkFeed LINK/USD feed — Arb Sepolia: 0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298
     */
    constructor(
        address _ethFeed,
        address _btcFeed,
        address _linkFeed
    ) {
        require(_ethFeed  != address(0), "PriceOracle: zero ETH feed");
        require(_btcFeed  != address(0), "PriceOracle: zero BTC feed");
        require(_linkFeed != address(0), "PriceOracle: zero LINK feed");
        ethFeed  = AggregatorV3Interface(_ethFeed);
        btcFeed  = AggregatorV3Interface(_btcFeed);
        linkFeed = AggregatorV3Interface(_linkFeed);
    }

    /**
     * @notice Returns the latest price for the given asset.
     * @param assetId  0=ETH 1=BTC 2=LINK 3=USDC
     * @return priceE8 Price scaled to 8 decimal places (Chainlink standard)
     */
    function getPrice(uint8 assetId) external view returns (int256 priceE8) {
        if (assetId == USDC_ID) {
            return 1e8; // $1.00
        }

        AggregatorV3Interface feed = _feedFor(assetId);
        (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();

        require(answer > 0, "PriceOracle: non-positive price");
        require(
            block.timestamp - updatedAt <= MAX_STALENESS,
            "PriceOracle: stale price"
        );

        return answer;
    }

    /**
     * @notice Returns prices for all 4 assets in a single call.
     * @return prices Array [ETH, BTC, LINK, USDC] prices, each scaled to 1e8.
     */
    function getAllPrices() external view returns (int256[4] memory prices) {
        uint8[3] memory ids = [ETH_ID, BTC_ID, LINK_ID];
        AggregatorV3Interface[3] memory feeds = [ethFeed, btcFeed, linkFeed];

        for (uint256 i = 0; i < 3; i++) {
            (, int256 answer, , uint256 updatedAt, ) = feeds[i].latestRoundData();
            require(answer > 0, "PriceOracle: non-positive price");
            require(
                block.timestamp - updatedAt <= MAX_STALENESS,
                "PriceOracle: stale price"
            );
            prices[ids[i]] = answer;
        }
        prices[USDC_ID] = 1e8;
    }

    function _feedFor(uint8 assetId) internal view returns (AggregatorV3Interface) {
        if (assetId == ETH_ID)  return ethFeed;
        if (assetId == BTC_ID)  return btcFeed;
        if (assetId == LINK_ID) return linkFeed;
        revert("PriceOracle: unknown assetId");
    }
}
