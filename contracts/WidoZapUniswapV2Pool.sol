// SPDX-License-Identifier: GPLv2

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";

/// @title Uniswap V2 pools Zap
/// @author Wido, Beefy.Finance
/// @notice Add or remove liquidity from Uniswap V2 pools using just one of the pool tokens
contract WidoZapUniswapV2Pool {
    using LowGasSafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Add liquidity to an Uniswap V2 pool using one of the pool tokens
    /// @param router Address of the UniswapV2Router02 contract
    /// @param pair Address of the pair contract to add liquidity into
    /// @param fromToken Address of the token to swap
    /// @param amount Amount of the from token to spend on the user's behalf
    /// @param minToToken Minimum amount of the pool token the user is willing to accept
    function zapIn(
        IUniswapV2Router02 router,
        IUniswapV2Pair pair,
        address fromToken,
        uint256 amount,
        uint256 minToToken
    ) external {
        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amount);

        uint256 toTokenAmount = _swapAndAddLiquidity(router, pair, fromToken);
        require(toTokenAmount >= minToToken, "Slippage too high");

        IERC20(address(pair)).safeTransfer(msg.sender, toTokenAmount);
    }

    /// @notice Remove liquidity from an Uniswap V2 pool into one of the pool tokens
    /// @param router Address of the UniswapV2Router02 contract
    /// @param pair Address of the pair contract to remove liquidity from
    /// @param amount Amount of the lp token to spend on the user's behalf
    /// @param toToken Address of the to token
    /// @param minToToken Minimum amount of the to token the user is willing to accept
    function zapOut(
        IUniswapV2Router02 router,
        IUniswapV2Pair pair,
        uint256 amount,
        address toToken,
        uint256 minToToken
    ) external {
        IERC20(address(pair)).safeTransferFrom(msg.sender, address(this), amount);

        uint256 toTokenAmount = _removeLiquidityAndSwap(router, pair, toToken);
        require(toTokenAmount >= minToToken, "Slippage too high");

        IERC20(toToken).safeTransfer(msg.sender, toTokenAmount);
    }

    function _removeLiquidityAndSwap(
        IUniswapV2Router02 router,
        IUniswapV2Pair pair,
        address toToken
    ) private returns (uint256) {
        require(pair.factory() == router.factory(), "Incompatible router and pair");

        address token0 = pair.token0();
        address token1 = pair.token1();
        require(token0 == toToken || token1 == toToken, "Desired token not present in liquidity pair");

        IERC20(address(pair)).safeTransfer(address(pair), IERC20(address(pair)).balanceOf(address(this)));
        pair.burn(address(this));

        address swapToken = token1 == toToken ? token0 : token1;
        address[] memory path = new address[](2);
        path[0] = swapToken;
        path[1] = toToken;

        _approveTokenIfNeeded(path[0], address(router));
        router.swapExactTokensForTokens(
            IERC20(swapToken).balanceOf(address(this)),
            1,
            path,
            address(this),
            block.timestamp
        );

        return IERC20(toToken).balanceOf(address(this));
    }

    function _swapAndAddLiquidity(
        IUniswapV2Router02 router,
        IUniswapV2Pair pair,
        address fromToken
    ) private returns (uint256) {
        require(pair.factory() == router.factory(), "Incompatible router and pair");

        (uint256 reserveA, uint256 reserveB, ) = pair.getReserves();

        bool isInputA = pair.token0() == fromToken;
        require(isInputA || pair.token1() == fromToken, "Input token not present in liquidity pair");

        address[] memory path = new address[](2);
        path[0] = fromToken;
        path[1] = isInputA ? pair.token1() : pair.token0();

        uint256 fullInvestment = IERC20(fromToken).balanceOf(address(this));
        uint256 swapAmountIn;
        if (isInputA) {
            swapAmountIn = _getSwapAmount(router, fullInvestment, reserveA, reserveB);
        } else {
            swapAmountIn = _getSwapAmount(router, fullInvestment, reserveB, reserveA);
        }

        _approveTokenIfNeeded(path[0], address(router));
        uint256[] memory swapedAmounts = router.swapExactTokensForTokens(
            swapAmountIn,
            1,
            path,
            address(this),
            block.timestamp
        );

        _approveTokenIfNeeded(path[1], address(router));
        (, , uint256 poolTokenAmount) = router.addLiquidity(
            path[0],
            path[1],
            fullInvestment.sub(swapedAmounts[0]),
            swapedAmounts[1],
            1,
            1,
            address(this),
            block.timestamp
        );

        return poolTokenAmount;
    }

    function _getSwapAmount(
        IUniswapV2Router02 router,
        uint256 investmentA,
        uint256 reserveA,
        uint256 reserveB
    ) private pure returns (uint256 swapAmount) {
        uint256 halfInvestment = investmentA / 2;
        uint256 nominator = router.getAmountOut(halfInvestment, reserveA, reserveB);
        uint256 denominator = router.quote(halfInvestment, reserveA.add(halfInvestment), reserveB.sub(nominator));
        swapAmount = investmentA.sub(Babylonian.sqrt((halfInvestment * halfInvestment * nominator) / denominator));
    }

    function _approveTokenIfNeeded(address token, address spender) private {
        if (IERC20(token).allowance(address(this), spender) == 0) {
            IERC20(token).safeApprove(spender, type(uint256).max);
        }
    }

    /// @notice Calculate the amount of pool tokens received when adding liquidity to an UniswapV2 pool using a single asset
    /// @param router Address of the UniswapV2Router02 contract
    /// @param pair Address of the pair contract to add liquidity into
    /// @param fromToken Address of the from token
    /// @param amount Amount of the from token
    /// @return minToToken Minimum amount of the lp token the user would receive in a no-slippage scenario.
    function calcMinToAmountForZapIn(
        IUniswapV2Router02 router,
        IUniswapV2Pair pair,
        address fromToken,
        uint256 amount
    ) external view returns (uint256 minToToken) {
        address token0 = pair.token0();
        address token1 = pair.token1();

        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(pair));
        uint256 balance1 = IERC20(token1).balanceOf(address(pair));
        uint256 lpTotalSupply = pair.totalSupply();

        bool isZapFromToken0 = token0 == fromToken;
        require(isZapFromToken0 || token1 == fromToken, "Input token not present in liquidity pair");

        uint256 halfAmount0;
        uint256 halfAmount1;

        if (isZapFromToken0) {
            halfAmount0 = amount / 2;
            halfAmount1 = router.getAmountOut(amount, reserve0, reserve1);
        } else {
            halfAmount0 = router.getAmountOut(amount, reserve1, reserve0);
            halfAmount1 = amount / 2;
        }

        uint256 amount0 = balance0 + halfAmount0 - reserve0;
        uint256 amount1 = balance1 + halfAmount1 - reserve1;

        return Math.min(amount0.mul(lpTotalSupply) / reserve0, amount1.mul(lpTotalSupply) / reserve1);
    }

    /// @notice Calculate the amount of to tokens received when removing liquidity from an UniswapV2 pool into a single asset.
    /// @param router Address of the UniswapV2Router02 contract
    /// @param pair Address of the pair contract to remove liquidity from
    /// @param toToken Address of the to token
    /// @param lpAmount Amount of the lp token
    /// @return minToToken Minimum amount of the to token the user would receive in a no-slippage scenario.
    function calcMinToAmountForZapOut(
        IUniswapV2Router02 router,
        IUniswapV2Pair pair,
        address toToken,
        uint256 lpAmount
    ) external view returns (uint256 minToToken) {
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        uint256 lpTotalSupply = pair.totalSupply();

        bool isZapToToken0 = pair.token0() == toToken;
        require(isZapToToken0 || pair.token1() == toToken, "Input token not present in liquidity pair");

        uint256 amount0;
        uint256 amount1;

        if (isZapToToken0) {
            amount0 = (lpAmount * reserve0) / lpTotalSupply;
            amount1 = router.getAmountOut((lpAmount * reserve1) / lpTotalSupply, reserve1, reserve0);
        } else {
            amount0 = router.getAmountOut((lpAmount * reserve0) / lpTotalSupply, reserve0, reserve1);
            amount1 = (lpAmount * reserve1) / lpTotalSupply;
        }

        return amount0 + amount1;
    }
}
