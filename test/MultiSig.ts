import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MultiSig } from "../typechain-types"; // Make sure to generate types with hardhat-typechain

describe("MultiSig", function () {
  let multiSig: MultiSig;
  let owner: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signer2: SignerWithAddress;
  let signer3: SignerWithAddress;
  let nonSigner: SignerWithAddress;
  let validSigners: string[];
  let quorum: number;

  beforeEach(async function () {
    [owner, signer1, signer2, signer3, nonSigner] = await ethers.getSigners();
    
    validSigners = [signer1.address, signer2.address, signer3.address];
    quorum = 2;

    // Deploy contract with initial funding
    const MultiSigFactory = await ethers.getContractFactory("MultiSig");
    multiSig = (await MultiSigFactory.deploy(validSigners, quorum, {
      value: ethers.parseEther("10.0"),
    })) as MultiSig;
    await multiSig.deployTransaction.wait();
  });

  describe("Contract Deployment", function () {
    it("Should deploy with correct initial state", async function () {
      const balance = await ethers.provider.getBalance(multiSig.address);
      expect(balance).to.equal(ethers.parseEther("10.0"));
      expect(await multiSig.signers(0)).to.equal(signer1.address);
      expect(await multiSig.owner()).to.equal(owner.address);
    });
  });

  describe("Transaction Initiation", function () {
    it("Should allow valid signer to initiate transaction", async function () {
      const tx = await multiSig
        .connect(signer1)
        .initiateTransaction(ethers.parseEther("1.0"), nonSigner.address);
      await tx.wait();

      const transactions = await multiSig.getAllTransactions();
      expect(transactions[0].amount).to.equal(ethers.parseEther("1.0"));
      expect(transactions[0].receiver).to.equal(nonSigner.address);
      expect(transactions[0].signersCount).to.equal(1n);
    });

    it("Should reject transaction initiation from non-signer", async function () {
      await expect(
        multiSig
          .connect(nonSigner)
          .initiateTransaction(ethers.parseEther("1.0"), nonSigner.address)
      ).to.be.revertedWith("not valid signer");
    });
  });

  describe("Transaction Approval", function () {
    beforeEach(async function () {
      const tx = await multiSig
        .connect(signer1)
        .initiateTransaction(ethers.parseEther("1.0"), nonSigner.address);
      await tx.wait();
    });

    it("Should allow valid signers to approve transaction", async function () {
      const initialBalance = await ethers.provider.getBalance(
        nonSigner.address
      );

      // Second signer approves, reaching quorum
      const tx = await multiSig.connect(signer2).approveTransaction(1);
      await tx.wait();

      const finalBalance = await ethers.provider.getBalance(nonSigner.address);
      expect(finalBalance - initialBalance).to.equal(ethers.parseEther("1.0"));
    });

    it("Should prevent double-signing", async function () {
      await expect(
        multiSig.connect(signer1).approveTransaction(1)
      ).to.be.revertedWith("can't sign twice");
    });
  });

  describe("Ownership Transfer", function () {
    it("Should transfer ownership correctly", async function () {
      const transferTx = await multiSig
        .connect(owner)
        .transferOwnership(nonSigner.address);
      await transferTx.wait();

      const claimTx = await multiSig.connect(nonSigner).claimOwnership();
      await claimTx.wait();

      expect(await multiSig.owner()).to.equal(nonSigner.address);
    });

    it("Should prevent non-owner from transferring ownership", async function () {
      await expect(
        multiSig.connect(nonSigner).transferOwnership(signer1.address)
      ).to.be.revertedWith("not owner");
    });
  });

  describe("Signer Management", function () {
    it("Should allow owner to add new signer", async function () {
      const addTx = await multiSig
        .connect(owner)
        .addValidSigner(nonSigner.address);
      await addTx.wait();

      // Verify new signer can initiate transaction
      const initTx = await multiSig
        .connect(nonSigner)
        .initiateTransaction(ethers.parseEther("1.0"), signer1.address);
      await initTx.wait();

      const transactions = await multiSig.getAllTransactions();
      expect(transactions[0].txCreator).to.equal(nonSigner.address);
    });

    it("Should allow owner to remove signer", async function () {
      const removeTx = await multiSig.connect(owner).removeSigner(0);
      await removeTx.wait();

      // Verify removed signer cannot initiate transaction
      await expect(
        multiSig
          .connect(signer1)
          .initiateTransaction(ethers.parseEther("1.0"), nonSigner.address)
      ).to.be.revertedWith("not valid signer");
    });

    it("Should prevent non-owner from managing signers", async function () {
      await expect(
        multiSig.connect(nonSigner).addValidSigner(nonSigner.address)
      ).to.be.revertedWith("not owner");

      await expect(
        multiSig.connect(nonSigner).removeSigner(0)
      ).to.be.revertedWith("not owner");
    });
  });
});
