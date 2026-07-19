// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockToken.sol";
import "./MockDEX.sol";

contract MultiSwapRouter {
    address public dexAddress;

    event RebalanceExecuted(address indexed user, uint256 totalSwaps);

    constructor(address _dexAddress) {
        dexAddress = _dexAddress;
    }

    receive() external payable {}

    // Rebalance function: swap multiple source tokens into MON
    function rebalanceToMON(
        address[] calldata tokensIn,
        uint256[] calldata amountsIn,
        uint256[] calldata minMONOut
    ) external returns (uint256 totalMONReturned) {
        require(tokensIn.length == amountsIn.length && tokensIn.length == minMONOut.length, "Router: Array length mismatch");

        MockDEX dex = MockDEX(payable(dexAddress));

        for (uint256 i = 0; i < tokensIn.length; i++) {
            address token = tokensIn[i];
            uint256 amount = amountsIn[i];
            
            if (amount == 0) continue;

            // Pull tokens from user (requires user to have approved this router contract)
            require(
                IERC20(token).transferFrom(msg.sender, address(this), amount),
                "Router: TransferFrom failed"
            );

            // Approve MockDEX to spend tokens
            require(
                IERC20(token).approve(dexAddress, amount),
                "Router: Approve failed"
            );

            // Swap tokens for MON
            uint256 monOut = dex.swapTokenForMON(token, amount, minMONOut[i]);
            totalMONReturned += monOut;
        }

        // Send accumulated MON to user
        if (totalMONReturned > 0) {
            (bool success, ) = msg.sender.call{value: totalMONReturned}("");
            require(success, "Router: MON transfer failed");
        }

        emit RebalanceExecuted(msg.sender, tokensIn.length);
        return totalMONReturned;
    }

    // Batch Buy: swap native MON into multiple different ERC-20 tokens
    function rebalanceFromMON(
        address[] calldata tokensOut,
        uint256[] calldata monAmountsIn,
        uint256[] calldata minTokensOut
    ) external payable {
        require(tokensOut.length == monAmountsIn.length && tokensOut.length == minTokensOut.length, "Router: Array length mismatch");

        uint256 totalMONRequired = 0;
        for (uint256 i = 0; i < monAmountsIn.length; i++) {
            totalMONRequired += monAmountsIn[i];
        }
        require(msg.value >= totalMONRequired, "Router: Insufficient MON sent");

        MockDEX dex = MockDEX(payable(dexAddress));

        for (uint256 i = 0; i < tokensOut.length; i++) {
            address token = tokensOut[i];
            uint256 monAmount = monAmountsIn[i];

            if (monAmount == 0) continue;

            // Swap MON for token
            dex.swapMONForToken{value: monAmount}(token, minTokensOut[i]);

            // Transfer bought tokens back to the user
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            if (tokenBalance > 0) {
                require(
                    IERC20(token).transfer(msg.sender, tokenBalance),
                    "Router: Token transfer failed"
                );
            }
        }

        // Refund excess MON if any
        uint256 excess = msg.value - totalMONRequired;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "Router: Refund failed");
        }

        emit RebalanceExecuted(msg.sender, tokensOut.length);
    }
}
