// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

interface IReferral {

    function referrers(address account) external view returns(address);
}