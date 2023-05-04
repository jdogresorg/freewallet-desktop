Version 0.9.23 - May 3rd, 2023
- Added support for editing DUST preferences
- Added support for CIP25
- Fixed security issue with autocomplete
- Fixed Trezor Support
- Added issuance data encoding cost notification
- Added Automatic Donation System (ADS)
- Added lazy loading of asset list images
- Added balance list view options menu
- Fixed issues with BTC/XCP asset divisibility not being set
- Fixed satoshi rounding issues by using `getSatoshis()`

Version 0.9.22 - September 9th, 2022
 - Issue with `reset supply` form always passing divisible as true

Version 0.9.21 - September 2nd, 2022
 - Changed default token type to non-divisible
 - Updated MPMA data encoding fee calculations
 - updated `checkWalletUpgrade()` to use `ajax()`
 - Got basic Trezor integration working again
 - Updates to support CIP03 Token Resets
 - Updates to support CIP24 Oracled Dispensers
 - Added 'Close Dispenser' main menu item

Version 0.9.20 - May 26th, 2022
 - Update to only pull list of open dispensers for watchlists
 - Increased asset description length to 200 characters
 - Added additional MPMA Send list validations
 - Added better API error handling
 - Start passing pubkey on all `create_send` requests
 - Fixed issue with asterisks in asset descriptions
 - Fixed issue with wallet addresses persisting after wallet reset
 - Fixed MAX button to subtract miners fee from max amount
 - Fixed issue with mpma amounts being rounded at times
 - Support for collapsible subassets
 - Support for importing bech32 addresses

Version 0.9.19 - September 7th, 2021
 - Adjust minimum tx fee code to allow lower minimums
 - Limit dispenser watchlists to 10
 - Limit exchange market list to 10
 - Allow default market and exchange tabs to be removed
 - Dispenser updates to add more protection
 - Fixed issue with removing assets from dispenser watchlist
 - Ignore tabs when changing amount values
 - Hide passphrase by default on entry
 - BTC Name Service and asset support in sends
 - Added 'Copy' button to view address page

Version 0.9.18 - April 17, 2021
 - Added warning about setting up dispensers on used addresses

Version 0.9.17 - March 29, 2021
 - Allow segwit addresses to export private keys
 - Disabled MPMA sends from segwit addresses to prevent loss of BTC

Version 0.9.16 - March 16, 2021
 - Added support for opening dispensers on empty addresses
 - Added multiple dispensers on same address warning
 - 'Buy FULLACCESS' button now links direct to official dispenser
 - Stopped forcing quantity to multiple of what dispensers is offering

Version 0.9.15 - March 14, 2021
 - Added support for editing minimum transaction fee
 - Started enforcing minimum fee on transactions
 - Adjusted MPMA send settings and minimum fee

Version 0.9.14 - March 11, 2021
 - Issue with MPMA sends not working properly at times

Version 0.9.13 - March 10, 2021
 - Started using api.counterparty.io API
 - Issue with sends using text memos

Version 0.9.12 - January 15, 2021
 - Added support for destroy transactions
 - Added support for displaying transaction status
 - Added support for decoding hex memos
 - Added "Cancel Order" option to main menu
 - Bumped minimum BTC order amount to 0.00001
 - Issue with MPMA tx fee not being passed to API
 - Issue with context menus appearing in wrong locations
 - Issue with asset description changing on issuing supply

Version 0.9.11 - March 1, 2020
 - Added BIP39 passphrase support
 - Fixed send amount formatting issue

Version 0.9.10 - February 25, 2020
 - Changed licensing to MIT
 - Added support for segwit addresses
 - Added support for burns
 - Added support for sweeps
 - Added support for dispensers
 - Added support for destroys
 - Added support for multi-peer-multi-assets sends (MPMA)
 - Added donation annoyware
 - Opened Exchange interface to everyone
 - Added Dispensers watchlist interface

Version 0.9.9 - February 20, 2019
 - Removed defunct blocktrail.com API calls (more info)
 - Setup all API calls with multiple failovers
 - Updated bounty amounts to adjust for XCP value drop in last year
 - Added ability to buy XCHAINPEPE and FULLACCESS tokens from DEX
 - Added “API Keys” section to settings

Version 0.9.8 - March 29, 2018
 - Added basic framework for hardware wallet support (import & sign)
 - Added basic Trezor hardware wallet integration

Version 0.9.7 - March 15, 2018
 - Issue with create_btcpay API calls failing (more info)
 - issue with markets sidebar displaying wrong volume and % (more info)
 - Issues with URIs not working on windows/linux (more info)
 - Added support for addresses with 1,000+ assets/tokens (more info)
 - Ability to check for version update manually

Version 0.9.6 - Feburary 10, 2018
 - Added support for Highcharts
 - Added support for Decentralized Exchange (DEX)
 - Added market view (chart, orders, history, etc)
 - Added 20+ technical indicators to market view
 - Added suport Auto-BTCpay and manual BTCpay notifications
 - Added support for /api/history/address endpoint
 - Added support for displaying asset lock status via lock/unlock icons
 - Added version update notification system
 - Issue where asset description was reset when issuing additional supply
 - Issue where issuing additional supply was resetting description
 - Display issue with pending transactions in history list

Version 0.9.5 - October 13, 2017
 - Initial release for Windows, Mac, and Linux
