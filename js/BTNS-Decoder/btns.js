/*********************************************************************
 * BTNS.js  - Broadcast Token Naming System (BTNS) Decoder
 *
 * Library to get decode a Broadcast Token Naming System transaction
 * 
 * Notes :
 *  - Parses BTNS transactions using the most current formats, and is 
 *    NOT meant to be backwards compatible with previous formats
 *********************************************************************/

// Define the various BTNS commands, formats, and params
BTNS = {
    PREFIXES: ['bt','btns'],
    ACTIONS: {
        ISSUE: {
            0: 'TICK|MAX_SUPPLY|MAX_MINT|DECIMALS|DESCRIPTION|MINT_SUPPLY|TRANSFER|TRANSFER_SUPPLY|LOCK_SUPPLY|LOCK_MINT|LOCK_DESCRIPTION|LOCK_RUG|LOCK_SLEEP|LOCK_CALLBACK|CALLBACK_BLOCK|CALLBACK_TICK|CALLBACK_AMOUNT|ALLOW_LIST|BLOCK_LIST',
            1: 'TICK|DESCRIPTION',
            2: 'TICK|MAX_MINT|MINT_SUPPLY|TRANSFER_SUPPLY',
            3: 'TICK|LOCK_SUPPLY|LOCK_MINT|LOCK_DESCRIPTION|LOCK_RUG|LOCK_SLEEP|LOCK_CALLBACK',
            4: 'TICK|LOCK_CALLBACK|CALLBACK_BLOCK|CALLBACK_TICK'
        },
        LIST: {
            0: 'TYPE|ITEM',
            1: 'EDIT|LIST_TX_HASH|ITEM'
        },
        MINT: {
            0: 'TICK|AMOUNT|DESTINATION'
        },
        SEND: {
            0: 'TICK|AMOUNT|DESTINATION|MEMO',
            1: 'TICK|AMOUNT|DESTINATION|AMOUNT|DESTINATION|MEMO',
            2: 'TICK|AMOUNT|DESTINATION|TICK|AMOUNT|DESTINATION|MEMO',
            3: 'TICK|AMOUNT|DESTINATION|MEMO|TICK|AMOUNT|DESTINATION|MEMO'
        }
    }
};

// Decode any embedded XCP transaction data
function decodeBTNSTransaction(data=null){
    console.log('data=',data);
    // Handle XCP object by extracting data
    if(typeof data==='object' && data.type=='broadcast')
        data = data.text;
    var o = {};
    // Debugging (hardcode value)
    // data = 'bt:ISSUE|0|FUCK|123|||https://yahoo.com/some/url||||';
    // ACTION Format (COMMAND|VERSION|PARAMS)
    var command = String(data).split(';')[0],
        prefix  = String(command).split(':')[0],
        params  = String(command).replace(prefix + ':','').split('|'),
        action  = String(params[0]).toUpperCase(),
        version = parseInt(params[1]); 
    // Add support for parsing old BTNS actions
    if(action=='DEPLOY')   action='ISSUE';
    if(action=='TRANSFER') action='SEND';
    // Add support for parsing old BTNS commands without a version (default to 0)
    if(isNaN(version)){
        version = 0;
        params.splice(1,0,version);
    }
    // Trim action and version from params array
    params.splice(0,2);
    if(BTNS.PREFIXES.indexOf(prefix.toLowerCase())!=-1 && BTNS.ACTIONS[action] && BTNS.ACTIONS[action][version]){
        var fields = String(BTNS.ACTIONS[action][version]).toLowerCase().split('|');
        o.action  = action;
        o.version = version;
        fields.forEach(function(field, idx){
            o[field] = params[idx] || null;
        });
    }
    return o;
}