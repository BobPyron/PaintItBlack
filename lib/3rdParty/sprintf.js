/*! sprintf.js | Copyright (c) 2007-2013 Alexandru Marasteanu <hello at alexei dot ro> | 3 clause BSD license */

// Modified 2014-01-24 by Robert L Pyron (rpyron@alum.mit.edu):
//   - Added some comments, to help my own comprehension of the code.
//   - Added support for variable field width and precision.

(function(ctx) {
  var sprintf = function() {
    if (!sprintf.cache.hasOwnProperty(arguments[0])) {
      sprintf.cache[arguments[0]] = sprintf.parse(arguments[0]);
    }
    return sprintf.format.call(null, sprintf.cache[arguments[0]], arguments);
  };
  
  sprintf.format = function(parse_tree, argv) {
    var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
    var left_align, field_width, precision;
    
    // Throw an exception if arg is not a number.
    var expect_number = function(arg) {
      if (get_type(arg) != 'number') {
        throw(sprintf('[sprintf] expecting number but found %s', get_type(arg)));
      }
    };
        
    // We've been passed a parse tree. At each node in the parse tree...
    for (i = 0; i < tree_length; i++) {
      node_type = get_type(parse_tree[i]);
      if (node_type === 'string') {
        // If this node is a string, no interpretation is required. Just pass the string along.
        output.push(parse_tree[i]);
      }
      else if (node_type === 'array') {
        //
        // Otherwise, this node is an array of values, most of which may be null.
        // These values determine how the next function argument is interpreted
        // and displayed. 
        //
        // For convenience, the node values are copied into match[], which has
        // the following values:
        //
        // match[0] = Complete substring (from the original format string) that is matched by this node
        // match[1] = Positional argument (explicit); may be null
        // match[2] = Keyword argument; may be null
        // match[3] = An optional "+" sign that forces to preceed the result 
        //            with a plus or minus sign on numeric values. By default, 
        //            only the "-" sign is used on negative numbers.
        // match[4] = An optional padding specifier
        // match[5] = An optional "-" sign, that causes sprintf to left-align 
        //            the result of this placeholder. The default is to 
        //            right-align the result.
        // match[6] = An optional number, that says how many characters the 
        //            result should have.
        // match[7] = An optional precision modifier that says how many digits 
        //            should be displayed for floating point numbers.
        // match[8] = Required type specifier (any character from 'bcdefosuxX')
        //
        match = parse_tree[i]; // convenience purposes only
        if (match[2]) { // keyword argument
          arg = argv[cursor];
          for (k = 0; k < match[2].length; k++) {
            if (!arg.hasOwnProperty(match[2][k])) {
              throw(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
            }
            arg = arg[match[2][k]];
          }
        }
        else if (match[1]) { // positional argument (explicit)
          arg = argv[match[1]];
        }
        else { // positional argument (implicit)
          arg = argv[cursor++];
        }
        
        left_align = match[5];
        field_width = match[6];
        precision = match[7];
                
        if (field_width == '*') {
          expect_number(arg);               // throw exception if arg is not a number
          field_width = parseInt(arg, 10);  // retrieve field_width from arg list
          if (field_width < 0) {            // A negative field width is treated as ...
            left_align = match[5] = '-';    // ... a left adjustment flag ...
            field_width = -field_width;     // ... followed by a positive field width.
          }
          arg = argv[cursor++];             // advance argument cursor
        }
        
        if (precision == '*') {
          expect_number(arg);               // throw exception if arg is not a number
          precision = parseInt(arg, 10);    // retrieve precision from arg list
          if (precision < 0) {              // a negative precision ...
            precision = null;               // ... is treated as though it were missing.
          }
          arg = argv[cursor++];             // advance argument cursor
        }
        
        if (/[^s]/.test(match[8])) {
          expect_number(arg);   // throw exception if arg is not a number
        }
        switch (match[8]) {
          case 'b': arg = arg.toString(2); break;
          case 'c': arg = String.fromCharCode(arg); break;
          case 'd': arg = parseInt(arg, 10); break;
          case 'e': arg = precision ? arg.toExponential(precision) : arg.toExponential(); break;
          case 'f': arg = precision ? parseFloat(arg).toFixed(precision) : parseFloat(arg); break;
          case 'o': arg = arg.toString(8); break;
          case 's': arg = ((arg = String(arg)) && precision ? arg.substring(0, precision) : arg); break;
          case 'u': arg = arg >>> 0; break;
          case 'x': arg = arg.toString(16); break;
          case 'X': arg = arg.toString(16).toUpperCase(); break;
        }
        arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
        pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
        pad_length = field_width - String(arg).length;
        pad = field_width ? str_repeat(pad_character, pad_length) : '';
        output.push(left_align ? arg + pad : pad + arg);
      }
    }
    return output.join('');
  };
  
  sprintf.cache = {};
  
  sprintf.parse = function(fmt) {
    var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
    while (_fmt) {
      if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
        parse_tree.push(match[0]);
      }
      else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
        parse_tree.push('%');
      }
      /*
       *  /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/
       *  
       *    ^\x25             Matches '%' at start of string.
       *    (?:               Non-capturing parentheses: either...
       *      ([1-9]\d*)\$      match[1] = Positional argument (explicit); may be null
       *    |                 or ...
       *      \(([^\)]+)\)      match[2] = Keyword argument; may be null
       *    )?                ? indicates that positional or keyword argument is optional
       *    (\+)?             match[3] = optional plus sign (force leading plus or minus sign)
       *    (                 match[4] = padding character; either...
       *      0                 digit 0
       *    |                 or ...
       *      '[^$]             tick, followed by any char except '$' (end-of-string?)
       *    )?                ? indicates that padding character is optional
       *    (-)?              match[5] = optional minus sign
       *    (\*|\d+)?         match[6] = optional numeric value (field width) or asterisk
       *    (?:               Non-capturing parentheses:
       *      \.                dot
       *      (\*|\d+)             match[7] = numeric value (precision) or asterisk
       *    )?                ? indicates that precision is optional
       *    ([b-fosuxX])      match[8] = any character from 'bcdefosuxX' (required type specifier)
       *  
       */
      else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\*|\d+)?(?:\.(\*|\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
        if (match[2]) {
          arg_names |= 1;
          var field_list = [], replacement_field = match[2], field_match = [];
          /*
           *  /^([a-z_][a-z_\d]*)/i
           */
          if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
            field_list.push(field_match[1]);
            while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
              /*
               *  /^\.([a-z_][a-z_\d]*)/i
               */
              if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
                field_list.push(field_match[1]);
              }
              /*
               *  /^\[(\d+)\]/
               */
              else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
                field_list.push(field_match[1]);
              }
              else {
                throw('[sprintf] huh?');
              }
            }
          }
          else {
            throw('[sprintf] huh?');
          }
          match[2] = field_list;
        }
        else {
          arg_names |= 2;
        }
        if (arg_names === 3) {
          throw('[sprintf] mixing positional and named placeholders is not (yet) supported');
        }
        parse_tree.push(match);
      }
      else {
        throw('[sprintf] huh?');
      }
      _fmt = _fmt.substring(match[0].length);
    }
    return parse_tree;
  };
  
  var vsprintf = function(fmt, argv, _argv) {
    _argv = argv.slice(0);
    _argv.splice(0, 0, fmt);
    return sprintf.apply(null, _argv);
  };
  
  /**
   * helpers
   */
  function get_type(variable) {
    return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
  }
  
  function str_repeat(input, multiplier) {
    for (var output = []; multiplier > 0; output[--multiplier] = input) {/* do nothing */}
    return output.join('');
  }
  
  /**
   * export to either browser or node.js
   */
  ctx.sprintf = sprintf;
  ctx.vsprintf = vsprintf;
})(typeof exports != "undefined" ? exports : window);
