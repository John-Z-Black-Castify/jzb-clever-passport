/**
 * Module dependencies.
 */
 let util = require('util')
 , querystring = require('querystring')
 , fetch = require('node-fetch')
 , OAuth2Strategy = require('passport-oauth2').Strategy
 , InternalOAuthError = require('passport-oauth2').InternalOAuthError;

/**
*
* @param {Object} options
* @param {Function} verify
* @api public
*/
function Strategy(options, verify) {
 options = options || {};
 options.authorizationURL = options.authorizationURL || 'https://clever.com/oauth/authorize';
 options.tokenURL = options.tokenURL || 'https://clever.com/oauth/tokens';

 OAuth2Strategy.call(this, options, verify);
 this.name = 'clever';
 this._passReqToCallback = options.passReqToCallback;

 this._oauth2.useAuthorizationHeaderforGET(true);
 this._oauth2.getOAuthAccessToken = function (code, params, callback) {
     var params = params || {};
     var codeParam = (params.grant_type === 'refresh_token') ? 'refresh_token' : 'code';

     params[codeParam] = code;

     var post_data = querystring.stringify(params);
     var post_headers = {
         'Content-Type': 'application/x-www-form-urlencoded',
         'Authorization': 'Basic ' + Buffer.from(this._clientId + ":" + this._clientSecret).toString('base64')
     };

     this._request("POST", this._getAccessTokenUrl(), post_headers, post_data, null, function (error, data, response) {
         if (error) {
             console.log("error");
             callback(error);
         } else {
             var results;

             try {
                 results = JSON.parse(data);
             } catch (e) {
                 results = querystring.parse(data);
             }

             let access_token = results["access_token"];
             let refresh_token = results["refresh_token"];
             delete results["refresh_token"];
             callback(null, access_token, refresh_token, results);
         }
     });
 }
}

util.inherits(Strategy, OAuth2Strategy);

/**
* Retrieve user profile from Clever for Instant Login.
* @param {String} accessToken
* @param {Function} done
* @api protected
*/
OAuth2Strategy.prototype.userProfile = function (accessToken, done) {
 let options = {
     method: 'GET',
     headers: {
         'Authorization': 'Bearer ' + accessToken,
         'Content-Type': 'application/json'
     }
 };

 function getMe(options) {
     console.log(options)
     fetch('https://api.clever.com/me', options)
         .then(response => response.json())
         .then(data => {
             
             console.log("from getMe:")
             console.log(data)
             console.log("-----")
             
             let link = data.links.filter(obj => {
                 if (obj.rel == "canonical") {
                     return obj;
                 }
             });

             let user = data.data;

             // hacky garbage I used to make this work side by side with Azure in the original POC
             // we likely dont need this since we'll normalize users in our own way.  -JohnZ
             user.oid = user.id;
             user.auth_type="Clever";
             
             getUserInfo(link[0].uri, user, options);
         })
         .catch(error => {
             return done(error);
         });
 }

 function getUserInfo(link, user, options) {
     fetch(`https://api.clever.com/v3.0/users/${user.id}`, options)
         .then(response => response.json())
         .then(info => {
             console.log("from getUserInfo:")
             console.log(info)
             console.log("---")
             user.email = info.data.email;
             user.name = info.data.name;

             // more hacky garbage. coul dobviously be dont in the app instead. 
             //this made my life easier though at the time. - JohnZ
             user.displayName = user.name.first + ' ' + user.name.last;

             return done(null, user);
             
         })
         .catch(error => {
             return done(error);
         });
 }


 getMe(options);
};

/**
* Expose `Strategy`.
*/
module.exports = Strategy;