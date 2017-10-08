/*********************************************************************
 * freewallet-desktop.js 
 *
 * Custom javascript for freewallet.js
 *********************************************************************/

// Setup some short aliases
var ls = localStorage,
    ss = sessionStorage,
    bc = bitcore;

// Define FreeWallet namespace
FW = {};

// Define object to hold data for dialog boxes
FW.DIALOG_DATA = {};

// Define list of API keys used
FW.API_KEYS = {
    BLOCKTRAIL: '781fc8d6bc5fc6a83334384eecd8c9917d5baf37'
};

// Load wallet network (1=Mainnet, 2=Testnet)
FW.WALLET_NETWORK = ls.getItem('walletNetwork') || 1;

// Load latest network information (btc/xcp price, fee info, block info)
FW.NETWORK_INFO =  JSON.parse(ls.getItem('networkInfo')) || {};

// Load current wallet address and address label
FW.WALLET_ADDRESS       = ls.getItem('walletAddress') || null;
FW.WALLET_ADDRESS_LABEL = ls.getItem('walletAddressLabel') || null;

// Array of the known wallet addresses any labels
FW.WALLET_ADDRESSES = JSON.parse(ls.getItem('walletAddresses')) || [];
// Example record
// {
//         address: '14PPCFzhQbMFyuUTRRqDnbt1gTVnXcCETi',
//         label: 'My Wallet Address'
//         network: 1, // 1=Mainnet, 2=Testnet
//         type: 1,    // 1=indexed, 2=privkey (imported), 3=watch-only
//         index: 0    // The index of the address
// }

// Object containing of address/private keys
FW.WALLET_KEYS    = {};                             

// Load the last known wallet balances and history
FW.WALLET_BALANCES = JSON.parse(ls.getItem('walletBalances')) || [];
FW.WALLET_HISTORY  = JSON.parse(ls.getItem('walletHistory'))  || [];

// Public server config used to generate unsigned wallet transactions
FW.WALLET_SERVER_INFO = {
    mainnet: {
        host: 'public.coindaddy.io',
        port: 4001,                 
        user: 'rpc',                
        pass: '1234',               
        ssl: true                   
    },
    testnet: {
        host: 'public.coindaddy.io',
        port: 14001,                
        user: 'rpc',                
        pass: '1234',               
        ssl: true                   
    }
};

// Start loading the wallet 
$(document).ready(function(){

    // Quick hack to blow away any old data from freewallet.io/browser
    var old = ls.getItem("Balances");
    if(old){
        ls.clear();
        ss.clear();
        window.location.reload();
    }

    // If user has not already agreed to license agreement, display it
    if(parseInt(ls.getItem('licenseAgreementAccept'))!=1)
        dialogLicenseAgreement();

    // Load the server information
    var info = ls.getItem('serverInfo');
    if(info)
        FW.WALLET_SERVER_INFO = JSON.parse(info);

    // Initialize the wallet 
    initWallet();

});

// Handle changing theme
function setTheme( theme ) {
    var body = $('body');
    body.removeClass();
    body.addClass(theme);        
}

// Handle loading content into the main panel
function loadPage(page){
    $('#main-content-panel').load('html/' + page + '.html');
    $('.header .navbar-nav li > a').removeClass('active');
    $('#' + page).addClass('active');
}

// Initialize / Load the wallet
function initWallet(){
    if(ss.getItem('wallet') == null){
        if(ls.getItem('wallet')){
            if(parseInt(ls.getItem('walletEncrypted'))==1){
                // Try to unlock the wallet when app first opens
                // if(parseInt(ss.getItem('skipWalletAuth'))!=1)
                //     dialogPassword();
            } else {
                decryptWallet();
            }
        } else {
            dialogWelcome();
        }
    } else {
        // Decrypt the wallet using the current password (do this so we populate FW.WALLET_KEYS)
        decryptWallet(getWalletPassword());
    }
    // Trigger an immediate check of if we need to update the wallet information (prices/balances)
    checkUpdateWallet();
    // Check every 60 seconds if we should update the wallet information (prices/balances)
    setInterval(checkUpdateWallet, 60000);
    updateWalletOptions();
}

// Reset/Remove wallet
function resetWallet(){
    ls.removeItem('wallet');
    ls.removeItem('walletKeys');
    ls.removeItem('walletPassword');
    ls.removeItem('walletEncrypted');
    ls.removeItem('walletAddress');
    ls.removeItem('walletAddresses');
    ls.removeItem('walletBalances');
    ls.removeItem('walletHistory');
    ls.removeItem('walletNetwork');
    ss.removeItem('wallet');
    ss.removeItem('walletPassword');
    ss.removeItem('skipWalletAuth');
    FW.WALLET_BALANCES = [];
    FW.WALLET_HISTORY  = [];
    FW.WALLET_KEYS     = {};    
}



// Create HD wallet
function createWallet( passphrase ){
    var m = new Mnemonic(128);
    if(passphrase)
        m = Mnemonic.fromWords(passphrase.trim().split(" "));
    var wallet    = m.toHex(),
        password  = Math.random().toString(36).substring(3), // Generate random password
        privkeys  = JSON.stringify(FW.WALLET_KEYS),
        encWallet = CryptoJS.AES.encrypt(wallet, String(password)).toString(),
        encKeys   = CryptoJS.AES.encrypt(privkeys, String(password)).toString();
    ss.setItem('wallet', wallet);
    ss.setItem('walletPassword', password);
    ls.setItem('wallet', encWallet);
    ls.setItem('walletKeys', encKeys);
    ls.setItem('walletPassword', password);
    ls.setItem('walletEncrypted',0);
    ls.setItem('walletNetwork',1);
    ss.removeItem('skipWalletAuth');
    // Add the first 10 addresses to the wallet (both mainnet and testnet)
    var networks = ['mainnet','testnet'];
    networks.forEach(function(net){
        var network = bitcore.Networks[net];
        var s = bc.HDPrivateKey.fromSeed(wallet, network);
        for(var i=0;i<10;i++){
            var d = s.derive("m/0'/0/" + i),
                a = bc.Address(d.publicKey, network).toString();
            addWalletAddress(net, a, 'Address #' + (i + 1), 1, i);
        }
    });
    // Set current address to first address in wallet
    // This also handles saving TBE.WALLET_ADDRESSES to disk
    setWalletAddress(getWalletAddress(0), true);
}

// Handle generating a new indexed address and adding it to the wallet
function addNewWalletAddress(net=1){
    // Force network to numeric value and net to string value
    var ls  = localStorage;
    net     = (net=='testnet' || net==2) ? 2 : 1;
    network = (net==2) ? 'testnet' : 'mainnet';
    address = false;
    // Lookup the highest indexed address so far
    var idx = 0;
    FW.WALLET_ADDRESSES.forEach(function(item){
        if(item.type==1 && item.network==net && item.index>idx)
            idx = item.index;
    });
    idx++; // Increase index for new address
    // Generate new address
    var w = getWallet(),
        b = bitcore,
        n = b.Networks[network],
        s = b.HDPrivateKey.fromSeed(w, n),
        d = s.derive("m/0'/0/" + idx);
    address = b.Address(d.publicKey, n).toString();
    // Add the address to the wallet
    addWalletAddress(network, address, 'Address #' + (idx + 1), 1, idx);
    // Save wallet addresses info to disk
    ls.setItem('walletAddresses', JSON.stringify(FW.WALLET_ADDRESSES));
    return address;
}

// Decrypt wallet
function decryptWallet( password ){
    var encWallet = ls.getItem('wallet'),
        encKeys   = ls.getItem('walletKeys') || '',
        password  = (password) ? password : ls.getItem('walletPassword'),
        wallet    = CryptoJS.AES.decrypt(encWallet, String(password)).toString(CryptoJS.enc.Utf8),
        privkeys  = CryptoJS.AES.decrypt(encKeys, String(password)).toString(CryptoJS.enc.Utf8);
    // Save wallet to session storage
    ss.setItem('wallet', wallet);
    // Parse private keys into FW.WALLET_KEYS
    FW.WALLET_KEYS = JSON.parse(privkeys);
    // Save the current wallet password (so we can re-encrypt things without needing to re-prompt the user for pass)
    ss.setItem('walletPassword', password);
    // Remove any skip wallet authorization flag
    ss.removeItem('skipWalletAuth');
}

// Decrypt wallet
function encryptWallet( password, skip=false ){
    var wallet    = getWallet(),
        password  = (password) ? password : ls.getItem('walletPassword'),
        privkeys  = JSON.stringify(FW.WALLET_KEYS),
        encWallet = CryptoJS.AES.encrypt(wallet, String(password)).toString(),
        encPass   = CryptoJS.AES.encrypt(password, String(password)).toString(),
        encKeys   = CryptoJS.AES.encrypt(privkeys, String(password)).toString();
    // Save the encrypted data to disk
    ls.setItem('wallet', encWallet);
    // Mark wallet as encrypted and save encrypted password unless instructed not to
    if(!skip){
        ls.setItem('walletEncrypted',1);
        ls.setItem('walletPassword', encPass);
    }
    ls.setItem('walletKeys', encKeys);
    // Remove any skip wallet authorization flag
    ss.removeItem('skipWalletAuth');
}

// Get decrypted wallet from sessionStorage
function getWallet(){
    return ss.getItem('wallet');
}

// Get decrypted wallet password from sessionStorage
function getWalletPassword(){
    return ss.getItem('walletPassword');
}

// Get 12-word passphrase
function getWalletPassphrase(){
    var w = getWallet();
    if(w)
        return Mnemonic.fromHex(w).toWords().toString().replace(/,/gi, " ");
    return false;
}

// Handle locking wallet by removing decrypted wallet from sessionStorage
function lockWallet(){
    ss.removeItem('wallet');
    ss.removeItem('walletPassword')
    FW.WALLET_KEYS = {};
}


// Get wallet addresses using given index 
function getWalletAddress( index ){
    // console.log('getWalletAddress index=',index);
    // update network (used in CWBitcore)
    var net = (FW.WALLET_NETWORK==2) ? 'testnet' : 'mainnet',
    NETWORK = bitcore.Networks[net];
    if(typeof index === 'number'){
        // var type
        var w = getWallet(),
            a = null;
        if(w){
            k = bc.HDPrivateKey.fromSeed(w, NETWORK),
            d = k.derive("m/0'/0/" + index),
            a = bc.Address(d.publicKey, NETWORK).toString();
        } else {
            dialogMessage('<i class="fa fa-lg fa-fw fa-exclamation-circle"></i> Error(s)', errors.join('<br/>') );
        }
        return a;
    } else {
        return ls.getItem('walletAddress');
    }
}

// Set wallet address
function setWalletAddress( address, load=0 ){
    // console.log('setWalletAddress address, load=',address,load);
    FW.WALLET_ADDRESS = address;
    var info = getWalletAddressInfo(address);
    if(!info)
        info = addWalletAddress(address);
    // Save the label info to disk
    FW.WALLET_ADDRESS_LABEL = info.label;
    // Save updated information to disk
    ls.setItem('walletAddress', address);
    ls.setItem('walletAddressLabel', info.label);
    ls.setItem('walletAddresses', JSON.stringify(FW.WALLET_ADDRESSES));
    // Update the wallet display to reflect the new address
    updateWalletOptions();
    if(load)
        checkUpdateWallet();
}

// Handle adding addresses to FW.WALLET_ADDRESSES array
function addWalletAddress( network=1, address='', label='', type=1, index='' ){
    // console.log('addWalletAddress network,address,label,type,index=',network,address,label,type,index);
    if(address=='')
        return;
    // Convert network to integer value
    if(typeof network == 'string')
        network = (network=='testnet') ? 2 : 1;
    var info = {
        address: address, // Address to add
        network: network, // Default to mainnet (1=mainnet, 2=testnet)
        label: label,     // Default to blank label
        type: type,       // 1=indexed, 2=imported (privkey), 3=watch-only
        index: index      // wallet address index (used in address sorting)
    };
    FW.WALLET_ADDRESSES.push(info);
    return info;
}

// Handle removing an address from the wallet
function removeWalletAddress( address ){
    // Remove the address from FW.WALLET_ADDRESSES array
    var arr = [];
    FW.WALLET_ADDRESSES.forEach(function(item){
        if(item.address!=address)
            arr.push(item);
    });
    FW.WALLET_ADDRESSES = arr;
    // Remove any private keys associated with the address
    if(FW.WALLET_KEYS[address])
        delete FW.WALLET_KEYS[address];
    // Save wallet addresses info to disk
    ls.setItem('walletAddresses', JSON.stringify(FW.WALLET_ADDRESSES));
    // Re-encrypt the wallet with the last known valid password
    encryptWallet(getWalletPassword(), true);
}

// Handle returning the information from TBE.WALLET_ADDRESSES for a given address
function getWalletAddressInfo( address ){
    var info = false;
    FW.WALLET_ADDRESSES.forEach(function(item){
        if(item.address==address)
            info = item;
    });
    return info;
}

// Handle updating wallet address labels (friendly names)
function setWalletAddressLabel( address, label ){
    FW.WALLET_ADDRESSES.forEach(function(item, idx){
        if(item.address==address)
            FW.WALLET_ADDRESSES[idx].label = label;
    });
    // Save the label info to disk
    FW.WALLET_ADDRESS_LABEL = label;
    ls.setItem('walletAddressLabel', label);
    // Save updated wallet addresses array to disk
    ls.setItem('walletAddresses', JSON.stringify(FW.WALLET_ADDRESSES));
}

// Handle setting the wallet network (1=mainnet/2=testnet)
function setWalletNetwork(network, load=false){
    ls.setItem('walletNetwork', network);
    FW.WALLET_NETWORK = network;
    // Set current address to first address in wallet
    setWalletAddress(getWalletAddress(0), load);
}


// Handle adding private key to wallet
function addWalletPrivkey(key){
    // Verify that the private key is added
    var net     = FW.WALLET_NETWORK,                // Numeric
        network = (net==2) ? 'testnet' : 'mainnet', // Text
        ls      = localStorage,
        bc      = bitcore,
        n       = bc.Networks[network],
        address = false;
    // Try to generate a public key and address using the key
    try {
        privkey = new bc.PrivateKey.fromWIF(key);
        pubkey  = privkey.toPublicKey();
        address = pubkey.toAddress(n).toString();
    } catch (e){
        console.log('error : ',e);
    }
    // Add wallet to address
    if(address){
        // Check if the address has alreaday been added to the list
        var found = false,
            cnt   = 0;
        FW.WALLET_ADDRESSES.forEach(function(item){
            if(item.address==address)
                found = true;
            if(item.network==net && item.type==2)
                cnt++;
        });
        if(!found){
            // Add the address to the wallet 
            addWalletAddress(network, address, 'Imported Address #' + (cnt + 1), 2, null);
            // Save wallet addresses info to disk
            ls.setItem('walletAddresses', JSON.stringify(FW.WALLET_ADDRESSES));
            // Add address and private key to keys array
            FW.WALLET_KEYS[address] = key;
            // Re-encrypt the wallet with the last known valid password
            encryptWallet(getWalletPassword(), true);
        }
    }
    return address;
}


// Validate wallet password
function isValidWalletPassword( password ){
    var p = ls.getItem('walletPassword'),
        d = false;
    // Try to decrypt the encrypted password using the given password
    try {
        d = CryptoJS.AES.decrypt(p, String(password)).toString(CryptoJS.enc.Utf8);
    } catch(e){
    }
    if(d==password)
        return true
    return false;
}

// Validate wallet passphrase
function isValidWalletPassphrase( passphrase ){
    var arr   = passphrase.trim().split(" "),
        valid = true;
    if(arr.length<12)
        valid = false;
    for(var i=0;i<arr.length;i++){
        if($.inArray(arr[i], Mnemonic.words)==-1)
            valid = false;
    }
    return valid;
}

// Validate address
function isValidAddress(addr){
    var net  = (FW.WALLET_NETWORK==2) ? 'testnet' : 'mainnet';
    // update network (used in CWBitcore)
    NETWORK  = bitcore.Networks[net];
    if(CWBitcore.isValidAddress(addr))
        return true;
    return false;
}

// Validate if we are running in nwjs or not
function is_nwjs(){
    try{
        return (typeof require('nw.gui') !== "undefined");
    } catch (e){
        return false;
    }
}

// Display correct wallet options based on wallet status
function updateWalletOptions(){
    // Handle updating lock/unlock icon based on state
    var icon = $('#lock > i'),
        lock = $('#lock');
    if(!ss.getItem('wallet')){
        icon.removeClass('fa-unlock').addClass('fa-lock');
        lock.attr('data-original-title','<div class="nowrap">Unlock Wallet</div>');
    } else {
        icon.removeClass('fa-lock').addClass('fa-unlock');
        lock.attr('data-original-title', '<div class="nowrap">Lock Wallet</div>');
    }
    // Handle updating the settings screen
    $('#settings-address').val(FW.WALLET_ADDRESS);
    $('#settings-network').val(FW.WALLET_NETWORK);
    $('#settings-address-label').val(FW.WALLET_ADDRESS_LABEL);
    // Handle updating footer info
    var net   = (FW.WALLET_NETWORK==2) ? 'testnet' : 'mainnet';
        last  = ls.getItem('networkInfoLastUpdated') || '',
        block = (FW.NETWORK_INFO.network_info) ? FW.NETWORK_INFO.network_info[net].block_height : 'NA';
    $('.footer-current-block').text('Block ' + numeral(block).format('0,0'));
    $('.footer-last-updated').html('Last updated <span data-livestamp='  + last.substr(0,last.length-3) + ' class="nowrap"></span>');
    $('.footer-current-price').text('$' + numeral(getAssetPrice('XCP')).format('0,0.00') + ' USD');
    var info = getWalletAddressInfo(FW.WALLET_ADDRESS);
    if(info.type==3){
        $('#action-view-privkey').hide();
        $('#action-send').hide();
        $('#action-sign-message').hide();
        $('#action-sign-transaction').hide();
        $('#action-dividend').hide();
        $('#action-broadcast-message').hide();
        $('#header-token-actions').hide();
        $('#action-asset-create').hide();
        $('#action-asset-description').hide();
        $('#action-asset-supply').hide();
        $('#action-asset-transfer').hide();
        $('#action-asset-lock').hide();
    } else {
        $('#action-view-privkey').show();
        $('#action-send').show();
        $('#action-sign-message').show();
        $('#action-sign-transaction').show();
        $('#action-dividend').show();
        $('#action-broadcast-message').show();
        $('#header-token-actions').show();
        $('#action-asset-create').show();
        $('#action-asset-description').show();
        $('#action-asset-supply').show();
        $('#action-asset-transfer').show();
        $('#action-asset-lock').show();
    }
}

// Handle looking up asset price from FW.NETWORK_INFO
function getAssetPrice(id, full){
    var price = false;
    for(var key in FW.NETWORK_INFO.currency_info){
        var item = FW.NETWORK_INFO.currency_info[key];
        if(item.id==id||item.symbol==id||name==id){
            if(full)
                price = item;
            else
                price = item.price_usd;
        }
    }
    return price;
}

// Handle retrieving asset information from xchain and handing the data to a callback function
function getAssetInfo(asset, callback){
    var host = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io';
    $.getJSON( 'https://' + host + '/api/asset/' + asset, function( data ){
        if(typeof callback === 'function')
            callback(data);
    });
}

// Check if wallet price/balance info should be updated
function checkUpdateWallet(){
    updateNetworkInfo();
    var addr = getWalletAddress();
    if(addr){
        updateWalletBalances(addr);
        updateWalletHistory(addr);
    }
};


// Update address balances
function updateWalletBalances( address, force ){
    var addr  = (address) ? address : FW.WALLET_ADDRESS,
        net   = (FW.WALLET_NETWORK==2) ? 'tbtc' : 'btc',
        net2  = (FW.WALLET_NETWORK==2) ? 'BTCTEST' : 'BTC',
        host  = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io',
        info  = getAddressBalance(addr) || {},
        last  = info.lastUpdated || 0,
        ms    = 300000, // 5 minutes
        btc   = false,  // Flag to indicate if BTC update is done
        xcp   = false;  // Flag to indicate if XCP update is done
    // Handle updating BTC and XCP asset balances
    if((parseInt(last) + ms)  <= Date.now() || force){
        // console.log('updating wallet balances');
        // Callback to handle saving data when we are entirely done 
        var doneCb = function(info){
            if(btc && xcp){
                // Sort array to show items in the following order
                // BTC & XCP 1st and second
                // Alphabetical order for asset name
                info.data.sort(function(a,b){
                    if(a.asset.length==3 && b.asset.length>3)
                        return -1;
                    if(a.asset.length>3 && b.asset.length==3)
                        return 1;
                    if(a.asset.length==3 && b.asset.length==3){
                        if(a < b)
                            return -1;
                        if(a > b)
                            return 1;
                    } else {
                        var strA = (a.asset_longname && a.asset_longname!='') ? a.asset_longname : a.asset,
                            strB = (b.asset_longname && b.asset_longname!='') ? b.asset_longname : b.asset;
                        if(strA < strB)
                            return -1;
                        if(strA > strB)
                            return 1;
                    }
                    return 0;
                });
                var arr = [info];
                FW.WALLET_BALANCES.forEach(function(item){
                    if(item.address!=addr)
                        arr.push(item);
                });
                FW.WALLET_BALANCES = arr;
                ls.setItem('walletBalances',JSON.stringify(FW.WALLET_BALANCES));
                updateBalancesList();
            }
        }
        // Define default record
        var info = {
            address: addr,
            data: [],
            lastUpdated: Date.now()
        }
        // Get BTC/XCP currency info
        var btc_info = getAssetPrice('BTC',true),
            xcp_info = getAssetPrice('XCP',true);
        // Handle Updating asset balances (first 500 only)
        $.getJSON('https://' + host + '/api/balances/' + addr, function( data ){
            data.data.forEach(function(item){ info.data.push(item); });
            xcp = true; // Flag to indicate we are done with XCP update
            doneCb(info);
        });
        // Callback to handle adding BTC to balances list
        var addBTCCb = function(qty){
            info.data.push({
                asset: "BTC",
                estimated_value: {
                    btc: qty,
                    usd: numeral(parseFloat(btc_info.price_usd) * qty).format('0.00'),
                    xcp: numeral(qty / parseFloat(xcp_info.price_btc)).format('0.00000000'),
                },
                quantity: qty
            });
            btc = true; // Flag to indicate we are done with BTC update
            doneCb(info);
        }
        // Handle updating BTC balance via blocktrail
        var qty = '0.00000000';
        $.getJSON('https://api.blocktrail.com/v1/' + net + '/address/' + addr + '?api_key=' + FW.API_KEYS.BLOCKTRAIL, function( data ){
            if(data.balance)
                qty =  numeral(data.balance * 0.00000001).format('0.00000000');
            addBTCCb(qty);
        }).fail(function(o){
            // Failover to requesting balance info from chain.so
            $.getJSON('https://chain.so//api/v2/get_address_balance/' + net2 + '/' + addr, function( data ){
                if(data.status=='success')
                    qty = numeral(parseFloat(data.data.confirmed_balance) + parseFloat(data.data.unconfirmed_balance)).format('0.00000000');
                addBTCCb(qty);
            });
        });
    }
}

// Update address history information
function updateWalletHistory( address, force ){
    // console.log('updateWalletHistory address, force=',address, force);
    var addr  = (address) ? address : FW.WALLET_ADDRESS,
        net   = (FW.WALLET_NETWORK==2) ? 'tbtc' : 'btc',
        host  = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io',
        types = ['bets','broadcasts','burns','dividends','issuances','orders','sends','mempool'];
        info  = getAddressHistory(addr) || {},
        last  = info.lastUpdated || 0,
        ms    = 300000; // 5 minutes
    var status = {
        btc: false, // Flag to indicate if BTC update is done
        xcp: false // Flag to indicate if XCP update is done
    }
    // Handle updating BTC and XCP transaction history
    if((parseInt(last) + ms)  <= Date.now() || force){
        // console.log('updating wallet history');
        // Callback to handle saving data when we are entirely done 
        var doneCb = function(){
            var done = true;
            types.forEach(function(item){
                if(status[item]!=true)
                    done = false;
            });
            // We are not done if we are still waiting for BTC update
            if(status.btc!=true)
                done = false;
            // Handle sorting/saving the history information
            if(done){
                // Sort the history by timestamp, newest first
                info.data.sort(function(a,b){
                    if(a.timestamp < b.timestamp)
                        return 1;
                    if(a.timestamp > b.timestamp)
                        return -1;
                    return 0;
                });
                var arr = [info];
                FW.WALLET_HISTORY.forEach(function(item){
                    if(item.address!=addr)
                        arr.push(item);
                });
                FW.WALLET_HISTORY = arr;
                ls.setItem('walletHistory',JSON.stringify(FW.WALLET_HISTORY));
                updateHistoryList();
            }
        }
        // Define default record
        var info = {
            address: addr,
            data: [],
            lastUpdated: Date.now()
        }
        // Function to handle adding/updating transaction history records
        var addTransaction = function(data){
            // console.log('addTransaction data=',data);
            var record = {},
                arr    = [];
            info.data.forEach(function(item, idx){
                if(item.tx==data.tx)
                    record = item;
                else 
                    arr.push(item);
            });
            // Bail out if this is already a known BTC transaction
            if(data.asset=='BTC' && typeof record.tx!== 'undefined')
                return;
            // Add the data to the array and save arr to info.data
            arr.push(data);
            info.data = arr;
        }
        // Loop through each transaction type and request history for the given address
        types.forEach(function(type){
            $.getJSON('https://' + host + '/api/' + type + '/' + addr, function( data ){
            // $.getJSON('https://' + host + '/api/' + type + '/1AuspQ6wRmryPQ3SuPoy4LaVJSRdafF1Wj', function( data ){

                if(String(type).substring(type.length-1)=='s')
                    type_short = String(type).substring(0,type.length-1);                    
                data.data.forEach(function(item){
                    var quantity = item.quantity,
                        tstamp   = item.timestamp,
                        tx_type  = type_short;
                    // Set type from mempool data, and reset timestamp, so things show as pending
                    if(tx_type=='mempool'){
                        tx_type = String(item.tx_type).toLowerCase();
                        tstamp  = null;
                    }
                    if(tx_type=='bet'){
                        asset    = 'XCP';
                        quantity = item.wager_quantity;
                    } else if(tx_type=='burn'){
                        asset    = 'BTC';
                        quantity = item.burned;
                    } else if(tx_type=='order'){
                        asset    = item.get_asset,
                        quantity = item.get_quantity;
                    } else if(tx_type=='send'){
                        if(item.source==address)
                            quantity = '-' + quantity;
                    }                    
                    addTransaction({
                        type: tx_type,
                        tx: item.tx_hash,
                        asset: item.asset,
                        asset_longname: item.asset_longname, 
                        quantity: quantity,
                        timestamp: tstamp
                    });
                });
                status[type] = true;
                doneCb();
            });
        });
        // Handle updating BTC balance
        $.getJSON( 'https://api.blocktrail.com/v1/' + net + '/address/' + addr + '/transactions?limit=100&sort_dir=desc&api_key=' + FW.API_KEYS.BLOCKTRAIL, function( data ){
            data.data.forEach(function(item){
                var quantity = numeral(item.estimated_value * 0.00000001).format('0.00000000');
                if(item.inputs[0].address==addr)
                    quantity = '-' + quantity;
                addTransaction({
                    type: 'send',
                    tx: item.hash,
                    asset: 'BTC',
                    asset_longname: '', 
                    quantity: quantity,
                    timestamp: (item.block_height) ? moment(item.time,["YYYY-MM-DDTH:m:s"]).unix() : null
                });
            });
            status.btc = true; // Flag to indicate we are done with BTC update
            doneCb();
        });
    }
}



// Handle checking balances info for a given address 
// Optionally you can specify an asset to get back just that balance
function getAddressBalance(address, asset=''){
    var info = false;
    FW.WALLET_BALANCES.forEach(function(item){
        if(item.address==address){
            if(asset==''){
                info = item
            } else {
                item.data.forEach(function(itm){
                    if(itm.asset==asset||itm.asset_longname==asset)
                        info = itm;
                });
            }
        }
    });
    return info;
}

// Handle checking balances info for a given address 
// Optionally you can specify an asset to get back just that balance
function getAddressHistory(address, asset=''){
    var info = false;
    FW.WALLET_HISTORY.forEach(function(item){
        if(item.address==address){
            if(asset==''){
                info = item
            } else {
                item.data.forEach(function(itm){
                    if(itm.asset==asset||itm.asset_longname==asset)
                        info = itm;
                });
            }
        }
    });
    return info;
}


// Handle updating basic wallet information via a call to xchain.io/api/network
function updateNetworkInfo( force ){
    var last = ls.getItem('networkInfoLastUpdated') || 0,
        ms   = 300000; // 5 minutes
    if((parseInt(last) + ms)  <= Date.now() || force ){
        // BTC/USD Price
        $.getJSON( "https://xchain.io/api/network", function( data ){
            if(data){
                FW.NETWORK_INFO = data;
                ls.setItem('networkInfo',JSON.stringify(data));
                ls.setItem('networkInfoLastUpdated', Date.now());
                updateWalletOptions();
            }
        });
    }
}


// Display error message and run callback (if any)
function cbError(msg, callback){
    dialogMessage(null, msg, true);
    if(typeof callback === 'function')
        callback();
}

// Convert an amount to satoshis
function getSatoshis(amount){
    var num = numeral(amount);
    if(/\./.test(amount))
        num.multiply(100000000);
    return parseInt(num.format('0'));
}

// Get private key for a given network and address
function getPrivateKey(network, address){
    var wallet = getWallet(),
        net    = (network=='testnet') ? 'testnet' : 'livenet',
        priv   = false;
    // Check any we have a match in imported addresses
    if(FW.WALLET_KEYS[address])
        priv = FW.WALLET_KEYS[address];
    // Loop through HD addresses trying to find private key
    if(!priv){
        var key = bitcore.HDPrivateKey.fromSeed(wallet, bitcore.Networks[net]),
            idx = false;
        FW.WALLET_ADDRESSES.forEach(function(item){
            if(item.address==address)
                idx = item.index;
        });
        // If we found the address index, use it to generate private key
        if(idx !== false){
            var d = key.derive("m/0'/0/" + idx),
                a = bitcore.Address(d.publicKey, bitcore.Networks[net]).toString();
            if(a==address)
                priv = d.privateKey.toWIF();
        } 
    }
    return priv;
}



// Handle updating the balances list
function updateBalancesList(){
    var html    = '',
        cnt     = 0,
        active  = 'BTC', // default to BTC being active
        addr    = FW.WALLET_ADDRESS,
        search  = $('.balances-list-search'),
        filter  = search.val(),
        info    = getAddressBalance(addr),
        btc     = getAddressBalance(addr, 'BTC'),
        xcp     = getAddressBalance(addr, 'XCP'),
        btc_amt = (btc) ? btc.quantity : 0,
        xcp_amt = (xcp) ? xcp.quantity : 0,
        btc_val = (btc) ? btc.estimated_value.usd : 0,
        xcp_val = (xcp) ? xcp.estimated_value.usd : 0,
        fmt     = '0,0.00000000',
        fmt_usd = '0,0.00',
        display = [];
    if(info && info.data.length){
        // Always display BTC balance
        display.push({ 
            asset: 'BTC', 
            icon: 'BTC', 
            quantity: numeral(btc_amt).format(fmt), 
            value: numeral(btc_val).format(fmt_usd), 
            cls: 'active' 
        });
        // Display XCP balance if we have one
        if(xcp_amt)
            display.push({ 
                asset: 'XCP', 
                icon: 'XCP', 
                quantity: numeral(xcp_amt).format(fmt), 
                value: numeral(xcp_val).format(fmt_usd), 
                cls: '' 
            });
        // Loop through balances and add
        info.data.forEach(function(item){
            if(item.asset.length>=4){
                var asset = (item.asset_longname!='') ? item.asset_longname : item.asset,
                    fmt   = (item.quantity.indexOf('.')!=-1) ? '0,0.00000000' : '0,0';
                display.push({ 
                    asset: asset, 
                    icon: item.asset, 
                    quantity: numeral(item.quantity).format(fmt), 
                    value: numeral(item.estimated_value.usd).format(fmt_usd), 
                    cls: '' 
                });
            }
        });
        display.forEach(function(item){
            var show = (filter!='') ? false : true;
            if(filter!='')
                show = (item.asset.search(new RegExp(filter, "i")) != -1) ? true : false;
            if(show){
                if(cnt % 2)
                    item.cls += ' striped'
                cnt++;
                html += getBalanceHtml(item);
            }
        });
    }
    // Update balances list with completed html
    $('.balances-list-assets ul').html(html);
    // Handle updating the 'active' item in the balances list
    // We need to do this every time we update the balances list content
    $('.balances-list ul li').click($.debounce(100,function(e){
        $('.balances-list ul li').removeClass('active');
        $(this).addClass('active');
        var asset = $(this).find('.balances-list-asset').text();
        loadAssetInfo(asset);
    }));
}


// Handle returning html for a asset balance item
function getBalanceHtml(data){
    var value = (data.value!='0.00') ? '$' + data.value : '';
    var html =  '<li class="balances-list-item ' + data.cls + '" data-asset="' + data.asset+ '">' +
                '    <div class="balances-list-icon">' +
                '        <img src="https://xchain.io/icon/' + data.icon + '.png" >' +
                '    </div>' +
                '    <div class="balances-list-info">' +
                '        <table width="100%">' +
                '        <tr>' +
                '            <td class="balances-list-asset" colspan="2">' + data.asset + '</div>' +
                '        <tr>' +
                '            <td class="balances-list-amount">' + data.quantity + '</td>' +
                '            <td class="balances-list-price">' + value + '</td>' +
                '        </tr>' +
                '        </table>' +
                '    </div>' +
                '</li>';
    return html;
}


// Handle updating the balances list
function updateHistoryList(){
    var html    = '',
        cnt     = 0,
        active  = 'BTC', // default to BTC being active
        addr    = FW.WALLET_ADDRESS,
        search  = $('.history-list-search'),
        filter  = search.val(),
        info    = getAddressHistory(addr),
        display = [];
    if(info && info.data.length){
        // Loop through history and add to display list
        info.data.forEach(function(item){
            // console.log('item=',item);
            var asset = (item.asset_longname!='') ? item.asset_longname : item.asset,
                fmt   = (item.quantity && item.quantity.indexOf('.')!=-1) ? '0,0.00000000' : '0,0';
            display.push({ 
                type: item.type,
                tx: item.tx,
                asset: asset, 
                icon: item.asset, 
                quantity: numeral(item.quantity).format(fmt), 
                timestamp: item.timestamp,
                // value: numeral(item.estimated_value.usd).format(fmt_usd), 
                cls: '' 
            });
        });
        display.forEach(function(item){
            var show = (filter!='') ? false : true;
            if(filter!=''){
                var re = new RegExp(filter, "i");
                if(String(item.asset).search(re)!=-1||String(item.tx).search(re)!=-1)
                    show = true;
            }
            if(show){
                if(cnt % 2)
                    item.cls += ' striped'
                cnt++;
                html += getHistoryHtml(item);
            }
        });
    }
    // Update balances list with completed html
    $('.history-list-transactions ul').html(html);
    // Handle updating the 'active' item in the balances list
    // We need to do this every time we update the balances list content
    $('.history-list-transactions ul li').click($.debounce(100,function(e){
        $('.history-list-transactions ul li').removeClass('active');
        $(this).addClass('active');
        var txhash = $(this).attr('txhash'),
            txtype = $(this).attr('txtype'),
            asset  = $(this).attr('asset');
        loadTransactionInfo({
            tx: txhash, 
            type: txtype, 
            asset: asset
        });
    }));
}



// Handle returning html for a history list / transaction item
function getHistoryHtml(data){
    // Determine the correct icon to display based on type
    var type = data.type,
        src  = 'images/icons/btc.png';
    if(type=='bet'){
        src = 'images/icons/xcp.png';
    } else if(type=='broadcast'){
        src = 'images/icons/broadcast.png';
    } else if(type=='dividend'){
        src = 'images/icons/dividend.png';
    } else if((type=='send'||type=='order'||type=='issuance') && data.asset!='BTC'){
        src = 'https://xchain.io/icon/'  + String(data.icon).toUpperCase() + '.png';
    }
    var icon = '<img src="' + src + '"/>';
    // Determine the correct description string to show
    var str  = '',
        amt  = String(data.quantity).replace('-','');
    if(type=='send'){
        str = (/\-/.test(data.quantity)) ? 'Sent ' : 'Received ';
    } else if(type=='bet'){
        str = 'Bet ';
    } else if(type=='broadcast'){
        str = 'Counterparty Broadcast';
    } else if(type=='burn'){
        str = 'Burned ';
    } else if(type=='dividend'){
        str = 'Paid Dividend on ';
    } else if(type=='issuance'){
        str = 'Counterparty Issuance';
    } else if(type=='order'){
        str = 'Order - Buy ';
    }
    if(type=='send'||type=='bet'||type=='burn'||type=='order')
        str += amt;
    var amount = str;
    // Determine correct class to use
    var cls  = data.cls;
    if(type=='send')
        cls += (/\-/.test(data.quantity)) ? ' history-list-sent' : ' history-list-received';
    if(type=='bet'||type=='burn')
        cls += ' history-list-sent';
    // Determine correct asset name to display (if any)
    var asset = (data.asset) ? data.asset : '';
    var html =  '<li class="history-list-item ' + cls + '" txhash="' + data.tx + '" txtype="' + type + '" + asset="' + asset + '">' +
                '    <div class="history-list-icon">' + icon + '</div>' +
                '    <div class="history-list-info">' +
                '        <table width="100%">' +
                '        <tr>' +
                '           <td>' +
                '                <div class="history-list-amount">' + amount + '</div>' +
                '                <div class="history-list-asset">' + asset + '</div>' +
                '                <div class="history-list-timestamp"><span data-livestamp='  + data.timestamp + ' class="nowrap"></span></div>' +
                '           </td>' +
                '        </tr>' +
                '        </table>' +
                '    </div>' +
                '</li>';
    return html;
}


// Handle resetting the asset information to a fresh/new state
function resetAssetInfo(asset){
    $('#asset-name').text(' ');
    $('#asset-value-btc').text(' ');
    $('#asset-value-xcp').text(' ');
    $('#asset-value-usd').text(' ');    
    $('#asset-total-supply').text(' ');
    $('#asset-marketcap').text(' ');
    $('#asset-last-price').text(' ')
    $('#rating_current').text('NA');
    $('#rating_30day').text('NA');
    $('#rating_6month').text('NA');
    $('#rating_1year').text('NA');
    $('#asset-info-enhanced').hide();

}


// Handle loading asset information 
// Be VERY VERY careful about how you use any data from an untrusted source!
// use .text() instead of .html() when updating DOM with untrusted data
function loadAssetInfo(asset){
    var asset    = String(asset).trim(),
        balance  = getAddressBalance(FW.WALLET_ADDRESS, asset),
        icon     = (balance && balance.asset) ? balance.asset : asset,
        feedback = $('#asset-reputation-feedback');
    if(balance){
        // Reset the asset info so we start fresh (prevent old info showing if we get failures)
        resetAssetInfo();
        // Name & Icon
        $('#asset-name').text(asset);
        $('#asset-icon').attr('src','https://xchain.io/icon/' + icon + '.png');
        $('#asset-info-more').attr('href','https://xchain.io/asset/' + asset);
        // Estimated Value
        var val = balance.estimated_value;
        $('#asset-value-btc').text(numeral(val.btc).format('0,0.00000000'));
        $('#asset-value-xcp').text(numeral(val.xcp).format('0,0.00000000'));
        $('#asset-value-usd').text('$' + numeral(val.usd).format('0,0.00'));
        var bal = balance.quantity,
            fmt = (balance.quantity.indexOf('.')==-1) ? '0,0' : '0,0.00000000';
        $('#asset-current-balance').text(numeral(bal).format(fmt));
        // Callback function to process asset information
        var cb = function(o){
            // console.log('o=',o);
            if(!o.error){
                var fmt = (String(o.supply).indexOf('.')==-1) ? '0,0' : '0,0.00000000';
                $('#asset-total-supply').text(numeral(o.supply).format(fmt));
                var xcp_usd = getAssetPrice('XCP'),
                    mcap    = numeral((o.estimated_value.xcp * o.supply) * xcp_usd).format('0,0.00'),
                    last    = numeral(o.estimated_value.xcp).format('0,0.00000000');
                $('#asset-marketcap').text('$' + mcap);
                $('#asset-last-price').text(last);
                $('#asset-description').text(o.description);
                // Only allow feedback on XCP and assets, not BTC
                if(asset=='BTC'){
                    feedback.hide();
                } else {
                    feedback.attr('href','https://reputation.coindaddy.io/xcp/asset/' + asset);
                    feedback.show();
                }
                // Display the description info if we have it
                var desc = String(o.description).toString(), // Make sure description is a string
                    re1  = /^(.*).json$/,
                    re2  = /^http:\/\//,
                    re3  = /^https:\/\//;   
                if(o.description!=''){
                    $('#asset-info-not-available').hide();
                    $('#asset-info').show();
                }
                $('#asset-description').text(o.description);
                // If the file starts with http and does NOT end with JSON, then assume it is valid url and link it
                if(!re1.test(desc) && (re2.test(desc)||re3.test(desc))){
                    // create element to ensure we are only injecting a link with text for description/name
                    var el = $('<a></a>').text(desc);
                    el.attr('target','_blank');
                    el.attr('href', desc);
                    $('#asset-description').html(el);
                }
                // Handle loading enhanced asset info
                if(re1.test(desc)){
                    loadExtendedInfo();
                } else if(asset=='BTC'){
                    loadExtendedInfo({
                        name: 'Bitcoin (BTC)',
                        description: 'Bitcoin is digital money',
                        website: 'https://bitcoin.org'
                    });
                } else if(asset=='XCP'){
                    loadExtendedInfo({
                        name: 'Counterparty (XCP)',
                        description: 'Counterparty is a free and open platform that puts powerful financial tools in the hands of everyone with an Internet connection. Counterparty creates a robust and secure marketplace directly on the Bitcoin blockchain, extending Bitcoin\'s functionality into a full fledged peer-to-peer financial platform.',
                        website: 'https://counterparty.io'
                    });
                } else {
                    if(o.description==''){
                        $('#asset-info-not-available').show();
                        $('#asset-info').hide();
                    }
                }
            }
        }
        // Callback function to process reputation information
        var cb2 = function(o){
            if(!o.error){
                var arr = ['current','30day','6month','1year'];
                arr.forEach(function(name){
                    var rating = o['rating_' + name],
                        text   = (rating>0) ? rating : 'NA';
                    $('#rating_' + name).html('<a href="https://reputation.coindaddy.io/xcp/asset/' + asset + '" target="_blank"><div class="rateit" data-rateit-readonly="true" data-rateit-value="' + rating + '" data-rateit-ispreset="true"></div></a> <span class="rateit-score">' + text + '</span>')
                });
                $('.rateit').rateit();
            }
        }
        // Hardcode the BTC values.. otherwise request the asset details
        if(asset=='BTC'){
            var btc = getAssetPrice('BTC',true),
                xcp = getAssetPrice('XCP',true);
            cb({
                asset: 'BTC',
                description: "Bitcoin is digital money",
                estimated_value: {
                    btc: 1,
                    usd: btc.market_cap_usd,
                    xcp: 1/xcp.price_btc
                },
                supply: btc.total_supply
            });
            cb2({
                asset: "BTC",
                verify_status: "Not Verified",
                rating_current: "5.00",
                rating_30day: "5.00",
                rating_6month: "5.00",
                rating_1year: "5.00"
            });
        } else {
            getAssetInfo(asset, cb);
            // Handle requesting reputation info from coindaddy.io
            $.getJSON('https://reputation.coindaddy.io/api/asset/xcp/' + asset, function( o ){  cb2(o); });
        }
    }
} 


// Function to handle requesting extended asset info (if any) and updating page with extended info
function loadExtendedInfo(data){
    var desc = $('#asset-description').text(),
        re1  = /^(.*).json$/,
        re2  = /^http:\/\//,
        re3  = /^https:\/\//;
    // If the file starts with http and does NOT end with JSON, then assume it is valid url and link it
    if(!re1.test(desc) && (re2.test(desc)||re3.test(desc)))
        $('#asset-description').html('<a href="' + desc + '" target="_blank">' + desc + '</a>');
    var url   = (re2.test(desc)||re3.test(desc)) ? desc : 'http://' + desc,
        json  = 'https://xchain.io/relay?url=' + desc;
    $('#asset-description').html('<a href="' + url + '" target="_blank">' + desc + '</a>');
    var cb = function(o){
        // console.log('o=',o);
        if(o && (o.website!=''||o.description!='')){
            $('#asset-info-enhanced').show();
            var name = (o.name && o.name!='') ? o.name : o.asset;
            $('#asset-info-name').text(name);
            // Update Website
            var html = '';
            if(o.website && o.website!='')
                html = '<a href="' + getValidUrl(o.website) + '" target="_blank">' + o.website + '</a>';
            $('#asset-info-website').html(html);
            $('#asset-info-pgpsig').text(o.pgpsig);
            // Run description through sanitizer to remove any XSS or other nasties
            if(o.description && o.description!=''){
                var html = sanitizer.sanitize(o.description);
                $('#asset-description').html(html);
            }
        } else {
            $('#asset-info-enhanced').hide();
        }
    };
    if(data){
        cb(data);
    } else {
        $.getJSON( json, function( o ){ cb(o); });
    }
}


// Handle building out the HTML for the address list
function updateAddressList(){
    var html   = '',
        cnt    = 0,
        addr   = FW.WALLET_ADDRESS,
        list   = $(".address-list ul"),
        search = $('.address-list-search'),
        type   = FW.WALLET_ADDRESS_TYPE;
        filter = search.val();
    FW.WALLET_ADDRESSES.forEach(function(item){
        if(item.network==FW.WALLET_NETWORK){
            var filterMatch = (filter=='') ? true : false,
                typeMatch   = (type==0) ? true : false,
                re          = new RegExp(filter,'i');
            if(filter && (re.test(item.label) || re.test(item.address)))
                filterMatch = true;
            if(type!=0 && item.type==type)
                typeMatch = true;
            // Only display if we have both filter and type matches
            if(filterMatch && typeMatch){
                cnt++;
                var cls = (item.address==addr) ? 'active' : '';
                if(cnt==2){
                    cls += ' striped'
                    cnt = 0;
                }
                var label   = item.label,
                    address = item.address;
                // Highlight the filter/search
                if(filter){
                    label   = label.replace(filter,'<span class="highlight-search-term">' + filter + '</span>');
                    address = address.replace(filter,'<span class="highlight-search-term">' + filter + '</span>');
                }
                var btc = getAddressBalance(address, 'BTC'),
                    xcp = getAddressBalance(address, 'XCP'),
                    btc_amt = (btc) ? btc.quantity : 0,
                    xcp_amt = (xcp) ? xcp.quantity : 0,
                    fmt = '0,0.00000000';
                html += '<li class="' + cls + ' address-list-item" data-address="' + address + '">';
                html += '    <div class="address-list-info">';
                html += '        <div class="address-list-label">' + label + '</div>';
                html += '        <div class="address-list-address">' + address + '</div>';
                html += '        <div class="address-list-amount"><div class="fw-icon-20 fw-icon-btc pull-left margin-right-5"></div> ' + numeral(btc_amt).format(fmt) + '</div>';
                html += '        <div class="address-list-amount"><div class="fw-icon-20 fw-icon-xcp pull-left margin-right-5"></div> ' + numeral(xcp_amt).format(fmt) + '</div>';
                html += '    </div>';
                html += '</li>';
            }
        }
    });
    if(html=='')
        html = '<div class="address-list-empty">No addresses found</div>';
    list.html(html);
    // Handle updating/toggling the 'active' item in the address list
    // We need to do this every time we update the address list content
    $('.address-list ul li').click($.debounce(100,function(e){
        $('.address-list ul li').removeClass('active');
        $(this).addClass('active');
        addr = $(this).find('.address-list-address').text();
        $('.selected-address').val(addr);
    }));
    // Treat double-clicks as if the user clicked the OK button
    $('.address-list ul li').dblclick($.debounce(100,function(e){
        $('.dialog-change-address .btn-ok').click();
    }));
}


// Handle loading asset information 
function loadTransactionInfo(data){
    // data = {
    //     type: 'order',
    //     tx: 'b11c049d86bc8386e42aa82b4f998062f65abb126c08155a3a443f141eabdf08',
    //     asset: ''
    // };
    FW.CURRENT_TRANSACTION = data;
    $('.history-content').load('html/history/' + data.type + '.html');
} 


// Function to handle making a URL a url valid by ensuring it starts with http or https
function getValidUrl( url ){
    var re1 = /^http:\/\//,
        re2 = /^https:\/\//;
    if(!(re1.test(url)||re2.test(url)))
        url = 'http://' + url;
    return url;
}

// Determine form type based on what form is visible
var getFormType = function(){
    var type = '';
    if($('#send-form').length)
        type = 'send';
    else if($('#create-token-form').length)
        type = 'create-token';
    else if($('#change-description-form').length)
        type = 'change-description';
    else if($('#issue-supply-form').length)
        type = 'issue-supply';
    else if($('#lock-supply-form').length)
        type = 'lock-supply';
    else if($('#transfer-ownership-form').length)
        type = 'transfer-ownership';
    else if($('#dividend-form').length)
        type = 'dividend';
    else if($('#sign-message-form').length)
        type = 'sign-message';
    else if($('#sign-transaction-form').length)
        type = 'sign-transaction';
    else if($('#broadcast-message-form').length)
        type = 'broadcast';
    else if($('#callback-form').length)
        type = 'callback';
    return type;
}


// Convert array of serialized form values into object with name:value pairs
function array2Object(arr){
    var vals   = {};
    for(var i=0;i<arr.length;i++){
        var o = arr[i];
        vals[o.name] = o.value;
    }
    return vals;
}

/*
 * Counterparty related functions
 */


// Handle generating a send transaction
function cpSend(network, source, destination, memo, currency, amount, fee, callback){
    var cb  = (typeof callback === 'function') ? callback : false;
    // Create unsigned send transaction
    createSend(network, source, destination, memo, currency, getSatoshis(amount), fee, function(o){
        if(o && o.result){
            // Sign the transaction
            signTransaction(network, source, o.result, function(signedTx){
                if(signedTx){
                    // Broadcast the transaction
                    broadcastTransaction(network, signedTx, function(txid){
                        if(txid){
                            if(cb)
                                cb(txid);
                        } else {
                            cbError('Error while trying to broadcast send transaction', cb);
                        }
                    });
                } else {
                    cbError('Error while trying to sign send transaction',cb);
                }
            });
        } else {
            var msg = (o.error && o.error.message) ? o.error.message : 'Error while trying to create send transaction';
            cbError(msg, cb);
        }
    });
}



// Handle creating/signing/broadcasting an 'Issuance' transaction
function cpIssuance(network, source, asset, quantity, divisible, description, destination, fee, callback){
    var cb  = (typeof callback === 'function') ? callback : false;
    // Create unsigned send transaction
    createIssuance(network, source, asset, quantity, divisible, description, destination, fee, function(o){
        if(o && o.result){
            // Sign the transaction
            signTransaction(network, source, o.result, function(signedTx){
                if(signedTx){
                    // Broadcast the transaction
                    broadcastTransaction(network, signedTx, function(txid){
                        if(txid){
                            if(cb)
                                cb(txid);
                        } else {
                            cbError('Error while trying to broadcast issuance transaction. Please try again.', cb);
                        }
                    });
                } else {
                    cbError('Error while trying to sign issuance transaction. Please try again.',cb);
                }
            });
        } else {
            var msg = (o.error && o.error.message) ? o.error.message : 'Error while trying to create issuance transaction';
            cbError(msg, cb);
        }
    });
}


// Handle creating/signing/broadcasting an 'Broadcast' transaction
function cpBroadcast(network, source, text, value, feed_fee, timestamp, fee, callback){
    var cb  = (typeof callback === 'function') ? callback : false;
    // Create unsigned send transaction
    createBroadcast(network, source, text, value, feed_fee, timestamp, fee, function(o){
        if(o && o.result){
            // Sign the transaction
            signTransaction(network, source, o.result, function(signedTx){
                if(signedTx){
                    // Broadcast the transaction
                    broadcastTransaction(network, signedTx, function(txid){
                        if(txid){
                            if(cb)
                                cb(txid);
                        } else {
                            cbError('Error while trying to broadcast transaction. Please try again.', cb);
                        }
                    });
                } else {
                    cbError('Error while trying to sign broadcast transaction. Please try again.',cb);
                }
            });
        } else {
            var msg = (o.error && o.error.message) ? o.error.message : 'Error while trying to create broadcast transaction';
            cbError(msg, cb);
        }
    });
}

// Handle creating/signing/broadcasting an 'Dividend' transaction
function cpDividend(network, source, asset, dividend_asset, quantity_per_unit, fee, callback){
    var cb  = (typeof callback === 'function') ? callback : false;
    // Create unsigned send transaction
    createDividend(network, source, asset, dividend_asset, quantity_per_unit, fee, function(o){
        if(o && o.result){
            // Sign the transaction
            signTransaction(network, source, o.result, function(signedTx){
                if(signedTx){
                    // Broadcast the transaction
                    broadcastTransaction(network, signedTx, function(txid){
                        if(txid){
                            if(cb)
                                cb(txid);
                        } else {
                            cbError('Error while trying to broadcast transaction. Please try again.', cb);
                        }
                    });
                } else {
                    cbError('Error while trying to sign dividend transaction. Please try again.',cb);
                }
            });
        } else {
            var msg = (o.error && o.error.message) ? o.error.message : 'Error while trying to create dividend transaction';
            cbError(msg, cb);
        }
    });
}


// Handle sending request to counterparty servers
function cpRequest(network, data, callback){
    var net  = (network=='testnet') ? 'testnet' : 'mainnet',
        info = FW.WALLET_SERVER_INFO[net],
        url  = ((info.ssl) ? 'https' : 'http') + '://' + info.host + ':' + info.port + '/api/',
        auth = $.base64.btoa(info.user + ':' + info.pass);
        // console.log('info=',info);
        // console.log('url=',url);
    // Send request to server, process response
    $.ajax({
        type: "POST",
        url: url,
        data: JSON.stringify(data),
        dataType: 'json',
        crossDomain: false,
        headers: {
            'Authorization': 'Basic ' + auth, 
            'Content-Type': 'application/json; charset=UTF-8'
        },
        success: function(data){
            if(typeof callback === 'function')
                callback(data);
        }
    });
}

// Handle creating send transaction
function createSend(network, source, destination, memo, asset, quantity, fee, callback){
    // console.log('createSend=',network, source, destination, asset, quantity, fee, callback);
    var data = {
       method: "create_send",
       params: {
            source: source,
            destination: destination,
            asset: asset,
            quantity: parseInt(quantity),
            allow_unconfirmed_inputs: true
        },
        jsonrpc: "2.0",
        id: 0
    };
    if(memo)
        data.params.memo = memo;
    if(fee)
        data.params.fee = fee;
    cpRequest(network, data, function(o){
        if(typeof callback === 'function')
            callback(o);
    });
}

// Handle creating issuance transaction
function createIssuance(network, source, asset, quantity, divisible, description, destination, fee, callback){
    // console.log('createIssuance=', network, source, asset, quantity, divisible, description, destination, fee, callback);
    var data = {
       method: "create_issuance",
       params: {
            source: source,
            asset: asset,
            quantity: parseInt(quantity),
            divisible: (divisible) ? 1 : 0,
            description: description,
            transfer_destination: (destination) ? destination : null,
            fee: parseInt(fee),
            allow_unconfirmed_inputs: true
        },
        jsonrpc: "2.0",
        id: 0
    };
    cpRequest(network, data, function(o){
        if(typeof callback === 'function')
            callback(o);
    });
}

// Handle creating broadcast transaction
function createBroadcast(network, source, text, value, feed_fee, timestamp, fee, callback){
    // console.log('createBroadcast=', network, source, text, value, feed_fee, timestamp, fee, callback);
    var data = {
       method: "create_broadcast",
       params: {
            source: source,
            text: text,
            value: value,
            fee_fraction: feed_fee,
            timestamp: timestamp,
            fee: parseInt(fee),
            allow_unconfirmed_inputs: true
        },
        jsonrpc: "2.0",
        id: 0
    };
    cpRequest(network, data, function(o){
        if(typeof callback === 'function')
            callback(o);
    });
}

// Handle creating dividend transaction
function createDividend(network, source, asset, dividend_asset, quantity_per_unit, fee, callback){
    // console.log('createDividend=', network, source, asset, dividend_asset, quantity_per_unit, fee, callback);
    var data = {
       method: "create_dividend",
       params: {
            source: source,
            asset: asset,
            dividend_asset: dividend_asset,
            quantity_per_unit: quantity_per_unit,
            fee: parseInt(fee),
            allow_unconfirmed_inputs: true
        },
        jsonrpc: "2.0",
        id: 0
    };
    cpRequest(network, data, function(o){
        if(typeof callback === 'function')
            callback(o);
    });
}

// Handle signing a transaction
function signTransaction(network, source, unsignedTx, callback){
    var net      = (network=='testnet') ? 'testnet' : 'mainnet',
        callback = (typeof callback === 'function') ? callback : false;
        privKey  = getPrivateKey(net, source)
        cwKey    = new CWPrivateKey(privKey);
    // update network (used in CWBitcore)
    NETWORK = bitcore.Networks[net];
    // Callback to processes response from signRawTransaction()
    var cb = function(x, signedTx){
        if(callback)
            callback(signedTx);
    }
    CWBitcore.signRawTransaction(unsignedTx, cwKey, cb);
}


// Handle signing a message and returning the signature
function signMessage(network, source, message){
    var bc  = bitcore,
        net = (network=='testnet') ? 'testnet' : 'mainnet',
        key = bc.PrivateKey.fromWIF(getPrivateKey(net, source)),
        sig = bc.Message(message).sign(key);
    return sig;
}


// Broadcast a given transaction
function broadcastTransaction(network, tx, callback){
    var net  = (network=='testnet') ? 'BTCTEST' : 'BTC',
        host = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io';
    // First try to broadcast using the XChain API
    $.ajax({
        type: "POST",
        url: 'https://' + host + '/api/send_tx',
        data: { 
            tx_hex: tx 
        },
        complete: function(o){
            // console.log('o=',o);
            // Handle successfull broadcast
            if(o.responseJSON.tx_hash){
                var txid = o.responseJSON.tx_hash;
                if(callback)
                    callback(txid);
                if(txid)
                    console.log('Broadcast transaction tx_hash=',txid);
            } else {
                // If the request to XChain API failed, fallback to chain.so API
                $.ajax({
                    type: "POST",
                    url: 'https://chain.so/api/v2/send_tx/' + net,
                    data: { 
                        tx_hex: tx 
                    },
                    dataType: 'json',
                    complete: function(o){
                        // console.log('o=',o);
                        if(o.responseJSON.data && o.responseJSON.data.txid){
                            var txid = o.responseJSON.data.txid;
                            if(callback)
                                callback(txid);
                            if(txid)
                                console.log('Broadcast transaction tx_hash=',txid);
                        } else {
                            cbError('Error while trying to broadcast signed transaction',callback);
                        }
                    }
                });                
            }
        }
    });
}



/* 
 * Dialog boxes 
 * https://nakupanda.github.io/bootstrap3-dialog/
 */

// Generic dialog box to handle simple messages
function dialogMessage( title, message, error, closable, callback ){
    var title = (error) ? '<i class="fa fa-lg fa-fw fa-exclamation-circle"></i> Error' : title; 
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-message',
        title: title,
        message: message,
        closable: (closable==false) ? false : true,
        buttons:[{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success',
            hotkey: 13,
            action: function(msg){
                msg.close();
                if(typeof callback === 'function')
                    callback();
            }
        }]                        
    });
}

// Generic dialog box to handle simple messages
function dialogConfirm( title, message, error, closable, callback ){
    var title = (error) ? '<i class="fa fa-lg fa-fw fa-exclamation-circle"></i> Error' : title; 
    BootstrapDialog.show({
        type: 'type-default',
        title: title,
        message: message,
        closable: (closable==false) ? false : true,
        buttons:[{
            label: 'No',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger',
            action: function(msg){
                msg.close();
            }
        },{
            label: 'Yes',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success',
            hotkey: 13,
            action: function(msg){
                msg.close();
                if(typeof callback === 'function')
                    callback();
            }
        }]                        
    });
}


// Function to handle closing dialog boxes by id
function dialogClose(id){
    $.each(BootstrapDialog.dialogs, function(dialog_id, dialog){
        if(dialog_id==id||typeof id === 'undefined')
            dialog.close();
    });
}

// 'Coming Soon' dialog box0
function dialogComingSoon(){
    dialogMessage('Coming Soon', 'The feature you are trying to access will be coming soon.', false);
}


// 'About Wallet' dialog box
function dialogAbout(){
    BootstrapDialog.show({
        type: 'type-default',
        title: '<i class="fa fa-lg fa-fw fa-info-circle"></i> About FreeWallet',
        id: 'dialog-about',
        message: $('<div></div>').load('html/about.html')
    });
}

// 'View Address' dialog box
function dialogViewAddress(address){
    BootstrapDialog.show({
        type: 'type-default',
        cssClass: 'btc-wallet-address',
        title: '<i class="fa fa-lg fa-fw fa-qrcode"></i> View Address',
        message: function(dialog){
            var msg = $('<div class="text-center"></div>');
            addr = (address) ? address : getWalletAddress();
            msg.qrcode({ text: addr });
            msg.append('<div style="margin-top:10px" class="btc-wallet-blackbox">' + addr + '</div>');
            return msg;
        },
        buttons:[{
            label: 'Cancel',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                dialog.close();
            }
        },{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                dialog.close();
            }
        }]
    });
}

// 'Remove Wallet Address' dialog box
function dialogRemoveWalletAddress(address){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('remove an address'))
        return;
    dialogConfirm( 'Are you Sure?', 'Remove address ' + address + ' from your wallet?', false, true, function(){ 
        removeWalletAddress(address);
        updateAddressList();
    });
}





// View Private key for current address
function dialogViewPrivateKey(address){
    // Make sure wallet is unlocked before showing send dialog box
    if(!ss.getItem('wallet')){
        dialogMessage('Wallet Locked!', 'You will need to unlock your wallet before you can view the private key', true);
        return;
    }
    BootstrapDialog.show({
        type: 'type-default',
        cssClass: 'dialog-view-privkey',
        title: '<i class="fa fa-lg fa-fw fa-user-secret"></i> Private Key for ' + FW.WALLET_ADDRESS,
        message: function(dialog){
            var msg  = $('<div class=""></div>'),
                net  = (FW.WALLET_NETWORK==2) ? 'testnet' : 'mainnet';
                addr = (address) ? address : FW.WALLET_ADDRESS,
                key  = getPrivateKey(net, addr);
            msg.append('<div style="margin-top:10px" class="btc-wallet-blackbox">' + key + '</div>');
            msg.append('<div class="alert alert-danger fade in center bold">' +
                            '<h3>Write this private key down and keep it safe!</h3>' +
                            '<ul>' +
                                '<li>Please make sure nobody can look over your shoulder or see your screen.</li>' +
                                '<li>If someone gets this private key, they also gain access to any funds.</li>' +
                            '</ul>' +
                        '</div>');
            return msg;
        },
        buttons:[{
            label: 'Cancel',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                dialog.close();
            }
        },{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                dialog.close();
            }
        }]
    });
}


// 'Change Address' dialog box
function dialogChangeAddress(){
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-change-address',
        cssClass: 'dialog-change-address',
        title: '<i class="fa fa-lg fa-fw fa-bitcoin"></i> Change Wallet Address',
        message: $('<div></div>').load('html/addresses.html'),
    });
}

// 'Create/Enter Password' dialog box
function dialogPassword( enable, callback ){
    var title = (enable) ? 'Enter new wallet password' : 'Enter wallet password';
    BootstrapDialog.show({
        type: 'type-default',
        title: '<i class="fa fa-lg fa-fw fa-lock"></i> ' + title,
        cssClass: 'btc-wallet-password',
        closable: false,
        message: function(dialog){
            var msg = $('<div></div>');
            msg.append('<input name="wallet_password" type="text" class="form-control"  placeholder="Enter Password" autocomplete="off" style="-webkit-text-security: disc;"/>');
            if(enable){
                msg.append('<input name="wallet_confirm_password" type="text" class="form-control"  placeholder="Confirm Password" autocomplete="off" style="margin: 10px 0px; -webkit-text-security: disc" />');
                msg.append('<p class="justify no-bottom-margin">This password will be used to encrypt your wallet to give you an additional layer of protection against unauthorized use.</p>')
            }
            return msg;
        },
        onshown: function(dialog){
            $('[name="wallet_password"]').focus();
        },
        buttons:[{
            label: 'Cancel',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                // Set flag to indicate user has skipped auth, and not prompt again until needed.
                if(!enable)
                    ss.setItem('skipWalletAuth',1)
                dialog.close();
                updateWalletOptions();
            }
        },{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                var pass = $('[name="wallet_password"]').val(),
                    err  = false;
                // Validate that password meets minimum requirements (7 chars, 1 number)
                if(pass.length <=6){
                    err = 'Wallet password must be at least 7 characters long';
                } else if(!/\d/.test(pass)){
                    err = 'Wallet password must contain at least 1 number';
                } else if(enable){
                    var confirm = $('[name="wallet_confirm_password"]').val();
                    if(pass!=confirm)
                        err = 'Password and Confirmation password do not match!';
                }
                if(err){
                    dialogMessage(null, err, true);
                } else {
                    // Enable wallet encryption
                    if(enable){
                        encryptWallet(pass);
                        lockWallet();
                        updateWalletOptions();
                        dialog.close();
                        dialogMessage('<i class="fa fa-lg fa-fw fa-lock"></i> Wallet password enabled', 'Your wallet password is now enabled and your wallet is encrypted.');
                    } else {
                        // Validate wallet password
                        if(isValidWalletPassword(pass)){
                            decryptWallet(pass);
                            dialog.close();
                            dialogMessage('<i class="fa fa-lg fa-fw fa-unlock"></i> Wallet unlocked', 'Your wallet is now unlocked and available for use');
                            updateWalletOptions();
                        } else {
                            dialogMessage(null, 'Invalid password', true);
                        }
                    }
                    // If we have a callback, call it
                    if(typeof callback=='function')
                        callback();
                }
            }
        }]
    });    
}

// 'Lock Wallet' dialog box
function dialogLock(){
    lockWallet();
    updateWalletOptions();
    dialogMessage('<i class="fa fa-lg fa-fw fa-lock"></i> Wallet locked', 'Your wallet has been locked and is unavailable for use.');
}

// 'View Passphrase' dialog box
function dialogPassphrase(){
    BootstrapDialog.show({
        type: 'type-default',
        cssClass: 'dialog-view-passphrase',
        title: '<i class="fa fa-lg fa-fw fa-eye"></i> View Wallet Passphrase',
        message: function(dialog){
            var msg = $('<div></div>');
            msg.append('<p>Your twelve-word wallet passphrase is shown in the black box below.</p>');
            msg.append('<div class="btc-wallet-passphrase">' + getWalletPassphrase() + '</div>');
            msg.append('<div class="alert alert-danger fade in center bold">' +
                            '<h3>Write your passphrase down and keep it safe!</h3>' +
                            '<ul>' +
                                '<li>If you lose this passphrase, you will lose access to your wallet <i>forever</i>.</p>' +
                                '<li>If someone gets your passphrase, they gain access to your wallet.</p>' +
                                '<li>We do not store your passphrase and cannot recover it if lost.</p>' +
                            '</ul>' +
                        '</div>');
            return msg;
        },
        buttons:[{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                dialog.close();
            }
        }]
    });
}


// 'Enter Passphrase' dialog box
function dialogManualPassphrase(){
    BootstrapDialog.show({
        type: 'type-default',
        title: '<i class="fa fa-lg fa-fw fa-keyboard-o"></i> Enter Passphrase',
        message: function(dialog){
            var msg = $('<div class="center"></div>');
            msg.append('<p>Please enter your existing 12-word wallet passphrase and click \'Ok\'</p>');
            msg.append('<input type="text" class="btc-wallet-passphrase" id="manualPassphrase" autocomplete="off" >');
            return msg;
        },
        onshown: function(dialog){
            $('#manualPassphrase').focus();
        },
        buttons:[{
            label: 'Cancel',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                dialogWelcome();
                dialog.close();
            }
        },{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                var val = $('#manualPassphrase').val(),
                    arr = val.split(' '),
                    err = false;
                if(arr.length<12){
                    err='Passphrase must be 12 words in length';
                } else if(!isValidWalletPassphrase(val)){
                    err='Invalid Passphrase';
                }
                if(err){
                    dialogMessage(null, err, true);
                } else {
                    resetWallet();
                    createWallet(val);
                    dialog.close();
                    dialogMessage('<i class="fa fa-lg fa-fw fa-info-circle"></i> Wallet Updated!', 'Your wallet has been updated to use the passphrase you just entered.', false, false);
                }
            }
        }]
    });
}


// 'New Wallet Passphrase' dialog box
function dialogNewPassphrase(){
    var pass = new Mnemonic(128).toWords().toString().replace(/,/gi, " ");
    BootstrapDialog.show({
        type: 'type-default',
        cssClass: 'dialog-new-passphrase',
        title: '<i class="fa fa-lg fa-fw fa-eye"></i> New Wallet Passphrase',
        closable: false,
        message: function(dialog){
            var msg = $('<div></div>');
            msg.append('<p>A passphrase has been created for you and is visible in the black box below. <br/>This passphrase lets you access your wallet and the funds it contains.</p>');
            msg.append('<div class="btc-wallet-passphrase">' + pass + '</div>');
            msg.append('<div class="alert alert-danger fade in center bold">' +
                            '<h3>Write your passphrase down and keep it safe!</h3>' +
                            '<ul>' +
                                '<li>If you lose this passphrase, you will lose access to your wallet <i>forever</i>.</p>' +
                                '<li>If someone gets your passphrase, they gain access to your wallet.</p>' +
                                '<li>We do not store your passphrase and cannot recover it if lost.</p>' +
                            '</ul>' +
                        '</div>');
            msg.append('<div class="checkbox" id="dialog-new-passphrase-confirm"><label><input type="checkbox" id="dialog-new-passphrase-checkbox"> I have <u>written down</u> or otherwise <u>securely stored</u> my passphrase.</label></div>');
            return msg;
        },
        buttons:[{
            label: 'Cancel',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                dialogWelcome();
                dialog.close();
            }
        },{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                if($('#dialog-new-passphrase-checkbox').is(':checked')){
                    createWallet(pass)
                    dialog.close();
                } else {
                    $('#dialog-new-passphrase-confirm').effect( "shake", { times: 3, direction: 'up' }, 1000);
                }
            }
        }]
    });
}

// 'Import Private Key' dialog box
function dialogImportPrivateKey(){
    BootstrapDialog.show({
        type: 'type-default',
        title: '<i class="fa fa-lg fa-fw fa-upload"></i> Import Private Key',
        message: function(dialog){
            var msg = $('<div class="center"></div>');
            msg.append('<p>Please enter your unencrypted private key and click \'Ok\'</p>');
            msg.append('<input type="text" class="btc-wallet-blackbox" id="importPrivateKey">');
            return msg;
        },
        onshown: function(dialog){
            $('#importPrivateKey').focus();
        },
        buttons:[{
            label: 'Cancel',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                dialog.close();
            }
        },{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                var val  = $('#importPrivateKey').val();
                    addr = addWalletPrivkey(val);
                if(addr){
                    dialogMessage('<i class="fa fa-lg fa-fw fa-info-circle"></i> Private Key Imported', 'Address ' + addr + ' has been added to your wallet.');
                    dialog.close();
                    updateAddressList();
                } else {
                    dialogMessage('<i class="fa fa-lg fa-fw fa-info-circle"></i> Error', 'Unable to import the private key you have provided!');
                }
            }
        }]
    });
}

// 'Import Watch-Only' dialog box
function dialogImportWatchAddress(){
    BootstrapDialog.show({
        type: 'type-default',
        title: '<i class="fa fa-lg fa-fw fa-eye"></i> Add Watch-Only Address',
        message: function(dialog){
            var msg = $('<div class="center"></div>');
            msg.append('<p>Please enter the address you would like to add and click \'Ok\'</p>');
            msg.append('<input type="text" class="btc-wallet-blackbox" id="importWatchOnlyAddress">');
            return msg;
        },
        onshown: function(dialog){
            $('#importWatchOnlyAddress').focus();
        },
        buttons:[{
            label: 'Cancel',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                dialog.close();
            }
        },{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                var address = $('#importWatchOnlyAddress').val(),
                    network = 'mainnet',
                    valid   = false;
                // Check if the address is valid on mainnet
                NETWORK  = bitcore.Networks[network];
                if(CWBitcore.isValidAddress(address))
                    valid = true;
                // Check if address is valid on testnet
                if(!valid){
                    network = 'testnet';
                    NETWORK = bitcore.Networks[network];
                    if(CWBitcore.isValidAddress(address))
                        valid = true;
                }
                if(valid){
                    var cnt   = 0,
                        found = false;
                    FW.WALLET_ADDRESSES.forEach(function(item){
                        if(item.address==address)
                            found = true;
                        if(item.type==3)
                            cnt++;
                    });
                    // Only add address if it does not exist in the wallet
                    if(!found){
                        addWalletAddress(network, address, 'Watch-Only Address #' + (cnt + 1), 3, null);
                        // Save wallet addresses info to disk
                        ls.setItem('walletAddresses', JSON.stringify(FW.WALLET_ADDRESSES));
                    }
                    // Display success message to users
                    dialogMessage('<i class="fa fa-lg fa-fw fa-info-circle"></i> Watch-Only Address Added', 'Address ' + address + ' has been added to your wallet.');
                    updateAddressList();
                    dialog.close();
                } else {
                    dialogMessage('<i class="fa fa-lg fa-fw fa-info-circle"></i> Error', 'Invalid Address! Please enter a valid address!');
                }
            }
        }]
    });
}

// Function to handle checking if the wallet is unlocked and displaying an error, and return false if 
function dialogCheckLocked(action, callback){
    if(!ss.getItem('wallet')){
        dialogMessage('Wallet Locked!', 'You will need to unlock your wallet before you can ' + action, true, true, callback);
        return true;
    }
}

// 'Send Funds' dialog box
function dialogSend(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('send funds'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-send',
        cssClass: 'dialog-send-funds',
        title: '<i class="fa fa-fw fa-paper-plane"></i> Send Funds',
        message: $('<div></div>').load('html/send.html'),
    });
}

// 'Create Token' dialog box
function dialogCreateToken(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('create a token'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-create-token',
        title: '<i class="fa fa-fw fa-plus-circle"></i> Create a Token',
        message: $('<div></div>').load('html/issuance/token.html'),
    });
}

// 'Change Description' dialog box
function dialogChangeDescription(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('change a token description'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-change-description',
        title: '<i class="fa fa-fw fa-edit"></i> Change Token Description',
        message: $('<div></div>').load('html/issuance/description.html'),
    });
}


// 'Issue Supply' dialog box
function dialogIssueSupply(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('issue token supply'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-issue-supply',
        title: '<i class="fa fa-fw fa-bank"></i> Issue Supply',
        message: $('<div></div>').load('html/issuance/supply.html'),
    });
}

// 'Transfer Ownership' dialog box
function dialogTransferOwnership(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('transfer ownership of a token'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-transfer-ownership',
        title: '<i class="fa fa-fw fa-exchange"></i> Transfer Ownership',
        message: $('<div></div>').load('html/issuance/transfer.html'),
    });
}

// 'Lock Supply' dialog box
function dialogLockSupply(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('lock the supply of a token'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-lock-supply',
        title: '<i class="fa fa-fw fa-lock"></i> Lock Supply',
        message: $('<div></div>').load('html/issuance/lock.html'),
    });
}

// 'Lock Supply' dialog box
function dialogBroadcastMessage(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('broadcast a message'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-broadcast-message',
        title: '<i class="fa fa-fw fa-bullhorn"></i> Broadcast Message',
        message: $('<div></div>').load('html/broadcast.html'),
    });
}

// 'Sign Message' dialog box
function dialogSignMessage(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('sign a message'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-sign-message',
        title: '<i class="fa fa-fw fa-envelope"></i> Sign Message',
        message: $('<div></div>').load('html/sign-message.html'),
    });
}

// 'Sign Transaction' dialog box
function dialogSignTransaction(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('sign a transaction'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-sign-transaction',
        title: '<i class="fa fa-fw fa-file-text"></i> Sign Transaction',
        message: $('<div></div>').load('html/sign-transaction.html'),
    });
}


// 'Pay Distribution / Dividend' dialog box
function dialogPayDividend(){
    // Make sure wallet is unlocked
    if(dialogCheckLocked('pay dividends'))
        return;
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-pay-dividend',
        title: '<i class="fa fa-fw fa-sitemap"></i> Pay Dividends',
        message: $('<div></div>').load('html/dividend.html')
    });
}

// Confirm with user that they want to perform a callback to a remote server
function dialogConfirmCallback(data){
    BootstrapDialog.show({
        type: 'type-default',
        id: 'dialog-confirm-callback',
        title: '<i class="fa fa-fw fa-question-circle"></i> Send data to remote server?',
        message: $('<div></div>').load('html/callback.html')
    }); 
}


// 'Confirm Send' dialog box
function dialogLogout(){
    BootstrapDialog.show({
        type: 'type-default',
        cssClass: 'dialog-logout',
        title: '<i class="fa fa-lg fa-fw fa-power-off"></i> Logout?',
        message: function(dialog){
            var msg = $('<div class="center"></div>');
            msg.append('<p>Are you sure you want to logout of Freewallet?</p>');
            msg.append('<p>This action will remove all of your wallet information from this device.');
            msg.append('<p><div class="alert alert-danger fade in center bold">Please make sure your 12-word passphrase is written down before you logout!</p>');
            msg.append('<div class="checkbox" id="dialog-logout-confirm"><label><input type="checkbox" id="dialog-logout-confirm-checkbox"> I have <u>written down</u> or otherwise <u>securely stored</u> my passphrase before logging out.</label></div>');
            return msg;
        },
        buttons:[{
            label: 'No',
            icon: 'fa fa-lg fa-fw fa-thumbs-down',       
            cssClass: 'btn-danger', 
            action: function(dialog){
                dialog.close();
            }
        },{
            label: 'Yes',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',       
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                if($('#dialog-logout-confirm-checkbox').is(':checked')){
                    resetWallet();
                    dialog.close();
                    dialogMessage('<i class="fa fa-lg fa-fw fa-trash"></i> Logout Complete', 'Your wallet information has been removed. You will now be returned to the setup screen.', false, false, function(){
                        dialogWelcome();
                    });
                } else {
                    $('#dialog-logout-confirm').effect( "shake", { times: 3, direction: 'up' }, 1000);
                }
            }
        }]
    });
}



// 'Welcome' dialog box
function dialogWelcome(){
    BootstrapDialog.show({
        type: 'type-default',
        cssClass: 'dialog-welcome',
        closable: false,
        title: '<i class="fa fa-lg fa-fw fa-info-circle"></i> Welcome to FreeWallet',
        message: function(dialog){
            var msg = $('<div class="text-center"></div>');
            msg.append('<img src="images/logo.png" style="width:200px;margin-bottom:20px;">');
            msg.append('<p>FreeWallet is a free wallet for Bitcoin and Counterparty, the world’s first protocol for decentralized financial tools.</p>')
            msg.append( '<div class="row">' +
                            '<div class="col-xs-12 col-sm-6">' +
                                '<h3><i class="fa fa-lock"></i> Secure</h3>'+
                                '<p>All encryption is handled client-side. Neither your passphrase nor any of your private information ever leaves your browser, workstation, or mobile device.</p>' +
                                '<p>FreeWallet passphrases are highly secure, and protect your wallet from any brute force attacks. They are also rather easy to learn and hard to mistype.</p>' +
                            '</div>' +
                            '<div class="col-xs-12 col-sm-6">' +
                                '<h3><i class="fa fa-cloud"></i> Simple</h3>'+
                                '<p>With FreeWallet, your passphrase is literally your wallet, and all of your addresses and keys are generated on-the-fly when you log in.</p>' +
                                '<p>There are no wallet files to backup or secure, and using your passphrase you can access your wallet from any trusted machine with a web browser.</p>' +
                            '</div>' +
                       '</div>');
            return msg;
        },
        buttons:[{
            label: 'Login to Existing Wallet',
            icon: 'fa fa-lg fa-fw fa-keyboard-o pull-left',       
            cssClass: 'btn-info pull-left', 
            action: function(dialog){
                dialogManualPassphrase();
                dialog.close();
            }
        },{
            label: 'Create New Wallet',
            icon: 'fa fa-lg fa-fw fa-plus pull-left',
            cssClass: 'btn-success pull-right', 
            hotkey: 13,
            action: function(dialog){
                dialogNewPassphrase();
                dialog.close();
            }
        }]
    });
}

function dialogLicenseAgreement(){
    BootstrapDialog.show({
        type: 'type-default',
        cssClass: 'dialog-license-agreement',
        closable: false,
        title: '<i class="fa fa-lg fa-fw fa-info-circle"></i> License Agreement',
        message: function(dialog){
            var license = '';
            var content = $('<div></div>').load('html/license.html', function(foo){ 
                license = foo;
            });
            var msg = $('<div></div>');
            msg.append('<p>You must read and accept the following agreement in order to use FreeWallet:</p>')
            msg.append( '<div class="well">' +
                            '<h3>1. GRANT OF LICENSE</h3>' +
                            '<p><b>1.1.</b> Subject to the terms and conditions contained within this end user agreement (the “Agreement“), Freewallet.io grants the “User” (or “you”) a non-exclusive, personal, non-transferable right to use the Services on your personal computer or other device that accesses the Internet, namely freewallet.io, FreeWallet Mobile, FreeWallet Desktop, and Counterparty federated nodes (together, the “Services“). By clicking the “I Agree“ button if and where provided and/or using the Service, you consent to the terms and conditions set forth in this Agreement.</p>' +
                            '<p><b>1.2.</b> The Services are not for use by (i) individuals under 18 years of age, (ii) individuals under the legal age of majority in their jurisdiction and (iii) individuals accessing the Services from jurisdictions from which it is illegal to do so. Counterwallet.io and Counterwallet federated nodes are unable to verify the legality of the Services in each jurisdiction and it is the User\'s responsibility to ensure that their use of the Services is lawful. Freewallet.io, FreeWallet Mobile, and FreeWallet Desktop are neither banks nor regulated financial services. Operators do not have access to the Bitcoins stored on the platform, instead Freewallet.io, FreeWallet Mobile, and FreeWallet Desktopsimply provide a means to access Bitcoins, Counterparty (XCP), and other digital assets recorded on the Bitcoin blockchain. Bitcoin private keys are encrypted using the BIP32 Hierarchical Deterministic Wallet algorithm such that Freewallet.io, FreeWallet Mobile, and FreeWallet Desktop cannot access or recover Bitcoins, Counterparty (XCP), or other digital assets in the event of lost or stolen password. </p>' +
                            '<h3>2. NO WARRANTIES.</h3>' +
                            '<p><b>2.1.</b> COUNTERPARTY, FREEWALLET.IO, AND COUNTERPARTY FEDERATED NODES DISCLAIM ANY AND ALL WARRANTIES, EXPRESSED OR IMPLIED, IN CONNECTION WITH THE SERVICES WHICH ARE PROVIDED TO THE USER “AS IS“ AND NO WARRANTY OR REPRESENTATION IS PROVIDED WHATSOEVER REGARDING ITS QUALITY, FITNESS FOR PURPOSE, COMPLETENESS OR ACCURACY.</p>' +
                            '<p><b>2.2.</b> REGARDLESS OF BEST EFFORTS, WE MAKE NO WARRANTY THAT THE SERVICES WILL BE UNINTERRUPTED, TIMELY OR ERROR-FREE, OR THAT DEFECTS WILL BE CORRECTED.</p>' +
                            '<h3>3. YOUR REPRESENTATIONS AND WARRANTIES</h3>' +
                            '<p>Prior to your use of the Services and on an ongoing basis you represent, warrant, covenant and agree that:</p>' +
                            '<p><b>3.1.</b> your use of the Services is at your sole option, discretion and risk, as neither Freewallet.io, Counterparty federated nodes, nor any individuals affiliated with the Freewallet or Counterparty teams can be held responsible for lost or stolen funds;</p>' +
                            '<p><b>3.2.</b> you are solely responsible for satisfying any and all applicable legal rules and/or obligations, to include the requirements of your local tax authorities, arising from your use of the Services in a given jurisdiction; </p>' +
                            '<p><b>3.3.</b> the telecommunications networks and Internet access services required for you to access and use the Services are entirely beyond the control of the Services and neither Counterparty nor the Services shall bear any liability whatsoever for any outages, slowness, capacity constraints or other deficiencies affecting the same; and</p>' +
                            '<p><b>3.4.</b> you are at least 18 years of age.</p>' +
                            '<h3>4. PROHIBITED USES</h3>' +
                            '<p><b>4.1</b> A user must not use the Services in any way that causes, or may cause, damage to the website or impairment of the availability or accessibility of the website; or in any way which is unlawful, illegal, fraudulent or harmful, or in connection with any unlawful, illegal, fraudulent or harmful purpose or activity. </p>' +
                            '<h3>5. BREACH</h3>' +
                            '<p><b>5.1.</b> Without prejudice to any other rights, if a User breaches in whole or in part any provision contained herein, Counterparty and/or the Services reserve the right to take such action as they deem fit, including terminating this Agreement or any other agreement in place with the User and/or taking legal action against such User.</p>' +
                            '<p><b>5.2.</b> You agree to fully indemnify, defend and hold harmless the Services and their operators and agents from and against all claims, demands, liabilities, damages, losses, costs and expenses, including legal fees and any other charges whatsoever, irrespective of cause, that may arise as a result of: (i) your breach of this Agreement, in whole or in part; (ii) violation by you of any law or any third party rights; and (iii) use by you of the Services.</p>' +
                            '<h3>6. LIMITATION OF LIABILITY</h3>' +
                            '<p><b>6.1.</b> Under no circumstances, including negligence, shall Counterparty nor the Services be liable for any special, incidental, direct, indirect or consequential damages whatsoever (including, without limitation, damages for loss of business profits, business interruption, loss of business information, or any other pecuniary loss) arising out of the use (or misuse) of the Services even if Counterparty and/or the Services had prior knowledge of the possibility of such damages.</p>' +
                            '<h3>7. AMENDMENT</h3>' +
                            '<p>Counterparty and the Services reserve the right to update or modify this Agreement or any part thereof at any time or otherwise change the Services without notice and you will be bound by such amended Agreement upon publication. Therefore, we encourage you check the terms and conditions contained in the version of the Agreement in force at such time. Your continued use of the Service shall be deemed to attest to your agreement to any amendments to the Agreement.</p>' +
                            '<h3>8. GOVERNING LAW</h3>' +
                            '<p>The Agreement and any matters relating hereto shall be governed by, and construed in accordance with, the laws of the state of California and the United States. You irrevocably agree that, subject as provided below, the courts of California shall have exclusive jurisdiction in relation to any claim, dispute or difference concerning the Agreement and any matter arising therefrom and irrevocably waive any right that it may have to object to an action being brought in those courts, or to claim that the action has been brought in an inconvenient forum, or that those courts do not have jurisdiction. Nothing in this clause shall limit the right of the Services to take proceedings against you in any other court of competent jurisdiction, nor shall the taking of proceedings in any one or more jurisdictions preclude the taking of proceedings in any other jurisdictions, whether concurrently or not, to the extent permitted by the law of such other jurisdiction.</p>' +
                            '<h3>9. SEVERABILITY</h3>' +
                            '<p>If a provision of this Agreement is or becomes illegal, invalid or unenforceable in any jurisdiction, that shall not affect the validity or enforceability in that jurisdiction of any other provision hereof or the validity or enforceability in other jurisdictions of that or any other provision hereof.</p>' +
                            '<h3>10. ASSIGNMENT</h3>' +
                            '<p>Counterparty and the Services reserve the right to assign this agreement, in whole or in part, at any time without notice. The User may not assign any of his/her rights or obligations under this Agreement.</p>' +
                            '<h3>11. MISCELLANEOUS</h3>' +
                            '<p><b>11.1.</b> No waiver by Counterparty nor by the Services of any breach of any provision of this Agreement (including the failure of Counterparty and/or the Services to require strict and literal performance of or compliance with any provision of this Agreement) shall in any way be construed as a waiver of any subsequent breach of such provision or of any breach of any other provision of this Agreement.</p>' +
                            '<p><b>11.2.</b> Nothing in this Agreement shall create or be deemed to create a partnership, agency, trust arrangement, fiduciary relationship or joint venture between you the User and Counterparty, nor between you the User and the Services, to any extent.</p>' +
                            '<p><b>11.3.</b> This Agreement constitutes the entire understanding and agreement between you the User and Counterparty and the Services regarding the Services and supersedes any prior agreement, understanding, or arrangement between the same.</p>' +
                '</div>');
            msg.append('<div class="checkbox" id="dialog-license-agreement-confirm"><label><input type="checkbox" id="dialog-license-agreement-checkbox"> I have <u><i><b>read and accept</b></i></u> the above License Agreement.</label></div>');
            return msg;
        },
        buttons:[{
            label: 'Ok',
            icon: 'fa fa-lg fa-fw fa-thumbs-up',
            cssClass: 'btn-success', 
            hotkey: 13,
            action: function(dialog){
                if($('#dialog-license-agreement-checkbox').is(':checked')){
                    ls.setItem('licenseAgreementAccept',1);
                    dialog.close();
                } else {
                    $('#dialog-license-agreement-confirm').effect( "shake", { times: 3, direction: 'up' }, 1000);
                }
            }
        }]
    });
}


// Handle displaying a context menu based on target
function displayContextMenu(event){
   var menu = false;

    // Balances list items context menu
    var el = $( event.target ).closest('.balances-list-item');
    if(el.length!=0){
        var asset = el.attr('data-asset'),
            mnu   = new nw.Menu();
        // Save asset data so it can be accessed in dialog boxes
        FW.DIALOG_DATA = { token: asset };
        mnu.append(new nw.MenuItem({ 
            label: 'View ' + asset + ' Information',
            click: function(){ loadAssetInfo(asset); }
        }));
        mnu.append(new nw.MenuItem({ 
            label: 'View ' + asset + ' DEX Markets',
            click: function(){ loadPage('exchange'); }
        }));
        mnu.append(new nw.MenuItem({ type: 'separator' }));
        mnu.append(new nw.MenuItem({ 
            label: 'Send ' + asset + ' to...',
            click: function(){ dialogSend(); }
        }));
        if(asset!='BTC' && asset!='XCP'){
            mnu.append(new nw.MenuItem({ 
                label: 'Pay Dividends on ' + asset,
                click: function(){ dialogPayDividend(); }
            }));
        }
        if(asset!='BTC' && asset!='XCP'){
            mnu.append(new nw.MenuItem({ type: 'separator' }));
            mnu.append(new nw.MenuItem({ 
                label: 'Issue ' + asset + ' Supply',
                click: function(){ dialogIssueSupply(); }
            }));
            mnu.append(new nw.MenuItem({ 
                label: 'Lock ' + asset + ' Supply',
                click: function(){ dialogLockSupply(); }
            }));
            mnu.append(new nw.MenuItem({ 
                label: 'Change ' + asset + ' Description',
                click: function(){ dialogChangeDescription(); }
            }));
            mnu.append(new nw.MenuItem({ 
                label: 'Transfer Ownership of ' + asset,
                click: function(){ dialogTransferOwnership(); }
            }));
        }
        menu = mnu;
    }

    // History / Transaction List
    var el = $( event.target ).closest('.history-list-item');
    if(el.length!=0){
        var tx   = el.attr('txhash'),
            net  = (FW.WALLET_NETWORK==2) ? 'tbtc' : 'btc',
            net2 = (FW.WALLET_NETWORK==2) ? 'BTCTEST' : 'BTC',
            host = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io',
            mnu  = new nw.Menu();
        mnu.append(new nw.MenuItem({ 
            label: 'View Transaction',
            click: function(){ 
                var txhash = el.attr('txhash'),
                    txtype = el.attr('txtype'),
                    asset  = el.attr('asset');
                loadTransactionInfo({
                    tx: txhash, 
                    type: txtype, 
                    asset: asset
                });
            }
        }));
        mnu.append(new nw.MenuItem({ type: 'separator' }));
        mnu.append(new nw.MenuItem({ 
            label: 'View on XChain.io',
            click: function(){ 
                var host = (FW.WALLET_NETWORK==2) ? 'testnet.xchain.io' : 'xchain.io';
                    url  = 'https://' + host + '/tx/' + tx;
                nw.Shell.openExternal(url);
            }
        }));
        mnu.append(new nw.MenuItem({ 
            label: 'View on Blocktrail.com',
            click: function(){ 
                var net = (FW.WALLET_NETWORK==2) ? 'tBTC' : 'BTC',
                    url  = 'https://www.blocktrail.com/' + net + '/tx/' + tx;
                nw.Shell.openExternal(url);
            }
        }));
        mnu.append(new nw.MenuItem({ 
            label: 'View on Chain.so',
            click: function(){ 
                var net = (FW.WALLET_NETWORK==2) ? 'BTCTEST' : 'BTC',
                    url  = 'https://chain.so/tx/' + net + '/' + tx;
                nw.Shell.openExternal(url);
            }
        }));
        menu = mnu;
    }

    // Address List 
    var el = $( event.target ).closest('.address-list-item');
    if(el.length!=0){
        var addr = el.attr('data-address'),
            info = getWalletAddressInfo(addr),
            mnu  = new nw.Menu();

        mnu.append(new nw.MenuItem({ 
            label: 'View Address',
            click: function(){ 
                dialogViewAddress(addr);
            }
        }));
        // Don't display 'View Private Key' option for watch-only addresses
        if(info.type!=3){
            mnu.append(new nw.MenuItem({ 
                label: 'View Private Key',
                click: function(){ 
                    dialogViewPrivateKey(addr);
                }
            }));
        }
        mnu.append(new nw.MenuItem({ type: 'separator' }));
        mnu.append(new nw.MenuItem({ 
            label: 'Remove',
            click: function(){ 
                dialogRemoveWalletAddress(addr);
            }
        }));
        menu = mnu;
    }


    // Generic context menu
    if(!menu){
        if(!nw.genericMenu){
            var mnu  = new nw.Menu(),
                clip = nw.Clipboard.get();
            mnu.append(new nw.MenuItem({ 
                label: 'Copy',
                click: function(){ document.execCommand("copy"); }
            }));
            mnu.append(new nw.MenuItem({ 
                label: 'Cut',
                click: function(){ document.execCommand("cut"); }
            }));
            mnu.append(new nw.MenuItem({ 
                label: 'Paste',
                click: function(){ document.execCommand("paste"); }
            }));
            nw.copyPasteMenu = mnu;
        }
        menu = nw.copyPasteMenu;
    }
    // Display menu at event location
    if(menu)
        menu.popup(event.clientX, event.clientY);
}




// Handle extracting hostname from a url
function getUrlHostname(url){
    var arr  = url.split('/');
    // Remove protocol (http/https)
    var host = (url.indexOf("://") > -1) ? arr[2] : arr[0];
    // Remove Port
    host = host.split(':')[0];
    return host;
}


// Handle processing any URI data that is passed
function processURIData(data){
    if(data){
        var addr = data,
            btc  = /^(bitcoin|counterparty):/i,
            url  = /^(http|https):/i,
            o    = { valid: false };
        // Handle parsing in bitcoin and counterparty URI data
        if(btc.test(data)){
            // Extract data into object
            var x    = data.replace(btc,'').split('?'),
                y    = (x[1]) ? x[1].split('&') : [],
                addr = x[0];
            for (var i = 0; i < y.length; i++){
                var z = y[i].split('=');
                o[decodeURIComponent(z[0])] = decodeURIComponent(z[1]).replace(/\+/g,' ').trim();
            }
        }
        // Use message since bitcoin already uses that name
        if(o.memo)
            o.message = o.memo;
        // Handle validating that the provided address is valid
        if(addr.length>25 && CWBitcore.isValidAddress(addr)){
            o.valid   = true;
            o.address = addr;
        } else {
            // If action is specified, assume valid
            if(o.action)
                o.valid = true;
            if(url.test(data)){
                o.valid = true;
                o.url   = data;
            }
        }
    }
    // If we have valid data, then process it
    if(o.valid){
        // Define callback to prompt user for password, and retry after wallet is unlocked
        var cb = function(){ 
            dialogPassword(false, function(){ 
                processURIData(data); 
            }) 
        };
        // Handle actions
        if(o.action){
            // Handle signing messages
            if(o.action=='sign'){
                // Check if wallet is locked... if so, notify user that they have to unlock wallet
                if(dialogCheckLocked('sign a message', cb))
                    return;
                if(o.callback){
                    // Use given address or default to current address
                    var addr = (o.address) ? o.address : FW.WALLET_ADDRESS,
                        host = getUrlHostname(o.callback),
                        key  = getPrivateKey(FW.WALLET_NETWORK, addr);
                    // Only proceed if we were able to get the key for the address
                    if(key){
                        var sig = signMessage(FW.WALLET_NETWORK, addr, o.message);
                        if(sig){
                            o.address   = addr;
                            o.signature = sig;
                            // Confirm with user that they want to perform callback to remote server
                            FW.DIALOG_DATA = o;
                            dialogConfirmCallback();
                        } else {
                            dialogMessage('Error','Error while trying to sign message!', true);
                        }
                    } else {
                        dialogMessage('Error','Unable to sign message with given address!', true);
                    }
                } else {
                    // Show 'Send' tool and pass forward scanned 
                    FW.DIALOG_DATA = {
                        message: o.message || '',
                    }
                    dialogSignMessage();
                }
            }
            // Show 'Broadcast' dialog box and pass message to broadcast
            if(o.action=='broadcast'){
                // Check if wallet is locked... if so, notify user that they have to unlock wallet
                if(dialogCheckLocked('broadcast a message', cb))
                    return;
                FW.DIALOG_DATA = {
                    message: o.message || '',
                }
                dialogBroadcastMessage();
            }
            // Show 'Sign Transaction' dialog box and pass transaction
            if(o.action=='signtx'){
                // Check if wallet is locked... if so, notify user that they have to unlock wallet
                if(dialogCheckLocked('sign a transaction', cb))
                    return;
                FW.DIALOG_DATA = {
                    tx: o.tx || '',
                }
                dialogSignTransaction();
            }
        } else if(o.address){
            // Check if wallet is locked... if so, notify user that they have to unlock wallet
            if(dialogCheckLocked('send funds', cb))
                return;
            // Show 'Send' tool and pass forward scanned 
            FW.DIALOG_DATA = {
                destination: o.address,
                token: o.asset || 'BTC',
                amount: o.amount || '',
                message: o.message || ''
            }
            dialogSend();
        // Handle processing URL externally
        } else if(o.url && /^(http|https):/i.test(o.url)){
            var host = getUrlHostname(o.url);
            dialogConfirm( 'Are you Sure?', 'Open url to ' + host + '?', false, true, function(){ 
                nw.Shell.openExternal(o.url);
            });
        } else {
            // Throw generic failure message if we were not able to 
            dialogMessage('Error','Unable to perform action using given data!', true);
        }                         
    }
}


