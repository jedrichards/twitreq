var uuid = require("node-uuid");
var crypto = require("crypto");
var parambulator = require("parambulator");

var TWITREQ_VERSION = require("../package.json").version;
var OAUTH_VERSION = "1.0";
var PROTOCOL = "https";
var HOST = "api.twitter.com";
var OAUTH_SIGNATURE_METHOD = "HMAC-SHA1";

/**
 * Main twitreq exported function. See the README for usage.
 *
 * @param options Object literal containing config values.
 * @param cb Callback function, either passes back an Error or the signed options object.
 */
module.exports = function (options,cb) {

    var paramcheck = parambulator({
        required$: ["oAuthConsumerKey","oAuthConsumerSecret","oAuthToken","oAuthTokenSecret","method","path"],
        oAuthConsumerKey: {type$:"string"},
        oAuthConsumerSecret: {type$:"string"},
        oAuthToken: {type$:"string"},
        oAuthTokenSecret: {type$:"string"},
        method: {type$:"string",enum$:["GET","POST"]},
        path: {type$:"string"},
        host: {type$:"string"},
        protocol: {type$:"string"},
        oAuthVersion: {type$:"string"},
        oAuthSignatureMethod: {type$:"string"},
        queryParams: {type$:"object"},
        verbose: {type$:"boolean"}
    });

    paramcheck.validate(options,function (err) {
        if ( err ) {
            cb(err);
        } else {
            genReq(options,cb)
        }
    });
}

/**
 * Generate a Node HTTP request options object based on a valid set of options.
 */
function genReq (options,cb) {

    log(options.verbose,"Starting twitreq ...");

    if ( typeof options.protocol === "undefined" ) {
        options.protocol = PROTOCOL;
    }

    if ( typeof options.host === "undefined" ) {
        options.host = HOST;
    }

    if ( typeof options.oAuthSignatureMethod === "undefined" ) {
        options.oAuthSignatureMethod = OAUTH_SIGNATURE_METHOD;
    }

    if ( options.oAuthSignatureMethod !== OAUTH_SIGNATURE_METHOD ) {
        cb(new Error("HMAC-SHA1 is the only supported signature signing method at present."));
        return;
    }

    if ( typeof options.oAuthVersion === "undefined" ) {
        options.oAuthVersion = OAUTH_VERSION;
    }

    log(options.verbose,"Using options:");
    log(options.verbose,options);

    options.baseURL = options.protocol+"://"+options.host+options.path;
    options.oAuthTimestamp = getTimestamp();

    log(options.verbose,"Generated timestamp: "+options.oAuthTimestamp);

    options.oAuthNonce = getNonce();

    log(options.verbose,"Generated nonce: "+options.oAuthNonce);

    options.oAuthSignature = genOAuthSig(options);
    options.authHeaderValue = genAuthorizationHeaderValue(options);
    options.queryString = genQueryString(options);

    var headers = {};
    headers["Authorization"] = options.authHeaderValue;
    headers["Accept"] = "*/*";
    headers["Connection"] = "close";
    headers["User-Agent"] = "Node.js/twitreq v"+TWITREQ_VERSION;
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    headers["Host"] = options.host;

    var reqOptions = {
        method: options.method,
        path: options.path+options.queryString,
        hostname: options.host,
        headers: headers,
    };

    log(options.verbose,"Complete! Generated request object is:");
    log(options.verbose,reqOptions);

    cb(null,reqOptions);
}

/**
 * Generate a percent encoded query string from the supplied options.
 */
function genQueryString (options) {

    if ( !options.queryParams ) {
        return "";
    }

    log(options.verbose,"Now generating query string value ...");

    var queryStringParams = [];

    Object.keys(options.queryParams).forEach(function (key) {
        queryStringParams.push(createEncodedParam(key,options.queryParams[key]));
    });

    var queryString = "?";

    log(options.verbose,"Query string key/value pairs are:");

    for ( var i=0; i<queryStringParams.length; i++ ) {
        log(options.verbose,"  "+queryStringParams[i].key+"="+queryStringParams[i].value);
        queryString += queryStringParams[i].key+"="+queryStringParams[i].value;
        if ( queryStringParams[i+1] ) {
            queryString += "&";
        }
    }

    log(options.verbose,"Query string value is: "+queryString);

    return queryString;
}

/**
 * Generate the Authorization header value from the supplied options:
 */
function genAuthorizationHeaderValue (options) {

    log(options.verbose,"Now generating Authorization header value ...");

    var authHeaderParams = [];

    authHeaderParams.push(createEncodedParam("oauth_consumer_key",options.oAuthConsumerKey));
    authHeaderParams.push(createEncodedParam("oauth_nonce",options.oAuthNonce));
    authHeaderParams.push(createEncodedParam("oauth_signature",options.oAuthSignature));
    authHeaderParams.push(createEncodedParam("oauth_signature_method",options.oAuthSignatureMethod));
    authHeaderParams.push(createEncodedParam("oauth_timestamp",options.oAuthTimestamp));
    authHeaderParams.push(createEncodedParam("oauth_token",options.oAuthToken));
    authHeaderParams.push(createEncodedParam("oauth_version",options.oAuthVersion));

    var authHeaderValue = "OAuth ";

    log(options.verbose,"Authorization header key/value pairs are:");

    for ( var i=0; i<authHeaderParams.length; i++ ) {
        log(options.verbose,"  "+authHeaderParams[i].key+"=\""+authHeaderParams[i].value+"\"");
        authHeaderValue += authHeaderParams[i].key+"=\""+authHeaderParams[i].value+"\"";
        if ( authHeaderParams[i+1] ) {
            authHeaderValue += ", ";
        }
    }

    log(options.verbose,"Authorization header value is: "+authHeaderValue);

    return authHeaderValue;
}

/**
 * Generate a base64 encoded, HMAC-SHA1 hashed OAuth signature based on the
 * supplied options:
 */
function genOAuthSig (options) {

    log(options.verbose,"Now generating OAuth sig ...");

    // Build an array of all the parameters we need to include in the signature.
    // Signature parameters are in the format {key,value}, both the key and the
    // value need to be RFC3986 percent encoded.

    var sigParams  = [];

    if ( options.queryParams ) {
        Object.keys(options.queryParams).forEach(function (key) {
            sigParams.push(createEncodedParam(key,options.queryParams[key]));
        });
    }

    sigParams.push(createEncodedParam("oauth_consumer_key",options.oAuthConsumerKey));
    sigParams.push(createEncodedParam("oauth_nonce",options.oAuthNonce));
    sigParams.push(createEncodedParam("oauth_signature_method",options.oAuthSignatureMethod));
    sigParams.push(createEncodedParam("oauth_timestamp",options.oAuthTimestamp));
    sigParams.push(createEncodedParam("oauth_token",options.oAuthToken));
    sigParams.push(createEncodedParam("oauth_version",options.oAuthVersion));

    // Parameters need to be sorted alphabetically based on the encoded key.

    sigParams.sort(function (a,b) {
        if ( a.key < b.key ) {
            return -1;
        } else if ( a.key > b.key ) {
            return 1;
        } else {
            return 0;
        }
    });

    // Build the signature parameter string from the sorted array.

    var sigParamsString = "";

    log(options.verbose,"Ordered percent encoded sig params are:");

    for ( var i=0; i<sigParams.length; i++ ) {
        sigParamsString += sigParams[i].key+"="+sigParams[i].value;
        log(options.verbose,"  "+sigParams[i].key+"="+sigParams[i].value);
        if ( sigParams[i+1] ) {
            sigParamsString += "&";
        }
    }

    log(options.verbose,"Generated sig params string: "+sigParamsString);

    // Build the base signature string from the HTTP method, base URL and signature
    // parameter string.

    var sigBaseString = options.method.toUpperCase()+"&";
    sigBaseString += percentEncode(options.baseURL)+"&";
    sigBaseString += percentEncode(sigParamsString);

    log(options.verbose,"Generated base sig string: "+sigBaseString);

    // Generate the signing key from the consumer secret and oAuth token secret.

    var signingKey = options.oAuthConsumerSecret+"&"+options.oAuthTokenSecret;

    log(options.verbose,"Generated HMAC-SHA1 signing key: "+signingKey);

    // The final value for the OAuth signature is the HMAC-SHA1 hash of the
    // signing key and the base sig string, all base64 encoded.

    var oAuthSig = crypto.createHmac("sha1",signingKey).update(sigBaseString).digest("base64");

    log(options.verbose,"OAuth sig is: "+oAuthSig);

    return oAuthSig;
}

/**
 * Generate a nonce by base64 encoding 36 bytes of random utf8 data.
 */
function getNonce () {
    return new Buffer(uuid.v4()).toString("base64");
}

/**
 * Return a RFC3986 compliant percent encoded string.
 */
function percentEncode (value) {
    var result = encodeURIComponent(value);
    return result.replace(/\!/g, "%21")
                 .replace(/\'/g, "%27")
                 .replace(/\(/g, "%28")
                 .replace(/\)/g, "%29")
                 .replace(/\*/g, "%2A");
}

/**
 * Create a parameter object containing the percent encoded equivalients of a
 * key/value pair.
 */
function createEncodedParam (key,value) {
    return {
        key: percentEncode(key),
        value: percentEncode(value)
    }
}

/**
 * Return a timestamp string representing the number of seconds since the
 * Unix epoc.
 */
function getTimestamp () {
    return (Math.round(new Date().getTime()/1000)).toString();
}

/**
 * Conditionally output to console.log.
 */
function log(verbose,item) {
    if ( verbose ) {
        console.log(item);
    }
}