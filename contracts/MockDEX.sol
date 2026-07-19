// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockToken.sol";

contract MockDEX {
    // Reserves for each token: tokenAddress => reserveAmount
    mapping(address => uint256) public tokenReserves;
    mapping(address => uint256) public monReserves;

    event LiquidityAdded(address indexed token, uint256 tokenAmount, uint256 monAmount);
    event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    receive() external payable {}

    // Add liquidity for a specific token
    function addLiquidity(address token, uint256 tokenAmount) external payable {
        require(msg.value > 0, "DEX: Must send MON");
        require(tokenAmount > 0, "DEX: Must send Token");

        // Transfer token from user (requires approval)
        require(
            IERC20(token).transferFrom(msg.sender, address(this), tokenAmount),
            "DEX: Token transfer failed"
        );

        tokenReserves[token] += tokenAmount;
        monReserves[token] += msg.value;

        emit LiquidityAdded(token, tokenAmount, msg.value);
    }

    // Pricing function (Constant Product: x * y = k)
    // Formula: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "DEX: Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "DEX: Insufficient liquidity");
        
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    // Swap ERC-20 token for native MON
    function swapTokenForMON(
        address token,
        uint256 tokenAmount,
        uint256 minMONOut
    ) external returns (uint256) {
        uint256 rToken = tokenReserves[token];
        uint256 rMON = monReserves[token];
        
        uint256 monOut = getAmountOut(tokenAmount, rToken, rMON);
        require(monOut >= minMONOut, "DEX: Slippage limit exceeded");
        require(address(this).balance >= monOut, "DEX: Insufficient contract MON balance");

        // Pull tokens from user
        require(
            IERC20(token).transferFrom(msg.sender, address(this), tokenAmount),
            "DEX: Token transfer failed"
        );

        // Update reserves
        tokenReserves[token] = rToken + tokenAmount;
        monReserves[token] = rMON - monOut;

        // Send MON to user
        (bool success, ) = msg.sender.call{value: monOut}("");
        require(success, "DEX: MON transfer failed");

        emit Swapped(msg.sender, token, address(0), tokenAmount, monOut);
        return monOut;
    }

    // Swap native MON for ERC-20 token
    function swapMONForToken(
        address token,
        uint256 minTokenOut
    ) external payable returns (uint256) {
        uint256 monIn = msg.value;
        require(monIn > 0, "DEX: Must send MON to swap");

        uint256 rToken = tokenReserves[token];
        uint256 rMON = monReserves[token];

        uint256 tokenOut = getAmountOut(monIn, rMON, rToken);
        require(tokenOut >= minTokenOut, "DEX: Slippage limit exceeded");
        require(IERC20(token).balanceOf(address(this)) >= tokenOut, "DEX: Insufficient token reserves");

        // Update reserves
        monReserves[token] = rMON + monIn;
        tokenReserves[token] = rToken - tokenOut;

        // Send token to user
        require(
            IERC20(token).transfer(msg.sender, tokenOut),
            "DEX: Token transfer failed"
        );

        emit Swapped(msg.sender, address(0), token, monIn, tokenOut);
        return tokenOut;
    }
}
