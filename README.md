## twitreq

Generates a request `options` object suitable for making signed and authenticated requests to the v1.1 Twitter OAuth REST API using the native Node `https` library.

A lot of oAuth libraries try and do too many things at once: signing requests, wrapping the request/response functionality as well as providing a non-standard programmatic interface to the returned streamed data. This can make it hard to debug when your OAuth request (inevitably) fails the first few times.

This module concentrates on one thing only: generating the `options` object you need when writing native Node code like this:

```javascript
var https = require("https");

https.request(options,function (res) {
    // handle response
});
```

### Installation

    $ npm install twitreq

### Usage

```javascript
var twitreq = require("twitreq");

twitreq(options,[callback]);
```

The `callback` function gets two arguments `error` and `reqOptions`.

`error`: An `Error` object if failed.

`reqOptions`: A fully populated, signed and authorised request `options` object ready for use with the native Node `https` library.

### Options

The `twitreq` function accepts an `options` object literal with the following schema:

```javascript
{
    oAuthConsumerKey,           // Required string
    oAuthConsumerSecret,        // Required string
    oAuthToken,                 // Required string
    oAuthTokenSecret,           // Required string
    method,                     // Required string, e.g. "GET"
    path,                       // Required string, e.g. "/1.1/statuses/user_timeline.json"
    host,                       // Optional string, defaults to "api.twitter.com"
    protocol,                   // Optional string, defaults to "https"
    oAuthVersion,               // Optional string, defaults to "1.0"
    oAuthSignatureMethod,       // Optional string, defaults to "HMAC-SHA1"
    queryParams                 // Optional object literal for query parameters, e.g. {screen_name:"jedrichards"}
    verbose                     // Optional boolean, prints out verbose debug info to console.log
}
```

### Example

This example demonstrates how to grab the latest tweet from a user's timeline (API keys, tokens and secrets omitted, get yours from https://dev.twitter.com):

```javascript
var twitreq = require("twitreq");
var https = require("https");

var options = {
    queryParams: {
        screen_name: "jedrichards",
        count: "1",
        exclude_replies: "true"
    },
    method: "GET",
    path: "/1.1/statuses/user_timeline.json",
    oAuthConsumerKey: "-",
    oAuthConsumerSecret: "-",
    oAuthToken: "-",
    oAuthTokenSecret: "-"
}

twitreq(options,function (err,reqOptions) {
    if ( err ) {
        // twitreq error
    } else {
        var req = https.request(reqOptions,function (res) {
            res.setEncoding("utf8");
            res.on("error",function (err) {
                // request error
            });
            var data = "";
            res.on("data", function (chunk) {
                data += chunk;
            });
            res.on("end",function () {
                console.log(JSON.parse(data));
            })
        })
        req.end();
    }
});
```

The above code should produce a `reqOptions` object that looks something like this:

```javascript
{
    method: 'GET',
    path: '/1.1/statuses/user_timeline.json?screen_name=jedrichards&count=1&exclude_replies=true',
    hostname: 'api.twitter.com',
    headers:
    {
        Authorization: 'OAuth oauth_consumer_key="-", oauth_nonce="NjIyM2Q0OGYtMzc2NC00ZDliLTliM2EtNWJiYzM3N2MxNmI3", oauth_signature="-", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1355169071", oauth_token="-", oauth_version="1.0"',
        Accept: '*/*',
        Connection: 'close',
        'User-Agent': 'Node.JS twitreq v0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded',
        Host: 'api.twitter.com'
    }
}
```

### Limitations

This is a new library, so please bear in mind the following:

- Requests with `POST` body data currently not supported. Coming soon.
- Related to the point above, only tested with read-only GET requests.
- Untested with streaming API calls, although may well work fine.
- Only tested with requests authenticated as the app's Twitter user (i.e. the user associated with the app on https://dev.twitter.com), although may well work fine in other scenarios.