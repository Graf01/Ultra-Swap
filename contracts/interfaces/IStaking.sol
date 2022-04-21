// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

interface IStaking {

    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256, uint256);

    function pendingReward(uint256 _pid, address _user) external view returns (uint256);

    function deposit(uint256 _pid, uint256 _amount, address _to) external;

    function harvest(uint256 _pid, address _to) external;

    function withdraw(uint256 _pid, uint256 _amount, address _to) external;

    function emergencyWithdraw(uint256 _pid) external;
}