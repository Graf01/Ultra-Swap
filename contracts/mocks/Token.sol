// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract Token is ERC20Burnable {

    constructor() ERC20("Token","TKN") {

    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}