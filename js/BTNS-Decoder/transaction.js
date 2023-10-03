/*********************************************************************
 * transaction.js 
 *
 * General purpose library to get / decode bitcoin transactions
 *********************************************************************/

// Handle sending request to a bitcoin core API via XChain BTC Proxy
function btcRequest(network, data, callback){
    var net  = (network=='testnet') ? 'testnet' : 'mainnet',
        host = (net=='testnet') ? 'testnet.xchain.io' : 'xchain.io',
        url  = 'https://' + host + '/api/btc_proxy';
    // Send request to server, process response
    $.ajax({
        type: "POST",
        url: url,
        data: JSON.stringify(data),
        dataType: 'json',
        crossDomain: true,
        complete: function(o){
            if(typeof callback === 'function')
                callback(o.responseJSON);
        }
    });
}

// Handle getting transaction object using tx_hash
function getRawTransaction(network=null, tx_hash=null, callback=null){
    var data = {
        method: "getrawtransaction",
           params: [tx_hash, true],
        jsonrpc: "2.0",
        id: 0
    };
    btcRequest(network, data, function(o){
        if(typeof callback === 'function')
            callback(o);
    });
}

// Handle decoding raw transaction (hex) into object
function decodeRawTransaction(network=null, tx_hex=null, callback=null){
    var data = {
        method: "decoderawtransaction",
           params: [tx_hex],
        jsonrpc: "2.0",
        id: 0
    };
    btcRequest(network, data, function(o){
        if(typeof callback === 'function')
            callback(o);
    });
}

// Decode RAW transaction using Bitcoin Core 
function decodeTransaction(network=null, tx_hash=null, callback=null){
    var tx = {
        btc: null,
        xcp: null,
        btns: null
    };
    var cb = function(o){
        // Update tx object with BTC tx info
        if(typeof o.results === "object")
            tx.btc = o.results;
        decodeXCPTransaction(network, tx.btc, function(xcp){ 
            if(xcp){
                tx.xcp = xcp;
                tx.btns = decodeBTNSTransaction(xcp);
            }
            if(typeof callback === 'function')
                callback(tx);
        });
    }
    // Make call to Bitcoin Core to decode the TX
    if(tx_hash.length==64)
        getRawTransaction(network, tx_hash, cb);
    else
        decodeRawTransaction(network, tx_hash, cb);
}

// Handle getting source address for a given transaction
function getSourceAddress(network=null, vin=null, callback=null){
    getRawTransaction(network, vin.txid, function(o){
        var addr = false,
            tx   = o.results;
        tx.vout.forEach(function(out){
            if(vin.vout==out.n)
                addr = out.scriptPubKey.address;
        });
        if(typeof callback === 'function')
            callback(addr);
    });
}

// Convert BINARY to HEX
function bin2hex(s){
    var i, l, o = "",
        n;
    s += "";
    for(i = 0, l = s.length; i < l; i++){
      n = s.charCodeAt(i).toString(16);
      o += n.length < 2 ? "0" + n : n;
    }
    return o;
}

// Convert HEX to BINARY
function hex2bin(hex){
    var bytes = [],
        str;
    for(var i=0; i < hex.length-1; i += 2){
        var ch = parseInt(hex.substr(i, 2), 16);
        bytes.push(ch);
    }
    str = String.fromCharCode.apply(String, bytes);
    return str;
}

// Decode a chunk of data using a given key
function xcp_rc4(key, datachunk) {
    return bin2hex(rc4(hex2bin(key), hex2bin(datachunk)));
}

// RC4 symmetric cipher encryption/decryption
function rc4(key, str) {
    var s = [], j = 0, x, res = '';
    for(var i = 0; i < 256; i++)
        s[i] = i;
    for(i = 0; i < 256; i++){
        j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
          x = s[i];
          s[i] = s[j];
          s[j] = x;
    }
    i = 0;
    j = 0;
    for (var y = 0; y < str.length; y++) {
          i = (i + 1) % 256;
          j = (j + s[i]) % 256;
          x = s[i];
          s[i] = s[j];
          s[j] = x;
          res += String.fromCharCode(str.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
    }
    return res;
}

// Convert HEX to ASCII
function hex2ascii(hex) {
    var hex = String(hex),
        str = '';
    for(var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

// Convert ASCII to HEX
function ascii2hex(str){
    var arr1 = [];
    for(var n = 0, l = str.length; n < l; n ++){
        var hex = Number(str.charCodeAt(n)).toString(16);
        arr1.push(hex);
    }
    return arr1.join('');
}

// Convert HEX to DECIMAL
function hex2Dec(s){
    var i, j, digits = [0], carry;
    for(i = 0; i < s.length; i += 1){
          carry = parseInt(s.charAt(i), 16);
          for(j = 0; j < digits.length; j += 1){
            digits[j] = digits[j] * 16 + carry;
            carry = digits[j] / 10 | 0;
            digits[j] %= 10;
        }
        while(carry > 0){
            digits.push(carry % 10);
            carry = carry / 10 | 0;
          }
    }
    return digits.reverse().join('');
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

// Convert HEX to an address
function hex2address(hex){
    let version_byte = hex.substring(0,2);
    if (version_byte == '00' || version_byte == '05') {
      return hex2base58addr(hex);
    }
    if(version_byte == '80')
          return hex2bech32addr(hex); 
    return 'cannot decode address';
}

// Convert HEX to Base58 address
function hex2base58addr(hex) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = BigInt(58);
    let checksum = sha256(hex2ascii(hex));
    checksum = sha256(hex2ascii(checksum));
    checksum = checksum.substring(0,8);
    hex += checksum
    let decimal = BigInt('0x' + hex);
    let output = '';
    while (decimal > 0) {
        let rem = decimal % base;
        decimal = BigInt(decimal / base);
        output = ALPHABET[Number(rem)] + output;
    }
    //Leading 00's must be converted to 1's
    let numLeadingZeros = Math.floor(hex.match(/^0+/)[0].length / 2);
    for (let i = 0; i < numLeadingZeros; i++) {
        output = "1" + output;
    }
    return output;
}

// Convert HEX to Bech32 address
function hex2bech32addr(hex) {
    const version = 0;
    const hrp = 'bc';
    //remove version byte ('80') from hex string
    hex = hex.substring(2);
    //the rest follows step 3 on https://en.bitcoin.it/wiki/Bech32
    // convert hex string to binary format
    const binaryString = hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16).toString(2).padStart(8, '0')).join('');
    //Split binary string into 5-bit chunks and convert to integer array
    const intArray = binaryString.match(/.{1,5}/g).map(chunk => parseInt(chunk, 2));
    //Add the witness version byte in front
    intArray.unshift(version);
    //Calculate checksum
    let chk = bech32_checksum(hrp, intArray);
    //Append checksum
    intArray.push(...chk);
    //Map to bech32 charset
    const charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    let addr = hrp + '1';
    for (let i = 0; i < intArray.length; i++) {
      addr += charset.charAt(intArray[i]);
    }
    return addr;
}

// Calculate bech32 checksum
// Copied from https://github.com/sipa/bech32/blob/master/ref/javascript/bech32.js
// Modified to assume BECH32 encoding (not BECH32M)
function bech32_checksum(hrp, data) {
    var values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
    var mod = polymod(values) ^ 1;
    var ret = [];
    for(var p = 0; p < 6; ++p)
        ret.push((mod >> 5 * (5 - p)) & 31);
    return ret;
}

function polymod(values) {
    const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    var chk = 1;
    for(var p = 0; p < values.length; ++p){
        var top = chk >> 25;
        chk = (chk & 0x1ffffff) << 5 ^ values[p];
        for(var i = 0; i < 5; ++i){
            if((top >> i) & 1)
                chk ^= GENERATOR[i];
          }
    }
    return chk;
}

function hrpExpand(hrp) {
    var ret = [];
    var p;
    for(p = 0; p < hrp.length; ++p)
      ret.push(hrp.charCodeAt(p) >> 5);
    ret.push(0);
    for(p = 0; p < hrp.length; ++p)
      ret.push(hrp.charCodeAt(p) & 31);
    return ret;
}