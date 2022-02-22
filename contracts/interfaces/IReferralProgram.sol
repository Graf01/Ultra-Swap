// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IReferralProgram {

    function referrals(address) external view returns(address);

}