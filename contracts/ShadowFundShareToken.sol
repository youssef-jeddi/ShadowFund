// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ShadowFundShareToken
 * @notice Per-fund view-only facade that satisfies the ERC-7984 read interface.
 *
 * All state-changing operations revert — depositors interact with
 * ShadowFundVault directly (which holds all encrypted state).
 *
 * Deployed by ShadowFundVault.createFund() so each fund gets its own
 * token address for wallets/explorers to pin.
 */
interface IShadowFundVaultShares {
    function shareBalanceOf(uint256 fundId, address user) external view returns (bytes32);
    function shareTotalSupply(uint256 fundId) external view returns (bytes32);
}

contract ShadowFundShareToken {
    error WriteThroughVault();

    IShadowFundVaultShares public immutable vault;
    uint256 public immutable fundId;
    string  public name;
    string  public symbol;

    constructor(
        address _vault,
        uint256 _fundId,
        string memory _name,
        string memory _symbol
    ) {
        vault  = IShadowFundVaultShares(_vault);
        fundId = _fundId;
        name   = _name;
        symbol = _symbol;
    }

    function decimals() external pure returns (uint8) {
        return 6; // mirrors cUSDC
    }

    // ── ERC-7984 read interface ────────────────────────────────────────────────

    /**
     * @notice Returns the encrypted share balance handle for `user`.
     *         Use the iExec Nox JS SDK to decrypt this value client-side.
     */
    function confidentialBalanceOf(address user) external view returns (bytes32) {
        return vault.shareBalanceOf(fundId, user);
    }

    /**
     * @notice Returns the encrypted total supply handle.
     *         Readable by the fund manager (ACL-gated) or after reveal.
     */
    function confidentialTotalSupply() external view returns (bytes32) {
        return vault.shareTotalSupply(fundId);
    }

    // ── ERC-7984 write stubs (all revert — write through the vault) ───────────

    function confidentialTransfer(address, bytes32, bytes calldata) external pure {
        revert WriteThroughVault();
    }

    function confidentialTransferFrom(address, address, bytes32, bytes calldata) external pure {
        revert WriteThroughVault();
    }

    function setOperator(address, uint48) external pure {
        revert WriteThroughVault();
    }

    function wrap(address, uint256) external pure {
        revert WriteThroughVault();
    }

    function unwrap(address, address, bytes32, bytes calldata) external pure {
        revert WriteThroughVault();
    }
}
