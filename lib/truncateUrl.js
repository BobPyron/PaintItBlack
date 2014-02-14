//
// This file is part of Paint It Black!, a Firefox addon.
//
// Copyright (c) 2014 by Robert L. Pyron (rpyron@alum.mit.edu)
// Distributed under the terms of the MIT License.
//
(function(ctx) {

  /**
   * Truncate URL to fit within specified length. 
   *  
   * Inspired by:
   *    http://www.ferrassi.com/2011/08/javascript-string-truncate-function/ 
   *  
   */
  function truncateUrl(url, length, ellipsis) {
   
    // Set length and ellipsis to defaults if not defined
    var MINIMUM_LENGTH = 48;
    var ELLIPSIS = '...';
    if (typeof length == 'undefined') var length = MINIMUM_LENGTH;
    if (typeof ellipsis == 'undefined') var ellipsis = ELLIPSIS;
     
    // 
    if (length < MINIMUM_LENGTH) length = MINIMUM_LENGTH;
    if (ellipsis == '') ellipsis = ELLIPSIS;
    
    // Return if the url is already shorter than the cutoff.
    if (url.length <= length) return url;
    
    // Otherwise make sure truncated URL fits within length.
    return url.substring(0, length-ellipsis.length) + ellipsis;
  }

  /**
   * export to either browser or node.js
   */
  ctx.truncateUrl = truncateUrl;

})(typeof exports == "undefined" ? window : exports);

