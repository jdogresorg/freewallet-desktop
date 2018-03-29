// Handle adding an address to the selection screen
function addAddress(address, path){
    console.log('address=',address);
    var html = '<tr address=' + address + '>' +
               '     <td>' +
               '         <div class="checkbox">' +
               '             <label><input type="checkbox" name="address" value="' + address + '" data-path="' + path + '" readonly> ' + address + '</label>' +
               '         </div>' +
               '     </td>' +
               '     <td class="text-right status">Loading...</td>' +
               '</tr>';
    $('#addresslist tbody').append(html);
    checkAddressBalance(address);
}

// Handle checking if address has any asset balances
function checkAddressBalance(address){
    $.getJSON('https://xchain.io/api/balances/' + address, function(data){
        $('tr[address=' + address + '] td:last-child').text(data.total);
    });
}

// Handle parsing querystring into associative array
function parseQueryString(){
    var parsed = {},
        params = location.search.substr(1).split('&');
    for (var i = 0; i < params.length; i++) {
        var parameter = params[i].split('=');
        parsed[parameter[0]] = decodeURIComponent(parameter[1]);
    }
    return parsed;
}