// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const JAN_1ST_2030 =
  ["0x429cB52eC6a7Fc28bC88431909Ae469977F6daCF", "0x690C65EB2e2dd321ACe41a9865Aea3fAa98be2A5"];

const MultiSigModule = buildModule("MultiSigModule", (m) => {
  const quorum = 1;
  const unMultiSigTime = m.getParameter("signers", JAN_1ST_2030);
  const quorumPara = m.getParameter("quorum", quorum);

  const MultiSig = m.contract("MultiSig", [unMultiSigTime, quorumPara]);

  return { MultiSig };
});

export default MultiSigModule;
