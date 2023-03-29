/*
 * Custom functions used to communicate with the wallet
 * 
 * browserify index.js --standalone trezor > app.js
 *
 * TODO: Figure out why signing testnet transactions is not working correctly (change address is different) 
 */

let bitcoin = require('bitcoinjs-lib');

// Handle initializing a connection to Trezor Connect
function initTrezor(){
    TrezorConnect.init({
        lazyLoad: true,
        manifest: {
            email: 'j-dog@j-dog.net',
            appUrl: 'http://freewallet.io',
        }
    });
}

// Handle validating that a signed tx outputs match the unsigned tx outputs
function isValidTransaction(unsignedTx, signedTx){
    var u = bitcoin.Transaction.fromHex(unsignedTx), // Unsigned
        s = bitcoin.Transaction.fromHex(signedTx);   // Signed
        v = true; // valid (true/false)
    // make sure outputs and values matches unsigned transaction
    s.outs.forEach(function(out, n){
        var a = bitcoin.script.toASM(u.outs[n].script),
            b = bitcoin.script.toASM(s.outs[n].script);
        console.log('Unsigned output, value=', a, u.outs[n].value);
        console.log('Signed   output, value=', b, s.outs[n].value);
        // Error if outputs or values do not match
        if(a!=b || u.outs[n].value!=s.outs[n].value)
            v = false;
    });
    return v;
}

// Handle returning script type based on output and network
function scriptTypeFromOutputScript(output, network) {
    network = network || bitcoin.networks.bitcoin;
    try {
        payments.p2pkh({ output, network }).address;
        return "PAYTOADDRESS"
    } catch (e) {}
    try {
        payments.p2sh({ output, network }).address;
        return null //no support yet
    } catch (e) {}
    try {
        payments.p2wpkh({ output, network }).address;
        return "PAYTOWITNESS"
    } catch (e) {}
    try {
        payments.p2wsh({ output, network }).address;
        return null //no support yet
    } catch (e) {}
    try {
        payments.p2tr({ output, network }).address;
        return null //no support yet
    } catch (e) {}
    return null
}

// Handle signing a transaction
// @net        = Network (mainnet, testnet)
// @source     = Source Address
// @path       = BIP44 Path (https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
// @unsignedTx = Unsigned Transaction in hex format
// @callback   = Callback function
function signTx(net='mainnet', source, path, unsignedTx, callback){
    console.log('signTx net, source, path, unsignedTx=', net, source, path, unsignedTx);
    var inputs  = [],
        outputs = [],
        network = (net=='testnet') ? '0x80000001' : '0x80000000', // default to mainnet
        api_net = (net=='testnet') ? 'tbtc' : 'btc',
        tx      = bitcoin.Transaction.fromHex(unsignedTx),
        utxos   = {}; // object containing utxo hashes and specific output indexes to use
    // Convert BIP44 path into usable Trezor address_n
    var bip44   = path.replace(/[^0-9\/]/g, '').replace(/^\//,'').split("/"),
        address = [
            (bip44[0] | network) >>> 0, // purpose
            (bip44[1] | network) >>> 0, // coin_type
            (bip44[2] | network) >>> 0, // account
            parseInt(bip44[3]),         // change
            parseInt(bip44[4])          // address_index
        ];
    // Loop through inputs and get list of previous transaction hashes
    tx.ins.forEach(function(input, n){
        var tx_hash = input.hash.reverse().toString('hex');
        utxos[tx_hash] = -1; // set to -1 so we can determine which ones have been processed and which have not
    });
    // Define callback to run when done with API calls 
    var doneCb = async function(){
        // Check if we are truly done
        var done = true;
        for(var tx_hash in utxos){
            if(utxos[tx_hash]==-1)
                done = false;
        }
        if(done){
            // Build out a list of inputs
            tx.ins.forEach(function(input, n){
                var tx_hash = input.hash.toString('hex'), // no need to reverse since it was already done above
                    tx_info = utxos[tx_hash];
                    data = {
                        address_n: address,         // Address 
                        prev_hash: tx_hash,         // Previous transaction hash
                        prev_index: tx_info.index,  // output to use from previous transaction
                        amount: tx_info.amount      // amount of the output
                    };
                if(tx_info.type=='pay-to-witness-pubkey-hash')
                    data.script_type = 'SPENDWITNESS';
                inputs.push(data);
            });
            // Build out a list of outputs
            tx.outs.forEach(function(out, n){
                var asm = bitcoin.script.toASM(out.script),
                    output = {};
                if(/^OP_RETURN/.test(asm)){
                    output = {
                        script_type: 'PAYTOOPRETURN',
                        amount: 0,
                        op_return_data: String(asm).replace('OP_RETURN ','')
                    };
                } else {
                    var address_from_script = bitcoin.address.fromOutputScript(out.script);
                    var script_type_from_script = scriptTypeFromOutputScript(out.script);
                    output = {
                        script_type: script_type_from_script,
                        address: address_from_script,
                        amount: out.value
                    }
                }
                outputs.push(output);
            });
            // Build out request parameters
            var params = {
                inputs: inputs,
                outputs: outputs,
                coin: 'btc'
            };
            console.log("Trezor Request=",params);
            var data = await TrezorConnect.signTransaction(params)
            console.log('Trezor Response=',data);
            // If the outputs mismatch in any way, the tx is not what is expected and we should throw error
            // This can happen if user entered wrong/different password.
            if(data.payload.serializedTx && !isValidTransaction(unsignedTx, data.payload.serializedTx)){
                var data = {
                    success: false,
                    error: 'outputs mismatch'
                };
            }
            if(typeof callback === 'function')
                callback(data);
        }
    };
    // Request info on the utxos being used in this transaction and determine what output from the previous transaction is being used
    for(var tx_hash in utxos){
        var name = (net=='testnet') ? 'test3' : 'main';
        $.getJSON('https://api.blockcypher.com/v1/btc/' + name + '/txs/' + tx_hash, function(data){
            var index = 0;
            if(data){
                data.outputs.forEach(function(output, idx){
                    if(output.addresses && output.addresses[0]==source){
                        info = { 
                            index: idx,
                            address: output.addresses[0],
                            amount: output.value,
                            type: output.script_type
                        };
                    }
                });
            }
            utxos[tx_hash] = info;
            doneCb();
        });
    }
}

// Broadcast a given transaction
// @net      = Network (mainnet, testnet)
// @signedTx = Signed Transaction in hex format
// @callback = Callback function
function broadcastTx(network, signedTx, callback){
    var net  = (network=='testnet') ? 'BTCTEST' : 'BTC',
        host = (network=='testnet') ? 'testnet.xchain.io' : 'xchain.io';
    // First try to broadcast using the XChain API
    $.ajax({
        type: "POST",
        url: 'https://' + host +  '/api/send_tx',
        data: { 
            tx_hex: signedTx 
        },
        complete: function(o){
            // console.log('o=',o);
            // Handle successfull broadcast
            if(o.responseJSON.tx_hash){
                var txid = o.responseJSON.tx_hash;
                if(callback)
                    callback(txid);
                if(txid)
                    console.log('Broadcasted transaction hash=',txid);
            } else {
                // If the request to XChain API failed, fallback to chain.so API
                $.ajax({
                    type: "POST",
                    url: 'https://chain.so/api/v2/send_tx/' + net,
                    data: { 
                        tx_hex: signedTx 
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


module.exports = {
    initTrezor,
    signTx,
    broadcastTx
}
