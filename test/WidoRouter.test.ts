//import {expect} from "./setup/chai-setup";

import {ethers, deployments, getUnnamedAccounts, getChainId, getNamedAccounts} from "hardhat";
import {WidoRouter, WidoZapUniswapV2Pool} from "../typechain";
import {ChainName} from "wido";
import {IWidoRouter} from "../typechain/contracts/WidoRouter";
import {BigNumber} from "ethers";

const setup = deployments.createFixture(async () => {
/*   await deployments.fixture(["WidoRouter", "WidoZapUniswapV2Pool"]);
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
  }; */
});

/* const WETH = WETH_MAP[process.env.HARDHAT_FORK as ChainName];
const USDC = USDC_MAP[process.env.HARDHAT_FORK as ChainName];
const USDC_WETH_LP = USDC_WETH_LP_MAP[process.env.HARDHAT_FORK as ChainName];
const UNI_ROUTER = UNI_ROUTER_MAP[process.env.HARDHAT_FORK as ChainName]; */

const executeOrderFn =
  "executeOrder((address,address,address,uint256,uint256,uint32,uint32),(address,address,address,bytes,int32)[],uint256,address)";
const executeOrderToRecipientFn =
  "executeOrder((address,address,address,uint256,uint256,uint32,uint32),(address,address,address,bytes,int32)[],address,uint256,address)";

describe(`WidoRouter`, async () => {
  if (!["mainnet", "polygon"].includes(process.env.HARDHAT_FORK as ChainName)) {
    return;
  }
  let user: {address: string} & {WidoRouter: WidoRouter};
  let user1: {address: string} & {WidoRouter: WidoRouter};
  let deployer: {address: string} & {WidoRouter: WidoRouter};
  let widoRouter: WidoRouter;
  let widoZapUniswapV2Pool: WidoZapUniswapV2Pool;
  let widoManagerAddr: string;

  beforeEach(async function () {
/*     const {WidoRouter, WidoZapUniswapV2Pool, users, deployers} = await setup();
    widoRouter = WidoRouter;
    widoZapUniswapV2Pool = WidoZapUniswapV2Pool;
    widoManagerAddr = await widoRouter.widoManager();

    user = users[0];
    user1 = users[1];
    deployer = deployers[0];

    await utils.prepForToken(user.address, USDC, String(2000 * 1e6)); */
  });

  it(`should Zap USDC for USDC_WETH_LP`, async function () {
    /* const fromToken = USDC;
    const toToken = USDC_WETH_LP;

    const signer = await ethers.getSigner(user.address);

    await utils.approveForToken(signer, fromToken, widoManagerAddr);
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
    expect(finalToTokenBal.sub(initToTokenBal).toNumber()).to.greaterThanOrEqual(1); */
  });

});
