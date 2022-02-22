
import { ethers } from "hardhat";
import { expect } from "chai";
import { advanceBlockTo } from "./utilities"

const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";


describe("Staking", function () {
  before(async function () {
    this.signers = await ethers.getSigners()
    this.alice = this.signers[0]
    this.bob = this.signers[1]
    this.carol = this.signers[2]
    this.dev = this.signers[3]
    this.minter = this.signers[4]

    this.Staking = await ethers.getContractFactory("StakingV2")
    this.UltraToken = await ethers.getContractFactory("UltraToken")
    this.ERC20Mock = await ethers.getContractFactory("ERC20Mock", this.minter)
  })

  beforeEach(async function () {
    this.ultra = await this.UltraToken.deploy("Ultra Token", "ULTRA")
    await this.ultra.deployed()
  })

  it("should set correct state variables", async function () {
    this.staking = await this.Staking.deploy(this.ultra.address, "1000", "0", "1000")
    await this.staking.deployed()

    await this.ultra.grantRole(MINTER_ROLE, this.staking.address)

    const rewardToken = await this.staking.rewardToken()
    const rewardPerBlock = await this.staking.rewardPerBlock()
    const startBlock = await this.staking.startBlock()
    const bonusEndBlock = await this.staking.bonusEndBlock()

    expect(rewardToken).to.equal(this.ultra.address)
    expect(rewardPerBlock).to.equal("1000")
    expect(startBlock).to.equal("0")
    expect(bonusEndBlock).to.equal("1000")
  })


  context("With ERC token added to the field", function () {
    beforeEach(async function () {
      this.stakeToken = await this.ERC20Mock.deploy("Stake Token", "ST", "10000000000")

      await this.stakeToken.transfer(this.alice.address, "1000")

      await this.stakeToken.transfer(this.bob.address, "1000")

      await this.stakeToken.transfer(this.carol.address, "1000")

      this.stakeToken2 = await this.ERC20Mock.deploy("Stake Token 2", "ST2", "10000000000")

      await this.stakeToken2.transfer(this.alice.address, "1000")

      await this.stakeToken2.transfer(this.bob.address, "1000")

      await this.stakeToken2.transfer(this.carol.address, "1000")
    })

    it("should allow emergency withdraw", async function () {
      // 100 per block farming rate starting at block 100 with bonus until block 1000
      this.staking = await this.Staking.deploy(this.ultra.address, "100", "100", "1000")
      await this.staking.deployed()

      await this.staking.add("100", this.stakeToken.address, true)

      await this.stakeToken.connect(this.bob).approve(this.staking.address, "1000")

      await this.staking.connect(this.bob).deposit(0, "100")

      expect(await this.stakeToken.balanceOf(this.bob.address)).to.equal("900")

      await this.staking.connect(this.bob).emergencyWithdraw(0)

      expect(await this.stakeToken.balanceOf(this.bob.address)).to.equal("1000")
    })

    it("should give out reward only after farming time", async function () {
      // 100 per block farming rate starting at block 100 with bonus until block 1000
      this.staking = await this.Staking.deploy(this.ultra.address, "100", "100", "1000")
      await this.staking.deployed()
      console.log("here0");
      await this.ultra.grantRole(MINTER_ROLE, this.staking.address)

      await this.staking.add("100", this.stakeToken.address, true)
      console.log("ultra balance = ", (await this.ultra.balanceOf(this.staking.address)).toString());
      console.log("here1");

      await this.stakeToken.connect(this.bob).approve(this.staking.address, "1000")
      await this.staking.connect(this.bob).deposit(0, "100")
      console.log("ultra balance = ", (await this.ultra.balanceOf(this.staking.address)).toString());

      await advanceBlockTo("89")
      console.log("here2");

      // await this.staking.connect(this.bob).deposit(0, "0") // block 90

      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90
      console.log("here2.5");
      console.log("ultra balance = ", (await this.ultra.balanceOf(this.staking.address)).toString());


      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("94")
      console.log("here3");

      // await this.staking.connect(this.bob).deposit(0, "0") // block 95
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90
      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("99")
      console.log("here4");
      console.log("ultra balance = ", (await this.ultra.balanceOf(this.staking.address)).toString());


      // await this.staking.connect(this.bob).deposit(0, "0") // block 100
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90
      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("0")
      await advanceBlockTo("100")
      console.log("here");
      console.log("ultra balance = ", (await this.ultra.balanceOf(this.staking.address)).toString());


      // await this.staking.connect(this.bob).deposit(0, "0") // block 101
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90

      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("100")
      console.log("here");
      console.log("ultra balance = ", (await this.ultra.balanceOf(this.staking.address)).toString());


      await advanceBlockTo("104")
      // await this.staking.connect(this.bob).deposit(0, "0") // block 105
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90
      console.log("here");

      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("500")
    //   expect(await this.ultra.balanceOf(this.dev.address)).to.equal("500")
      expect(await this.ultra.totalSupply()).to.equal("500")
    })

    it("should not distribute reward if no one deposit", async function () {
      // 100 per block farming rate starting at block 200 with bonus until block 1000
      this.staking = await this.Staking.deploy(this.ultra.address, "100", "200", "1000")
      await this.staking.deployed()
    //   await this.ultra.transferOwnership(this.staking.address)
      await this.ultra.grantRole(MINTER_ROLE, this.staking.address)

      await this.staking.add("100", this.stakeToken.address, true)
      await this.stakeToken.connect(this.bob).approve(this.staking.address, "1000")
      await this.stakeToken.connect(this.alice).approve(this.staking.address, "1000")
      await advanceBlockTo("199")
      expect(await this.ultra.totalSupply()).to.equal("0")
      await advanceBlockTo("204")
      expect(await this.ultra.totalSupply()).to.equal("0")
      await advanceBlockTo("209")
      await this.staking.connect(this.bob).deposit(0, "10") // block 210
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90
      expect(await this.ultra.totalSupply()).to.equal("0")
      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.stakeToken.balanceOf(this.bob.address)).to.equal("990")
      await advanceBlockTo("219")
      await this.staking.connect(this.bob).withdraw(0, "10") // block 220
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90
      expect(await this.ultra.totalSupply()).to.equal("1000")
      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("1000")
      expect(await this.stakeToken.balanceOf(this.bob.address)).to.equal("1000")

      await advanceBlockTo("229")
      await this.staking.connect(this.alice).deposit(0, "10") // block 230
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90

      await advanceBlockTo("239")
      await this.staking.connect(this.alice).withdraw(0, "10") // block 230
      await this.staking.connect(this.bob).getReward(0, this.bob.address) // block 90


      expect(await this.ultra.totalSupply()).to.equal("2000")
      expect(await this.ultra.balanceOf(this.alice.address)).to.equal("1000")
      expect(await this.stakeToken.balanceOf(this.alice.address)).to.equal("1000")


    })

    it("should distribute reward properly for each staker (even if stake token changed)", async function () {
      // 100 per block farming rate starting at block 300 with bonus until block 1000
      this.staking = await this.Staking.connect(this.minter).deploy(this.ultra.address, "100", "300", "1000")
      await this.staking.deployed()
      await this.ultra.grantRole(MINTER_ROLE, this.staking.address)
      this.newStakeToken = await this.ERC20Mock.deploy("New Staking Token", "NST", "1000000000000");

      await this.newStakeToken.transfer(this.alice.address, "1000")

      await this.newStakeToken.transfer(this.bob.address, "1000")

      await this.newStakeToken.transfer(this.carol.address, "1000")


      await this.staking.add("100", this.stakeToken.address, true)
      await this.stakeToken.connect(this.alice).approve(this.staking.address, "1000", {
        from: this.alice.address,
      })
      await this.stakeToken.connect(this.bob).approve(this.staking.address, "1000", {
        from: this.bob.address,
      })
      await this.stakeToken.connect(this.carol).approve(this.staking.address, "1000", {
        from: this.carol.address,
      })

      await this.newStakeToken.connect(this.minter).approve(this.staking.address, "100");
      await this.newStakeToken.connect(this.alice).approve(this.staking.address, "100");
      // Alice deposits 10 LPs at block 310
      await advanceBlockTo("309")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // Bob deposits 20 LPs at block 314
      await advanceBlockTo("313")
      await this.staking.connect(this.bob).deposit(0, "20", { from: this.bob.address })
      // Carol deposits 30 LPs at block 318
      await advanceBlockTo("317")
      await this.staking.connect(this.carol).deposit(0, "30", { from: this.carol.address })
      
      await this.staking.connect(this.minter).changeStakeToken(0, this.newStakeToken.address, {from: this.minter.address});

      // Alice deposits 10 more LPs at block 320. At this point:
      //   Alice should have: 4*1000 + 4*1/3*1000 + 2*1/6*1000 = 5666
      //   Staking contract should have the remaining: 10000 - 5666 = 4334
      await advanceBlockTo("319")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })     // already new stake tokens
      expect(await this.ultra.totalSupply()).to.equal("10000")
      expect(await this.ultra.balanceOf(this.alice.address)).to.equal("5666")
      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("0")
      expect(await this.ultra.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.ultra.balanceOf(this.staking.address)).to.equal("4334")
      // Bob withdraws 5 Staking tokens at block 330. At this point:
      //   Bob should have: 4*2/3*1000 + 2*2/6*1000 + 10*2/7*1000 = 6190
      await advanceBlockTo("329")
      await this.staking.connect(this.bob).withdraw(0, "5", { from: this.bob.address })
      expect(await this.ultra.totalSupply()).to.equal("20000")
      expect(await this.ultra.balanceOf(this.alice.address)).to.equal("5666")
      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("6190")
      expect(await this.ultra.balanceOf(this.carol.address)).to.equal("0")
      expect(await this.ultra.balanceOf(this.staking.address)).to.equal("8144")
    //   expect(await this.ultra.balanceOf(this.dev.address)).to.equal("2000")
      // Alice withdraws 20 LPs at block 340.
      // Bob withdraws 15 LPs at block 350.
      // Carol withdraws 30 LPs at block 360.
      await advanceBlockTo("339")
      await this.staking.connect(this.alice).withdraw(0, "20", { from: this.alice.address })
      await advanceBlockTo("349")
      await this.staking.connect(this.bob).withdraw(0, "15", { from: this.bob.address })
      await advanceBlockTo("359")
      await this.staking.connect(this.carol).withdraw(0, "30", { from: this.carol.address })
      expect(await this.ultra.totalSupply()).to.equal("50000")
    //   expect(await this.ultra.balanceOf(this.dev.address)).to.equal("5000")
      // Alice should have: 5666 + 10*2/7*1000 + 10*2/6.5*1000 = 11600
      expect(await this.ultra.balanceOf(this.alice.address)).to.equal("11600")
      // Bob should have: 6190 + 10*1.5/6.5 * 1000 + 10*1.5/4.5*1000 = 11831
      expect(await this.ultra.balanceOf(this.bob.address)).to.equal("11831")
      // Carol should have: 2*3/6*1000 + 10*3/7*1000 + 10*3/6.5*1000 + 10*3/4.5*1000 + 10*1000 = 26568
      expect(await this.ultra.balanceOf(this.carol.address)).to.equal("26568")
      // All of them should have 1000 LPs back.
      expect(await this.stakeToken.balanceOf(this.alice.address)).to.equal("990")
      expect(await this.newStakeToken.balanceOf(this.alice.address)).to.equal("1010")
      expect(await this.stakeToken.balanceOf(this.bob.address)).to.equal("980")
      expect(await this.newStakeToken.balanceOf(this.bob.address)).to.equal("1020")
      expect(await this.stakeToken.balanceOf(this.carol.address)).to.equal("970")
      expect(await this.newStakeToken.balanceOf(this.carol.address)).to.equal("1030")
    })


    it("should give proper reward allocation to each pool", async function () {
      // 100 per block farming rate starting at block 400 with bonus until block 1000
      this.staking = await this.Staking.deploy(this.ultra.address, "100", "400", "1000")
    //   await this.ultra.transferOwnership(this.staking.address)
      await this.ultra.grantRole(MINTER_ROLE, this.staking.address)

      await this.stakeToken.connect(this.alice).approve(this.staking.address, "1000", { from: this.alice.address })
      await this.stakeToken2.connect(this.bob).approve(this.staking.address, "1000", { from: this.bob.address })
      // Add first LP to the pool with allocation 1
      await this.staking.add("10", this.stakeToken.address, true)
      // Alice deposits 10 LPs at block 410
      await advanceBlockTo("409")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // Add LP2 to the pool with allocation 2 at block 420
      await advanceBlockTo("419")
      await this.staking.add("20", this.stakeToken2.address, true)
      // Alice should have 10*1000 pending reward
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("10000")
      // Bob deposits 10 Staking tokens 2 at block 425
      await advanceBlockTo("424")
      await this.staking.connect(this.bob).deposit(1, "5", { from: this.bob.address })
      // Alice should have 10000 + 5*1/3*1000 = 11666 pending reward
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("11666")
      await advanceBlockTo("430")
      // At block 430. Bob should get 5*2/3*1000 = 3333. Alice should get ~1666 more.
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("13333")
      expect(await this.staking.pendingReward(1, this.bob.address)).to.equal("3333")

      // At block 440 we set allocation point at 10 
      await advanceBlockTo("434")
      await this.staking.set("1", "10", true)
      
      // Bob should get ~3333 more. Alice should get ~1666 more. 
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("15000")
      expect(await this.staking.pendingReward(1, this.bob.address)).to.equal("6666")

      // Now reward is allocated 50/50 to pools
      // So for 5 blocks Alice and Bob should get 5*1/2*1000 = 2500 more 
      await advanceBlockTo("440")
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("17500")
      expect(await this.staking.pendingReward(1, this.bob.address)).to.equal("9166")


    })

    it("should stop giving bonus reward after the bonus period ends", async function () {
      // 100 per block farming rate starting at block 500 with bonus until block 600
      this.staking = await this.Staking.deploy(this.ultra.address, "100", "500", "600")
      await this.ultra.grantRole(MINTER_ROLE, this.staking.address)

      await this.stakeToken.connect(this.alice).approve(this.staking.address, "1000", { from: this.alice.address })
      await this.staking.add("1", this.stakeToken.address, true)
      // Alice deposits 10 Staking tokens at block 590
      await advanceBlockTo("589")
      await this.staking.connect(this.alice).deposit(0, "10", { from: this.alice.address })
      // At block 605, she should have 1000*10 + 100*5 = 10500 pending.
      await advanceBlockTo("605")
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("10500")
      // At block 606, Alice withdraws all pending rewards and should get 10600.
      await this.staking.connect(this.alice).deposit(0, "0", { from: this.alice.address })
      expect(await this.staking.pendingReward(0, this.alice.address)).to.equal("0")
      expect(await this.ultra.balanceOf(this.alice.address)).to.equal("10600")
    })


  })

  

})

