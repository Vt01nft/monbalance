const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy MockDEX
  const MockDEX = await hre.ethers.getContractFactory("MockDEX");
  const dex = await MockDEX.deploy();
  await dex.waitForDeployment();
  const dexAddress = await dex.getAddress();
  console.log("MockDEX deployed to:", dexAddress);

  // 2. Deploy MockTokens
  const MockToken = await hre.ethers.getContractFactory("MockToken");
  
  const usdc = await MockToken.deploy("Mock USD Coin", "mUSDC", 6);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("mUSDC deployed to:", usdcAddress);

  const eth = await MockToken.deploy("Mock Ethereum", "mETH", 18);
  await eth.waitForDeployment();
  const ethAddress = await eth.getAddress();
  console.log("mETH deployed to:", ethAddress);

  const wbtc = await MockToken.deploy("Mock Wrapped Bitcoin", "mWBTC", 8);
  await wbtc.waitForDeployment();
  const wbtcAddress = await wbtc.getAddress();
  console.log("mWBTC deployed to:", wbtcAddress);

  const link = await MockToken.deploy("Mock Chainlink", "mLINK", 18);
  await link.waitForDeployment();
  const linkAddress = await link.getAddress();
  console.log("mLINK deployed to:", linkAddress);

  // 3. Deploy MultiSwapRouter
  const MultiSwapRouter = await hre.ethers.getContractFactory("MultiSwapRouter");
  const router = await MultiSwapRouter.deploy(dexAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("MultiSwapRouter deployed to:", routerAddress);

  // 4. Seed DEX Liquidity to set up initial pools and rates
  console.log("Seeding DEX liquidity pools...");

  // Mint mock tokens to deployer
  const mintAmountUSDC = hre.ethers.parseUnits("50000", 6);
  const mintAmountETH = hre.ethers.parseUnits("20", 18);
  const mintAmountWBTC = hre.ethers.parseUnits("2", 8);
  const mintAmountLINK = hre.ethers.parseUnits("1500", 18);

  await usdc.mint(deployer.address, mintAmountUSDC);
  await eth.mint(deployer.address, mintAmountETH);
  await wbtc.mint(deployer.address, mintAmountWBTC);
  await link.mint(deployer.address, mintAmountLINK);

  // Approve MockDEX to spend tokens
  await usdc.approve(dexAddress, mintAmountUSDC);
  await eth.approve(dexAddress, mintAmountETH);
  await wbtc.approve(dexAddress, mintAmountWBTC);
  await link.approve(dexAddress, mintAmountLINK);

  // Add Liquidity
  // Pool 1: 50 mUSDC + 0.05 MON (1 MON = 1000 mUSDC)
  console.log("Adding liquidity to mUSDC pool...");
  await dex.addLiquidity(usdcAddress, hre.ethers.parseUnits("50", 6), {
    value: hre.ethers.parseEther("0.05")
  });

  // Pool 2: 0.025 mETH + 0.05 MON (1 MON = 0.5 mETH => 1 mETH = 2 MON)
  console.log("Adding liquidity to mETH pool...");
  await dex.addLiquidity(ethAddress, hre.ethers.parseUnits("0.025", 18), {
    value: hre.ethers.parseEther("0.05")
  });

  // Pool 3: 0.0005 mWBTC + 0.05 MON (1 MON = 0.01 mWBTC => 1 mWBTC = 100 MON)
  console.log("Adding liquidity to mWBTC pool...");
  await dex.addLiquidity(wbtcAddress, hre.ethers.parseUnits("0.0005", 8), {
    value: hre.ethers.parseEther("0.05")
  });

  // Pool 4: 2.5 mLINK + 0.05 MON (1 MON = 50 mLINK => 1 mLINK = 0.02 MON)
  console.log("Adding liquidity to mLINK pool...");
  await dex.addLiquidity(linkAddress, hre.ethers.parseUnits("2.5", 18), {
    value: hre.ethers.parseEther("0.05")
  });

  console.log("DEX liquidity seeding complete!");
  console.log("\nCopy-ready deployed addresses for App.tsx:");
  console.log(JSON.stringify({
    router: routerAddress,
    dex: dexAddress,
    tokens: {
      mUSDC: usdcAddress,
      mETH: ethAddress,
      mWBTC: wbtcAddress,
      mLINK: linkAddress
    }
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
