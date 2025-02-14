import {expect} from "./setup/chai-setup";
import * as utils from "./utils/test-utils";

import {ethers, deployments, getUnnamedAccounts, getChainId, getNamedAccounts} from "hardhat";
import {WidoRouter, WidoZapUniswapV2Pool} from "../typechain";
import {setupUsers} from "./utils/users";
import {UNI_ROUTER_MAP, USDC_MAP, USDC_WETH_LP_MAP, WETH_MAP, ZERO_ADDRESS} from "./utils/addresses";
import {ChainName} from "wido";
import {IWidoRouter} from "../typechain/contracts/WidoRouter";
import {BigNumber} from "ethers";
import {beforeAll, describe, it} from "vitest";

const setup = deployments.createFixture(async () => {
  await deployments.fixture(["WidoRouter", "WidoZapUniswapV2Pool"]);
  const contracts = {
    WidoRouter: <WidoRouter>await ethers.getContract("WidoRouter"),
    WidoZapUniswapV2Pool: <WidoZapUniswapV2Pool>await ethers.getContract("WidoZapUniswapV2Pool"),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  const {deployer} = await getNamedAccounts();
  const deployers = await setupUsers([deployer], contracts);
  return {
    ...contracts,
    users,
    deployers,
  };
});

const WETH = WETH_MAP[process.env.HARDHAT_FORK as ChainName];
const USDC = USDC_MAP[process.env.HARDHAT_FORK as ChainName];
const USDC_WETH_LP = USDC_WETH_LP_MAP[process.env.HARDHAT_FORK as ChainName];
const UNI_ROUTER = UNI_ROUTER_MAP[process.env.HARDHAT_FORK as ChainName];

const executeOrderFn =
  "executeOrder((address,address,address,uint256,uint256,uint32,uint32),(address,address,address,bytes,int32)[],uint256,address)";
const executeOrderToRecipientFn =
  "executeOrder((address,address,address,uint256,uint256,uint32,uint32),(address,address,address,bytes,int32)[],address,uint256,address)";

describe(`WidoRouter`, function () {
  if (!["mainnet", "polygon"].includes(process.env.HARDHAT_FORK as ChainName)) {
    return;
  }
  let user: {address: string} & {WidoRouter: WidoRouter};
  let user1: {address: string} & {WidoRouter: WidoRouter};
  let deployer: {address: string} & {WidoRouter: WidoRouter};
  let widoRouter: WidoRouter;
  let widoZapUniswapV2Pool: WidoZapUniswapV2Pool;

  beforeAll(async function () {
    const {WidoRouter, WidoZapUniswapV2Pool, users, deployers} = await setup();
    widoRouter = WidoRouter;
    widoZapUniswapV2Pool = WidoZapUniswapV2Pool;

    user = users[0];
    user1 = users[1];
    deployer = deployers[0];

    await utils.prepForToken(user.address, USDC, String(2000 * 1e6));
  });

  it(`should Zap USDC for USDC_WETH_LP`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);
    const initFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const initToTokenBal = await utils.balanceOf(toToken, user.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await user.WidoRouter.functions[executeOrderFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      30,
      ZERO_ADDRESS
    );

    const finalFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const finalToTokenBal = await utils.balanceOf(toToken, user.address);

    expect(initFromTokenBal.sub(finalFromTokenBal)).to.equal(amount);
    expect(finalToTokenBal.sub(initToTokenBal).toNumber()).to.greaterThanOrEqual(1);
  });

  it(`should not Zap USDC for USDC_WETH_LP for other user`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await expect(
      user1.WidoRouter.functions[executeOrderFn](
        {
          user: user.address,
          fromToken: fromToken,
          toToken: toToken,
          fromTokenAmount: amount,
          minToTokenAmount: "1",
          nonce: "0",
          expiration: "0",
        },
        swapRoute,
        30,
        ZERO_ADDRESS
      )
    ).to.be.revertedWith("Invalid order user");
  });

  it(`should Zap USDC for USDC_WETH_LP to recipient`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);
    const initFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const initFromTokenBal1 = await utils.balanceOf(fromToken, user1.address);
    const initToTokenBal = await utils.balanceOf(toToken, user.address);
    const initToTokenBal1 = await utils.balanceOf(toToken, user1.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await user.WidoRouter.functions[executeOrderToRecipientFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      user1.address,
      30,
      ZERO_ADDRESS
    );

    const finalFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const finalFromTokenBal1 = await utils.balanceOf(fromToken, user1.address);
    const finalToTokenBal = await utils.balanceOf(toToken, user.address);
    const finalToTokenBal1 = await utils.balanceOf(toToken, user1.address);

    expect(initFromTokenBal.sub(finalFromTokenBal)).to.equal(amount);
    expect(initFromTokenBal1).eq(finalFromTokenBal1);
    expect(initToTokenBal).eq(finalToTokenBal);
    expect(finalToTokenBal1.sub(initToTokenBal1).toNumber()).to.greaterThanOrEqual(1);
  });

  it(`should not Zap USDC for USDC_WETH_LP to recipient, not order user`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await expect(
      user1.WidoRouter.functions[executeOrderToRecipientFn](
        {
          user: user.address,
          fromToken: fromToken,
          toToken: toToken,
          fromTokenAmount: amount,
          minToTokenAmount: "1",
          nonce: "0",
          expiration: "0",
        },
        swapRoute,
        user1.address,
        30,
        ZERO_ADDRESS
      )
    ).to.be.revertedWith("Invalid order user");
  });

  it(`should Zap USDC for USDC_WETH_LP with signature`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);
    const initFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const initToTokenBal = await utils.balanceOf(toToken, user.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    const order = {
      user: user.address,
      fromToken: fromToken,
      toToken: toToken,
      fromTokenAmount: amount,
      minToTokenAmount: "1",
      nonce: "0",
      expiration: "0",
    };

    const signature = await utils.buildAndSignOrder(signer, order, await getChainId(), user.WidoRouter.address);

    await user1.WidoRouter.executeOrderWithSignature(
      order,
      swapRoute,
      signature.v,
      signature.r,
      signature.s,
      30,
      ZERO_ADDRESS
    );

    const finalFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const finalToTokenBal = await utils.balanceOf(toToken, user.address);

    expect(initFromTokenBal.sub(finalFromTokenBal)).to.equal(amount);
    expect(finalToTokenBal.sub(initToTokenBal).toNumber()).to.greaterThanOrEqual(1);
  });

  it(`should not Zap USDC for USDC_WETH_LP, order user != signature user`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);
    const signer1 = await ethers.getSigner(user1.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    const order = {
      user: user.address,
      fromToken: fromToken,
      toToken: toToken,
      fromTokenAmount: amount,
      minToTokenAmount: "1",
      nonce: "0",
      expiration: "0",
    };

    const signature = await utils.buildAndSignOrder(signer1, order, await getChainId(), user.WidoRouter.address);

    await expect(
      user1.WidoRouter.executeOrderWithSignature(
        order,
        swapRoute,
        signature.v,
        signature.r,
        signature.s,
        30,
        ZERO_ADDRESS
      )
    ).to.be.revertedWith("Invalid signature");
  });

  it(`should not Zap USDC for USDC_WETH_LP with same nonce`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    const order = {
      user: user.address,
      fromToken: fromToken,
      toToken: toToken,
      fromTokenAmount: amount,
      minToTokenAmount: "1",
      nonce: "0",
      expiration: "0",
    };

    const signature = await utils.buildAndSignOrder(signer, order, await getChainId(), user.WidoRouter.address);

    await expect(
      user.WidoRouter.executeOrderWithSignature(
        order,
        swapRoute,
        signature.v,
        signature.r,
        signature.s,
        30,
        ZERO_ADDRESS
      )
    ).to.be.revertedWith("Invalid nonce");
  });

  it(`should not Zap USDC for USDC_WETH_LP with 0 amount`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    const order = {
      user: user.address,
      fromToken: fromToken,
      toToken: toToken,
      fromTokenAmount: "0",
      minToTokenAmount: "1",
      nonce: "1",
      expiration: "0",
    };

    const signature = await utils.buildAndSignOrder(signer, order, await getChainId(), user.WidoRouter.address);

    await expect(
      user.WidoRouter.executeOrderWithSignature(
        order,
        swapRoute,
        signature.v,
        signature.r,
        signature.s,
        30,
        ZERO_ADDRESS
      )
    ).to.be.revertedWith("Amount should be greater than 0");
  });

  it(`should not Zap USDC for USDC_WETH_LP with high slippage`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await expect(
      user.WidoRouter.functions[executeOrderFn](
        {
          user: user.address,
          fromToken: fromToken,
          toToken: toToken,
          fromTokenAmount: amount,
          minToTokenAmount: "100000000000000000",
          nonce: "0",
          expiration: "0",
        },
        swapRoute,
        30,
        ZERO_ADDRESS
      )
    ).to.be.reverted;
  });

  it(`should Zap ETH for USDC_WETH_LP`, async function () {
    const fromToken = ZERO_ADDRESS;
    const toToken = USDC_WETH_LP;

    const initToTokenBal = await utils.balanceOf(toToken, user.address);

    const amount = "1000000000000000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      WETH,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken: WETH, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await user.WidoRouter.functions[executeOrderFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      30,
      ZERO_ADDRESS,
      {
        value: amount,
      }
    );

    // const finalFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const finalToTokenBal = await utils.balanceOf(toToken, user.address);

    // expect(initFromTokenBal.sub(finalFromTokenBal)).to.equal(amount);
    expect(finalToTokenBal.sub(initToTokenBal).toNumber()).to.greaterThanOrEqual(1);
  });

  it(`should not Zap ETH for USDC_WETH_LP -- not enough ETH sent`, async function () {
    const fromToken = ZERO_ADDRESS;
    const toToken = USDC_WETH_LP;

    const amount = "1000000000000000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      WETH,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken: WETH, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await expect(
      user.WidoRouter.functions[executeOrderFn](
        {
          user: user.address,
          fromToken: fromToken,
          toToken: toToken,
          fromTokenAmount: amount,
          minToTokenAmount: "1",
          nonce: "0",
          expiration: "0",
        },
        swapRoute,
        30,
        ZERO_ADDRESS,
        {
          value: BigNumber.from(amount).sub(2),
        }
      )
    ).to.be.revertedWith("Invalid amount or msg.value");
  });

  it(`should not Zap ETH for USDC_WETH_LP -- incorrect route`, async function () {
    const fromToken = ZERO_ADDRESS;
    const toToken = USDC_WETH_LP;

    const amount = "1000000000000000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken: USDC, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await expect(
      user.WidoRouter.functions[executeOrderFn](
        {
          user: user.address,
          fromToken: fromToken,
          toToken: toToken,
          fromTokenAmount: amount,
          minToTokenAmount: "1",
          nonce: "0",
          expiration: "0",
        },
        swapRoute,
        30,
        ZERO_ADDRESS,
        {
          value: amount,
        }
      )
    ).to.be.revertedWith("Not enough balance for the step");
  });

  it(`should Zap USDC_WETH_LP for ETH`, async function () {
    const fromToken = USDC_WETH_LP;
    const toToken = ZERO_ADDRESS;

    const initFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const initToTokenBal = await ethers.provider.getBalance(user.address);

    const amount = initFromTokenBal;
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapOut", [
      UNI_ROUTER,
      USDC_WETH_LP,
      amount,
      WETH,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken: WETH, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 68},
    ];

    const signer = await ethers.getSigner(user.address);
    await utils.approveForToken(signer, fromToken, widoRouter.address);

    await user.WidoRouter.functions[executeOrderFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      30,
      ZERO_ADDRESS
    );

    const finalFromTokenBal = await utils.balanceOf(fromToken, user.address);
    const finalToTokenBal = await ethers.provider.getBalance(user.address);

    expect(finalFromTokenBal).to.equal(0);
    expect(finalToTokenBal.sub(initToTokenBal).gt(1));
  });

  it(`should Zap ETH for USDC_WETH_LP to recipient`, async function () {
    const fromToken = ZERO_ADDRESS;
    const toToken = USDC_WETH_LP;

    const initFromTokenBal = await ethers.provider.getBalance(user.address);
    const initToTokenBal = await utils.balanceOf(toToken, user1.address);

    const amount = "1000000000000000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      WETH,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken: WETH, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await user.WidoRouter.functions[executeOrderToRecipientFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      user1.address,
      30,
      ZERO_ADDRESS,
      {
        value: amount,
      }
    );

    const finalFromTokenBal = await ethers.provider.getBalance(user.address);
    const finalToTokenBal = await utils.balanceOf(toToken, user1.address);

    expect(initFromTokenBal.sub(finalFromTokenBal).gte(amount)).to.be.true;
    expect(finalToTokenBal.sub(initToTokenBal).gte(1)).to.be.true;
  });

  it(`should fail directly sending ether`, async function () {
    const signer = await ethers.getSigner(user.address);
    await expect(
      signer.sendTransaction({
        to: user.WidoRouter.address,
        value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
      })
    ).to.be.reverted;
  });

  it("should send fees to bank", async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const bank = await widoRouter.bank();
    const initTreasuryBal = await utils.balanceOf(fromToken, bank);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await user.WidoRouter.functions[executeOrderFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      30,
      ZERO_ADDRESS
    );

    const finalTreasuryBal = await utils.balanceOf(fromToken, bank);
    expect(finalTreasuryBal.sub(initTreasuryBal).eq(300000)).to.be.true;
  });

  it("should not collect fees -- whitelisted to token", async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const bank = await widoRouter.bank();
    const initTreasuryBal = await utils.balanceOf(fromToken, bank);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await user.WidoRouter.functions[executeOrderFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      0,
      ZERO_ADDRESS
    );

    const finalTreasuryBal = await utils.balanceOf(fromToken, bank);
    expect(finalTreasuryBal.eq(initTreasuryBal)).to.be.true;
  });

  it("should not collect fees -- whitelisted from token", async function () {
    const fromToken = USDC_WETH_LP;
    const toToken = USDC;

    const signer = await ethers.getSigner(user.address);
    const initFromTokenBal = await utils.balanceOf(fromToken, user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const bank = await widoRouter.bank();
    const initTreasuryBal = await utils.balanceOf(fromToken, bank);

    const amount = initFromTokenBal;
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapOut", [
      UNI_ROUTER,
      USDC_WETH_LP,
      amount,
      USDC,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken: USDC, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 68},
    ];

    await user.WidoRouter.functions[executeOrderFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      0,
      ZERO_ADDRESS
    );

    const finalTreasuryBal = await utils.balanceOf(fromToken, bank);
    expect(finalTreasuryBal.eq(initTreasuryBal)).to.be.true;
  });

  it("should update fees and send fees to bank", async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const bank = await widoRouter.bank();
    const initTreasuryBal = await utils.balanceOf(fromToken, bank);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    await user.WidoRouter.functions[executeOrderFn](
      {
        user: user.address,
        fromToken: fromToken,
        toToken: toToken,
        fromTokenAmount: amount,
        minToTokenAmount: "1",
        nonce: "0",
        expiration: "0",
      },
      swapRoute,
      40,
      ZERO_ADDRESS
    );

    const finalTreasuryBal = await utils.balanceOf(fromToken, bank);
    expect(finalTreasuryBal.sub(initTreasuryBal).eq(400000)).to.be.true;
  });

  it(`should emit FulfilledOrder event`, async function () {
    const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoRouter.address);

    const amount = "100000000";
    const data = (widoZapUniswapV2Pool as WidoZapUniswapV2Pool).interface.encodeFunctionData("zapIn", [
      UNI_ROUTER,
      USDC_WETH_LP,
      USDC,
      amount,
      1,
    ]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken, toToken, targetAddress: widoZapUniswapV2Pool.address, data, amountIndex: 100},
    ];

    const order = {
      user: user.address,
      fromToken: fromToken,
      toToken: toToken,
      fromTokenAmount: amount,
      minToTokenAmount: "1",
      nonce: "0",
      expiration: "0",
    };

    await expect(user.WidoRouter.functions[executeOrderFn](order, swapRoute, 30, user1.address))
      .to.emit(user.WidoRouter, "FulfilledOrder")
      .withArgs([user.address, fromToken, toToken, amount, "1", 0, 0], order.user, user.address, 30, user1.address);
  });
});
