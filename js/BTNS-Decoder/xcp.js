/*********************************************************************
 * xcp.js - Counterparty (XCP) Transaction Decoder
 *
 * General purpose library to decode Counterparty transactions
 * 
 * Notes :
 *  - Parses Counterparty transactions using the most current formats, and is 
 *    NOT meant to be backwards compatible with previous formats
 * 
 * This code borrowed heavily from JP Janssen's (JPJA) github code at :
 *     https://github.com/Jpja/Electrum-Counterparty/blob/master/decode_tx.html
 *     https://jpja.github.io/Electrum-Counterparty/decode_tx.html
 * 
 * TODO
 *  - MPMA Sends                     - 45fab9aba7aa49abcdab90d5a643c0ff5800c925ce043a4011339d1c9d380d1f
 *  - Some Large txs are not parsing - 29b362ef55d9dc10bde6e110b62772a466f6acc3267f80e782e59e5cc1e97411
 *********************************************************************/

// Define the various XCP properties
XCP = {
    PREFIXES: ['CNTRPRTY','DOGEPRTY'] // Prefixes used in Counterparty and Dogeparty transactions
};

// Decode any embedded XCP transaction data
function decodeXCPTransaction(network=null, tx=null, callback=null){
    var o    = {},
        chng = {}, // change address / amount
        raw  = '', // raw message
        msg  = '', // XCP message
        txid = '', // tx hash
        dest = ''; // destination address
    // Parse in txid if we are able to detect one
    if(tx && tx.vin && tx.vin.length && tx.vin[0].txid)
        txid = tx.vin[0].txid;
    // Loop through outputs and extract any encoded data
    if(tx && tx.vout && tx.vout.length){
        tx.vout.forEach(function(out, idx){
            var script = out.scriptPubKey,
                hex    = script.hex,
                type   = script.type;
            // OP_RETURN Encoded
            if(type=='nulldata'){
                raw = xcp_rc4(txid, hex.substr(4));
                if(!isXCPTransaction(raw))
                    raw = '';
                msg += raw;
                console.log('opreturn: ' + msg);
            }
            // Multisig Encoded
            if(type=='multisig' && hex.length==210){
                raw = hex.substring(6, 68) + hex.substring(74, 136);
                raw = xcp_rc4(txid, raw);
                len = parseInt(hex2Dec(raw.substring(0, 2)));
                raw = raw.substring(2, 2+(len*2));
                if(isXCPTransaction(raw) && isXCPTransaction(msg)){
                    raw = raw.substring(16);
                } else if(!isXCPTransaction(raw)){
                    raw = '';
                }
                msg += raw;
                console.log('multisig: ' + msg);
            }
            // Multisg Encoded 2
            if(type=='multisig' && hex.length==274){
                console.log('decoding coming soon');
                // Code here to parse in longer/larger multisigs... not working for some reason
                // test with 29b362ef55d9dc10bde6e110b62772a466f6acc3267f80e782e59e5cc1e97411 
                // above multisig code fails on parsing text
            }
            // Multisig Encoded (old type, not rc4 encoded)
            if(type=='nonstandard' && hex.length==142){
                len = parseInt(hex2Dec(hex.substring(72, 74)));
                raw = hex.substring(74, 74+(len*2));                
                if(isXCPTransaction(raw)||isXCPTransaction(msg))
                    msg += raw;
                console.log('multisig (old): ' + msg);
            }
            // Pay 2 Public Key Hash (P2PKH)
            if(type=='pubkeyhash'){
                // Possibly a send, issuance, or BTCpay transaction
                // these always send some BTC dust to recipient at output 0
                if(out.n==0)
                    dest = script.address;
            }
            // Get change address and amount from last output
            if(idx==tx.vout.length-1){
                chng.address = script.address;
                chng.amount  = out.value;
            }
        });
    }
    // Decode the Transaction data
    if(isXCPTransaction(msg)){
        // Get the source address for this transaction
        getSourceAddress(network, tx.vin[0], function(source){
            // Strip off prefix        
            msg = msg.substring(16);
            // Extract Message Type
            id = msg.substring(0,2); 
            if(id=='00'){
                  id  = msg.substring(0,8);
                msg = msg.substring(8);
            } else {
                  msg = msg.substring(2);
            }
            type = parseInt(id, 16);
            console.log('type id=',type);
            // Classic Send
            if(type==0){
                o.type        = 'send';
                o.source      = source;
                o.destination = dest;
                o.asset       = getAssetName(msg.substring(0,16));
                o.quantity    = parseInt(msg.substring(16,32), 16);
            }
            // Enhanced Send (includes memos)
            if(type==2){
                o.type        = 'send';
                o.source      = source;
                o.asset       = getAssetName(msg.substring(0,16));
                o.quantity    = parseInt(msg.substring(16,32), 16);
                o.destination = hex2address(msg.substring(32,74));
                o.memo        = hex2ascii(msg.substring(74));
            }
            // Sweep
            if(type==4){ 
                o.type        = 'sweep';
                o.source      = source;
                o.destination = hex2address(msg.substring(0,42));
                o.flags       = parseInt(msg.substring(42,44), 16);
                o.memo        = hex2ascii(msg.substring(44));
            }
            // DEX Order
            if(type==10){ 
                o.type          = 'order';
                o.source        = source;
                o.give_asset    = getAssetName(msg.substring(0,16));
                o.give_quantity = parseInt(msg.substring(16,32), 16);
                o.get_asset     = getAssetName(msg.substring(32,48));
                o.get_quantity  = parseInt(msg.substring(48,64), 16);
                o.expiration    = parseInt(msg.substring(64,68), 16);
            }
            // BTCPay
            if(type==11){ 
                o.type          = 'btcpay';
                o.source        = source;
                o.destination   = dest;
                o.order0        = msg.substring(0,64);
                o.order1        = msg.substring(64,128);
                o.quantity      = numeral(tx.vout[0].value).format('0.00000000');
            }
            // Dispenser
            if(type==12){ 
                o.type            = 'dispenser';
                o.source          = source;
                o.asset           = getAssetName(msg.substring(0,16));
                o.give_quantity   = parseInt(msg.substring(16,32), 16);
                o.escrow_quantity = parseInt(msg.substring(32,48), 16);
                o.mainchainrate   = parseInt(msg.substring(48,64), 16);
                o.status          = parseInt(msg.substring(64,66), 16);
                var addr          = msg.substring(66);
                o.address         = (addr.length) ? hex2address(addr) : source;
            }
            // Issuance
            if(type==20||type==22){
                o.type                 = 'issuance';
                o.source               = source;
                o.asset                = getAssetName(msg.substring(0,16));
                o.quantity             = parseInt(msg.substring(16,32), 16);
                o.divisible            = parseInt(msg.substring(32,34), 16);
                o.transfer_destination = (dest!='') ? dest : null;
                // OLD Format - Callback data removed in block 753500
                // o.callback             = parseInt(msg.substring(34,36), 16);
                // o.callback_date        = parseInt(msg.substring(36,44), 16);
                // o.callback_price       = parseInt(msg.substring(44,52), 16);
                // o.description_length   = parseInt(msg.substring(52,54), 16);
                // o.description          = hex2ascii(msg.substring(54));
                // NEW Format - LOCK and RESET added in block 753500
                o.lock                 = parseInt(msg.substring(34,36), 16);
                o.reset                = parseInt(msg.substring(36,38), 16);
                o.description          = hex2ascii(msg.substring(38));
            }
            // Issuance (subasset)
            if(type==21||type==23){ 
                o.type                 = 'issuance';
                o.source               = source;
                o.asset                = getAssetName(msg.substring(0,16));
                o.quantity             = parseInt(msg.substring(16,32), 16);
                o.divisible            = parseInt(msg.substring(32,34), 16);
                o.transfer_destination = (dest!='') ? dest : null;
                // NEW Format - LOCK and RESET added in block 753500
                o.lock                 = parseInt(msg.substring(34,36), 16);
                o.reset                = parseInt(msg.substring(36,38), 16);
                // Parse in variable-length subasset name and description
                var x   = 38; // FORMAT (OLD=34, NEW=38)
                    off = (x+2)+(parseInt(msg.substring(x,(x+2)), 16)*2),
                    sub = hex2subasset(msg.substring((x+2),off));
                o.asset_longname       = sub;
                o.description          = hex2ascii(msg.substring(off));
            }
            // Broadcast
            if(type==30){
                o.type         = 'broadcast';
                o.source       = source;
                o.timestamp    = parseInt(msg.substring(0,8), 16);
                o.value        = parseInt(msg.substring(8,24), 16);
                o.fee_fraction = parseInt(msg.substring(24,32), 16);
                // Most broadcasts begin with length bytes, tho not all
                // assume first byte is length byte if it matches length
                var text = msg.substring(32),
                    len  = parseInt(text.substring(0,2), 16);
                  if(len*2+2 == text.length)
                    text = text.substring(2);
                o.text = hex2ascii(text);
            }
            // Dividend
            if(type==50){
                o.type              = 'dividend';
                o.source            = source;
                o.quantity_per_unit = parseInt(msg.substring(0,16), 16);
                o.asset             = getAssetName(msg.substring(16,32));
                o.dividend_asset    = getAssetName(msg.substring(32,48));
            }
            // Pass forward change information last
            o.change = chng;
            // Pass the information to the callback 
            if(typeof callback === 'function')
                callback(o);
        });
    } else {
        // Pass the information to the callback 
        if(typeof callback === 'function')
            callback();
    }
}

// Determine if Transaction data has CP/DP prefix indicating it is a CP tx
function isXCPTransaction(hex){
    var found = false; 
    XCP.PREFIXES.forEach(function(prefix){
        var str = ascii2hex(prefix);
        if(String(hex).substr(0,16)==str)
            found = true;
    });
    return found;
}

// Get asset name from HEX
function getAssetName(hex){
    // Assume ID is asset
    var id = parseInt(hex, 16);
    if(id == 0) return 'BTC';
    if(id == 1) return 'XCP';
    // Asset is numeric or subasset, return numeric name
    if(id >= 95428956661682177)
        return 'A' + BigInt('0x'+hex).toString(10);
    // a few very long asset names, would need big
    if(id > 9007199254740991) 
        return 'max int error';
    let b26_digits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; 
    let n = id;
    let name = '';
    do {
        let mod = n % 26;
         name = b26_digits[mod] + name;
         n -= mod;
         n /= 26;
    } while (n > 0);
    return name;
}

// Convert HEX to Subasset name
function hex2subasset(hex) {
    const SUBASSET_DIGITS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_@!'
    let integer = BigInt('0x' + hex)
    let ret = ''
    while (integer != 0n){
        ret = SUBASSET_DIGITS[(integer % 68n) - 1n] + ret
        integer = integer / 68n
    }
    return ret;
}
