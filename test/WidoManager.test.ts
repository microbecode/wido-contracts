//import {expect} from "./setup/chai-setup";

import {ethers, deployments, getUnnamedAccounts} from "hardhat";
import {ERC20, WidoRouter} from "../typechain";
import {IWidoRouter} from "../typechain/contracts/WidoRouter";
import {loadFixture} from "ethereum-waffle";
import {MockERC20} from "../typechain/contracts/mock/MockERC20";
import {WETH} from "../typechain/contracts/mock/WETH";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

/* const setup = deployments.createFixture(async () => {
 await deployments.fixture(["WidoRouter", "USDC"]);
  const contracts = {
    WidoRouter: <WidoRouter>await ethers.getContract("WidoRouter"),
    USDC: <ERC20>await ethers.getContract("USDC"),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
  }; 
}); */

async function deployFixture() {
  const [_deployer, _user1, _user2, _bank] = await ethers.getSigners();

  const WETH = await ethers.getContractFactory("WETH");
  const _weth = (await WETH.connect(_deployer).deploy()) as WETH;

  const Router = await ethers.getContractFactory("WidoRouter");
  const _router = (await Router.connect(_deployer).deploy(_weth.address, _bank.address)) as WidoRouter;

  const ERC20 = await ethers.getContractFactory("MockERC20");
  const _token1 = (await ERC20.connect(_deployer).deploy()) as MockERC20;
  const _token2 = (await ERC20.connect(_deployer).deploy()) as MockERC20;

  return {_router, _token1, _token2, _deployer, _user1, _user2};
}

const executeOrderFn =
  "executeOrder((address,address,address,uint256,uint256,uint32,uint32),(address,address,address,bytes,int32)[],uint256,address)";

describe(`WidoManager`, async () => {
  /*   if (!["mainnet"].includes(process.env.HARDHAT_FORK as ChainName)) {
    return;
  } */

  let router: WidoRouter,
    token1: MockERC20,
    token2: MockERC20,
    deployer: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress;

  beforeEach(async function () {
    const {_router, _token1, _token2, _deployer, _user1, _user2} = await loadFixture(deployFixture);

    router = _router;
    token1 = _token1;
    token2 = _token2;
    deployer = _deployer;
    user1 = _user1;
    user2 = _user2;

    /*     const {WidoRouter, users, USDC} = await setup();
    widoRouter = WidoRouter;
    usdcContract = USDC;
    alice = users[0];
    bob = users[1];
    widoManagerAddr = await widoRouter.widoManager(); */
  });

  it(`should not zap other people's funds`, async function () {
    const order: IWidoRouter.OrderStruct = {
      user: user1.address,
      fromToken: token1.address,
      toToken: token2.address,
      fromTokenAmount: 1,
      minToTokenAmount: 0,
      nonce: 0,
      expiration: 1670827740,
    };

    /*
        address user;
        address fromToken;
        address toToken;
        uint256 fromTokenAmount;
        uint256 minToTokenAmount;
        uint32 nonce;
        uint32 expiration;
*/

    // arrange
    /* const ETH = ZERO_ADDRESS;
    const WETH = WETH_MAP.mainnet;
    const USDC = USDC_MAP.mainnet;
    const stolenAmount = String(100 * 1e6);

    await utils.prepForToken(bob.address, USDC, stolenAmount);
    await utils.approveForToken(await ethers.getSigner(bob.address), USDC, widoManagerAddr);
    // act
    const steps: IWidoRouter.StepStruct[] = [
      {
        fromToken: WETH,
        toToken: USDC,
        targetAddress: usdcContract.address,
        data: usdcContract.interface.encodeFunctionData("transferFrom", [
          bob.address,
          widoRouter.address,
          stolenAmount,
        ]),
        amountIndex: -1,
      },
    ];
    const promise = alice.WidoRouter.functions[executeOrderFn](
      {
        user: alice.address,
        fromToken: ETH,
        toToken: USDC,
        fromTokenAmount: "1",
        minToTokenAmount: stolenAmount,
        nonce: "0",
        expiration: "0",
      },
      steps,
      30,
      ZERO_ADDRESS,
      {
        value: 1,
      }
    );
    // assert
    await expect(promise).to.be.revertedWith("ERC20: transfer amount exceeds allowance"); */
  });
});
