// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract UltraToken is ERC20, AccessControl {

    bytes32 public MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public BURNER_ROLE = keccak256("BURNER_ROLE");
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }
    function burn(address _from, uint256 _amount) external {
        require(hasRole(BURNER_ROLE, _msgSender()), "caller is not burner");
        require(allowance(_from, _msgSender()) >= _amount, "not enough allowance");
        _burn(_from, _amount);
    }

    function mint(address _to, uint256 _amount) external {
        require(hasRole(MINTER_ROLE, _msgSender()), "caller is not minter");
        _mint(_to, _amount);
    }



}