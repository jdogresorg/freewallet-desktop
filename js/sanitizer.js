/**
 * sanitize HTML with jQuery
 * example:
 *   sanitizer.sanitize('<a href="foo" class="bar">aaa</a><script>alert("...")<\/script>');
 */
var sanitizer = {};

(function($) {
function trimAttributes(node) {
    $.each(node.attributes, function() {
        var attrName = this.name;
        var attrValue = this.value;

        // remove attribute name start with "on", possible unsafe,
        // for example: onload, onerror...
        //
        // remvoe attribute value start with "javascript:" pseudo protocol, possible unsafe,
        // for example href="javascript:alert(1)"
        if (attrName.indexOf('on') == 0 || attrValue.indexOf('javascript:') == 0) {
            $(node).removeAttr(attrName);
        }
    });
}

function sanitize(html) {
    // [jQuery.parseHTML(data [, context ] [, keepScripts ])](http://api.jquery.com/jQuery.parseHTML/) added: 1.8
    // Parses a string into an array of DOM nodes.
    //
    // By default, the context is the current document if not specified or given as null or undefined. If the HTML was to be used in another document such as an iframe, that frame's document could be used.
    //
    // As of 3.0 the default behavior is changed.
    //
    // If the context is not specified or given as null or undefined, a new document is used.
    // This can potentially improve security because inline events will not execute when the HTML is parsed. Once the parsed HTML is injected into a document it does execute, but this gives tools a chance to traverse the created DOM and remove anything deemed unsafe. This improvement does not apply to internal uses of jQuery.parseHTML as they usually pass in the current document. Therefore, a statement like $( "#log" ).append( $( htmlString ) ) is still subject to the injection of malicious code.
    //
    // without context do not execute script
    // $.parseHTML('<div><img src=1 onerror=alert(1)></div>');
    // $.parseHTML('<div><img src=1 onerror=alert(2)></div>', null);
    //
    // with context document execute script!
    // $.parseHTML('<div><img src=1 onerror=alert(3)></div>', document);
    // 
    // Most jQuery APIs that accept HTML strings will run scripts that are included in the HTML. jQuery.parseHTML does not run scripts in the parsed HTML unless keepScripts is explicitly true. However, it is still possible in most environments to execute scripts indirectly, for example via the <img onerror> attribute.
    //
    // will return []
    // $.parseHTML('<script>alert(1)<\/script>', null, false);
    // will return [script DOM element]
    // $.parseHTML('<script>alert(1)<\/script>', null, true);
    var output = $($.parseHTML('<div>' + html + '</div>', null, false));
    output.find('*').each(function() {
        trimAttributes(this);
    });
    return output.html();
}

sanitizer.sanitize = sanitize;
})(jQuery);