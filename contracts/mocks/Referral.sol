// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "../interfaces/IReferral.sol";

contract Referral is IReferral {

    mapping(address => address) public referrers;

    function setReferrer(address account, address referrer) external {
        referrers[account] = referrer;
    }
}