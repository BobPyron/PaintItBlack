//==============================================================================
// FILE:  paintitblack.js
//
// This file is part of Paint It Black!, a Firefox addon.
// Copyright (c) 2014 by Robert L. Pyron (rpyron@alum.mit.edu)
// Distributed under the terms of the MIT License.
//
//==============================================================================

(function() {
  
  /*****************************************************************************
  ** GLOBAL CONSTANTS AND VARIABLES
  *****************************************************************************/

  const stylesheet_id        = "paintitblack_stylesheet";
  const classname_forceblack = "paintitblack_forceblack";
  const classname_fontweight = "paintitblack_normalweight";
  const css_forceblack       = " .paintitblack_forceblack {color:black!important;}";
  const css_fontweight       = " .paintitblack_normalweight {font-weight:normal!important;}";
  const truncatedURI = truncateUrl(document.documentURI);

  var documentAnalyzed = false;   // set by AnalyzeDocumentColors(); never cleared
  var documentModified = false;   // set by UpdateDocumentColors(), cleared by ToggleDocumentColors()
  var documentNeedsUpdate = true; // set by UpdatePreferences(), cleared by UpdateDocumentColors() and by RevertDocumentColors()
  var userPrefs = {
      "autoColor":false,
      "autoAdjustFontWeight":true,
      "clampLow":10,
      "clampHigh":40
  };
  var interestingColors = {};
  
  /*****************************************************************************
  ** AnalyzeDocumentColors() - Walk the DOM. At each node, determine whether the text
  ** or background needs to be modified:
  **    * For all nodes with fontweight <  400 ("normal"), add classname
  **      "paintitblack_normalweight" to the node.
  **    * Do not modify colors for any node where the background is darker
  **      than the text.
  **    * Do not modify colors for any node where text color is already black.
  **    * Links, headers, and text inside SPAN tags are frequently colored.
  **      I don't want to force these nodes all the way to black; for now, just
  **      store enough information so the new color can be computed later:
  **        - Add a classname to the node based on the original color
  **          ("paintitblack_######")
  **        - Save the original color in a hashtable (interestingColors)
  **    * Other nodes will be forced to black text. Add classname
  **      "paintitblack_black" to the node.
  *****************************************************************************/
  function AnalyzeDocumentColors() {

    // ---------------------
    // Go away, if possible.
    // ---------------------
    if (document.body===undefined) {
      // There is no document body for about:blank, about:config, etc.
      return;
    }
    else if (!document.body) {
      return;
    }
    else if (documentAnalyzed) {
      // We've already analyzed colors for this site.
      return;
    }

    // -------------------------------------------
    // We are about to walk the DOM. At each node,
    // we need to inherit some data:
    // -------------------------------------------
    const defaultdata = {
      "fg_parent" : "black",      // parent foreground color
      "bg_parent" : "white",      // parent foreground color
      "preformatted" : false      // are we in a pre-formatted block?
    };

    // ---------------------------------------------------------------------
    // Walk the DOM, examining foreground and background color at each node.
    // ---------------------------------------------------------------------
    walk_the_DOM(document.body, defaultdata, function(node, auxdata) {

      // ----------------------------------------------
      // Get existing foreground and background colors.
      // Deal with "transparent" colors.
      // ----------------------------------------------
      var myStyles = $(node).css(["color" , "background-color" , "font-weight"]);
      var fg_new = fg_old = myStyles["color"];
      var bg_new = bg_old = myStyles["background-color"];
      var fontweight = wt_old = myStyles["font-weight"];

      if (fg_new == "transparent") { fg_new = auxdata.fg_parent; }
      if (bg_new == "transparent") { bg_new = auxdata.bg_parent; }

      // ---------------------------------------
      // Deal with font weight.
      // NOTE: 400 indicates normal font weight.
      // ---------------------------------------
      if (fontweight < 400) {
        $(node).addClass(classname_fontweight);
        fontweight = 400;
      }

      // -------------------------------------
      // Some HTML elements are not colorable.
      // Just go away, and don't make a fuss.
      // TODO: Identify more of these.
      // -------------------------------------
      if ( ["BR", "SCRIPT", "NOSCRIPT", "INPUT", "IMG"].indexOf(node.nodeName) >= 0 ) {
        return auxdata;
      }

      // ------------------------------------------------------
      // Keep track of whether we are in a pre-formatted block.
      // ------------------------------------------------------
      var preformatted = auxdata.preformatted;
      if (auxdata.preformatted) {
        return auxdata;
      }
      if ( ["PRE"].indexOf(node.nodeName) >= 0 ) {
        preformatted = true;
      }

      // -----------------------------------
      // Determine the new foreground color.
      // -----------------------------------
      var reason = '';
      if (fg_old == "transparent") {
        // No change to foreground color.
        reason = "Foreground is transparent.";
      }
      else if (GetLuminosity(fg_new) >= GetLuminosity(bg_new)) {
        // No change to foreground color.
        reason = "Light text on dark background.";
      }
      else if ( ["SPAN","H1","H2","H3","H3","H4","H5","H6"].indexOf(node.nodeName) >= 0 ) {
        let fg_hex = tinycolor(fg_new).toHex();
        let bg_hex = tinycolor(bg_new).toHex();

        // Add classname to node.
        let classname = sprintf("paintitblack_%s_%s", fg_hex, bg_hex);
        $(node).addClass(classname);

        // Add this color combination to interestingColors.
        let interesting_name = fg_hex + "_" + bg_hex;
        interestingColors[interesting_name] = [fg_hex, bg_hex];
      }
      else if ( ["A"].indexOf(node.nodeName) >= 0 ) {
        let fg_hex = tinycolor(fg_new).toHex();
        let bg_hex = tinycolor(bg_new).toHex();

        // Add classname to node.
        let classname_a = sprintf("paintitblack_%s_%s_a", fg_hex, bg_hex);
        $(node).addClass(classname_a);

        // Add this color combination to interestingColors.
        let interesting_name = fg_hex + "_" + bg_hex;
        interestingColors[interesting_name] = [fg_hex, bg_hex];
      }
      else {
        // Force foreground color to black.
        fg_new = "black";
        $(node).addClass(classname_forceblack);
      }

      // -----------------------------------------------------------------
      // Generate new auxdata that will be passed to this node's children.
      // -----------------------------------------------------------------
      return {
        "fg_parent" : fg_new,       // child's parent foreground color
        "bg_parent" : bg_new,       // child's parent background color
        "preformatted" : preformatted   // are we in a pre-formatted block?
      };

    });

    // -----------
    // FINI.
    // -----------
    documentAnalyzed = true;
  }

  /*****************************************************************************
  ** ModifyDocumentColors() - Generate an inline stylesheet for our modified colors:
  **    * We can assume that classnames have already been added to nodes.
  **    * Remove any existing stylesheet which has ID "paintitblack_stylesheet".
  **    * Generate new stylesheet, with ID "paintitblack_stylesheet".
  **    * Always add CSS ".paintitblack_normalweight {font-weight:normal!important;}"
  **    * Always add CSS ".paintitblack_black{color:black!important;}"
  **    * For each color saved in "interestingColors", compute the new color
  **    * based on current preferences. Add CSS to stylesheet.
  **    * Append the new stylesheet to the document root.
  *****************************************************************************/
  function ModifyDocumentColors(forceUpdateColors) {

    if ( !documentAnalyzed ) {
      // This is the first time the tab is visible. Analyze it.
      if (userPrefs.autoColor) {
        AnalyzeDocumentColors();
        UpdateDocumentColors(forceUpdateColors);
      }
    }
    else if (documentModified) {
      // We're looking at a modified document. Assume preferences have changed.
      UpdateDocumentColors(forceUpdateColors);
    }
    else if (forceUpdateColors) {
      // Caller thinks we should unconditionally update.
      // This can happen with ToggleDocumentColors().
      UpdateDocumentColors(forceUpdateColors);
    }
    
    self.port.emit("UpdateDocumentState", document.documentURI, documentModified);

  }


  /*****************************************************************************
  ** UpdateDocumentColors()
  *****************************************************************************/
  function UpdateDocumentColors(forceUpdateColors) {
    
    
    //-----------------------------------------------------------------
    // Look for excuses to skip all the hard work and just laze around.
    //-----------------------------------------------------------------
    if (forceUpdateColors) {
      // OOPS, can't skip out now.
    }
    else if (!documentNeedsUpdate) {
      // We're not needed.  Don't leave in a huff, just leave.
      self.port.emit("UpdateDocumentState", document.documentURI, documentModified);
      return;
    }
    else if (!documentAnalyzed) {
      // We can't do anything if document colors have not been analyzed.
      self.port.emit("UpdateDocumentState", document.documentURI, documentModified);
      return;
    }
    
    // -------------------------------------------------------------
    // Generate CSS rules for each forground/background combination.
    // -------------------------------------------------------------
    var css = '  ' + css_forceblack + '\n';   // always add this CSS rule to stylesheet.

    for (var key in interestingColors) {
      if (interestingColors.hasOwnProperty(key)) {
        // Compute new foreground color from saved colors.
        let fg_hex = interestingColors[key][0];                 // this is a hex value
        let bg_hex = interestingColors[key][1];                 // this is a hex value
        let fg_dark = DarkenForeground('#'+fg_hex,'#'+bg_hex);  // this is an RGB string

        // Generate classnames from original hex colors.
        let classname   = sprintf("paintitblack_%s_%s", fg_hex, bg_hex);

        // Generate CSS rules from darkened color.
        let css_rule    = sprintf(" .%s        {color:%s!important;}", classname, fg_dark);
        let css_rule_a  = sprintf("a.%s_a:link {color:%s!important;}", classname, fg_dark);

        // Append new rules to generated CSS.
        css += '  ' + css_rule + '\n';
        css += '  ' + css_rule_a + '\n';
      }
    }

    // -----------------------------
    // Add CSS rule for font weight.
    // -----------------------------
    if ( userPrefs.autoAdjustFontWeight ) {
      css += '  ' + css_fontweight + '\n';
    }

    // ----------------------------------------------------
    // Generate stylesheet.
    // Remove any stylesheet that was previously generated.
    // Append new stylesheet to document root.
    // ----------------------------------------------------

    var stylesheet = sprintf("\n\n<STYLE id='%s'>\n%s</STYLE>\n", stylesheet_id, css);
    $("#"+stylesheet_id).remove();
    $(stylesheet).appendTo( $(":root") );
    
    // -----------
    // FINI.
    // -----------
    documentModified = true;
    documentNeedsUpdate = false;

    self.port.emit("UpdateDocumentState", document.documentURI, documentModified);

  }
    
  
  /*****************************************************************************
  ** RevertDocumentColors() - Undo some (or all) modifications
  **    * Remove any existing stylesheet which has ID "paintitblack_stylesheet".
  **    * If specified in preferences, also walk the DOM; at each node, remove
  **      any classname that begins with "paintitblack_"
  *****************************************************************************/
  function RevertDocumentColors() {

    //--------------------------------------------------------------------
    // We appended a global stylesheet with an id of 'paintitblack'.
    // Throw it away.
    //--------------------------------------------------------------------
    $('#'+stylesheet_id).remove();

    //--------------------------------------------------------------------
    // Now scan the DOM tree.  At each node, remove all classes that begin
    // with 'paintitblack'.
    // TODO: Define a user preference for this...
    // TODO: ... or perhaps a context menu item.
    //--------------------------------------------------------------------
    if (false) {
      walk_the_DOM(document.body, null, function (node, auxdata) {
        // set up indented display name for debugging
        var depth = $(node).parents().length;
        var displayName = sprintf("%*s", depth+node.nodeName.length, node.nodeName);

        //------------------------------------------------------
        // Scan all specified classes for this node. Remove all
        // classes that begin with 'paintitblack'. Note that the
        // original classList will be modified, despite use of
        // an alias. Since we may have applied several classes
        // to this node, we need to correct the loop index each
        // time one of our classes is removed.
        //------------------------------------------------------
        var classList = node.classList;   // alias for convenience
        for (var i = 0; i < classList.length; i++) {
          var className = classList.item(i);
          if (className.startsWith("paintitblack")) {
            $(node).removeClass(className);
            i--;    // we just modified the list, so re-use the same index
          }
        }

        // ------------------------------------------------
        // If there are no remaining classes for this node,
        // remove the 'class' attribute.
        // ------------------------------------------------
        if (classList.length == 0) {
          node.removeAttribute('class');
        }

        return auxdata;
      });
    }

    // -----------
    // FINI.
    // -----------
    documentModified = false;
    documentNeedsUpdate = false;
    
    self.port.emit("UpdateDocumentState", document.documentURI, documentModified);

  };

  
  /*****************************************************************************
  ** ToggleDocumentColors() - 
  *****************************************************************************/
  function ToggleDocumentColors() {
    
    if (documentModified) {
      // We're currently looking at a modified document. Revert it.
      RevertDocumentColors();
    } 
    else {
      ModifyDocumentColors(forceUpdateColors=true);
    }
    
  }
  
  /*****************************************************************************
  ** UpdatePreferences(newPrefs) -
  **    * Clamp values to acceptable range.
  **    * Determine whether an update is needed for this document.
  **    * Store the new preferences.
  *****************************************************************************/
  function UpdatePreferences(newPrefs) {

    function PrefsEqual(oldPrefs,newPrefs) {
      if (oldPrefs.autoColor            != newPrefs.autoColor            ) return false;
      if (oldPrefs.autoAdjustFontWeight != newPrefs.autoAdjustFontWeight ) return false;
      if (oldPrefs.clampLow             != newPrefs.clampLow             ) return false;
      if (oldPrefs.clampHigh            != newPrefs.clampHigh            ) return false;
      return true;
    }
    
    // First, make sure the new values are within acceptable range.
    newPrefs.autoColor            = !!newPrefs.autoColor;
    newPrefs.autoAdjustFontWeight = !!newPrefs.autoAdjustFontWeight;
    newPrefs.clampLow             = clamp(newPrefs.clampLow, 0, 100);
    newPrefs.clampHigh            = clamp(newPrefs.clampHigh, 0, 100);

    // Determine whether an update is needed for this document.
    if ( !PrefsEqual(newPrefs, userPrefs) ) {
      documentNeedsUpdate = true;
    }
    
    // Store the new preferences.
    userPrefs = newPrefs;

  }

  /*****************************************************************************
  ** walk_the_DOM() - Walk all nodes in DOM tree, applying the specified
  **                  function at each node.
  *****************************************************************************/
  var walk_the_DOM = function walk(node, auxdata, func) {
    // Type 1 is an element node.
    if (node.nodeType == 1) {
      auxdata = func(node, auxdata);
      {
        node = node.firstChild;
        while (node) {
            walk(node, auxdata, func);
            node = node.nextSibling;
        }
      }
    }
  };

  /*****************************************************************************
  ** SameColor() - Utility function.
  ** DifferentColor() - Utility function.
  *****************************************************************************/
  function SameColor(color1, color2) {
    return tinycolor.equals(tinycolor(color1),tinycolor(color2));
  }

  function DifferentColor(color1, color2) {
    return !SameColor(color1, color2);
  }

  /*****************************************************************************
  ** FormattedColorInfo() - Build a string with interesting info about specified color.
  *****************************************************************************/
  function FormattedColorInfo(color) {
    if (color == "transparent") {
      return color;
    }
    var t = tinycolor(color);
    var hsl = t.toHsl();
    var l = Math.round(hsl.l * 100);
    var retval = sprintf("#%-7s(%d%%)", t.toHex(), l);
    return retval;
  }

  /*****************************************************************************
  ** GetLuminosity() - Utility function.
  *****************************************************************************/
  function GetLuminosity(color) {
    return tinycolor(color).toHsl().l;
  }

  /*****************************************************************************
  ** DarkenForeground() - Utility function.
  **
  ** Some interesting color theory (see http://www.w3.org/TR/AERT#color):
  **
  ** The following is a formula for representing difference in hue
  **
  **     Maximum ((Text R - Background R), (Background R - Text R)) +
  **     Maximum ((Text G - Background G), (Background G - Text G)) +
  **     Maximum ((Text B - Background B), (Background B - Text B))
  **
  ** The following is a formula for representing brightness
  **
  **   ((R X 299) + (G X 587) + (B X 114)) / 1000
  **
  ** The difference in brightness is the absolute value of the difference
  ** between the text vs. background brightness.
  **
  ** According to W3C, a brightness difference score of 125 or higher and a hue
  ** difference of 500 or higher represents acceptable contrast for readability.
  **
  *****************************************************************************/
  function DarkenForeground(fg,bg) {

    var CLAMP_LO = userPrefs.clampLow  * 255 / 100;  // Don't darken below this number.
    var CLAMP_HI = userPrefs.clampHigh * 255 / 100;  // Make sure result is below this number.


    // recommended minimum difference between brightness of text and background
    var RECOMMENDED_DIFFERENCE = 125;

    // Determine brightness of text and background.
    var fg_brightness = ComputeBrightness(fg);  // value in range [0..255]
    var bg_brightness = ComputeBrightness(bg);  // value in range [0..255]


    // Don't darken if brightness is already below CLAMP_LO.
    if (fg_brightness < CLAMP_LO) {
      return fg;
    }

    // Apply RECOMMENDED_DIFFERENCE to get new brightness value.
    // Clamp this value to desired range.
    var new_brightness_1 = bg_brightness - RECOMMENDED_DIFFERENCE;
    var new_brightness = clamp(new_brightness_1, CLAMP_LO, CLAMP_HI);


    if (new_brightness > fg_brightness) {
      return fg;
    }

    // We're going to adjust rgb values by this ratio...
    var adjust = new_brightness / fg_brightness;


    var rgb = tinycolor(fg).toRgb();
    rgb.r = Math.round(rgb.r * adjust);
    rgb.g = Math.round(rgb.g * adjust);
    rgb.b = Math.round(rgb.b * adjust);

    var fg_new = tinycolor(rgb).toRgbString();

    return fg_new;
  }

  //----------------------------------------------
  // ComputeBrightness() - Utility function.
  // compute brightness using formula:
  //    ((R X 299) + (G X 587) + (B X 114)) / 1000
  // returns a value in range [0..255]
  //----------------------------------------------
  function ComputeBrightness(color) {
    var rgb = tinycolor(color).toRgb();
    var brightness = (rgb.r * 0.299) + (rgb.g * 0.587) + (rgb.b * 0.114);
    return brightness;
  }

  //-----------------------------------
  // clamp() - Utility function.
  // Restrict value to specified range.
  //-----------------------------------
  function clamp(value, lo, hi) {
    var v = value;
    v = Math.max(v,lo);
    v = Math.min(v,hi);
    return v;
  }


  /*****************************************************************************
  ** Listen for and respond to messages.
  *****************************************************************************/

  self.port.on("AnalyzeDocumentColors", function() {
    AnalyzeDocumentColors();                       
  });                                              

  self.port.on("ModifyDocumentColors", function() {
    ModifyDocumentColors();                        
  });                                              

  self.port.on("RevertDocumentColors", function() {
    RevertDocumentColors();
  });

  self.port.on("ToggleDocumentColors", function() {
    ToggleDocumentColors();
  });

  self.port.on("QueryDocumentState", function() {
    self.port.emit("UpdateDocumentState", document.documentURI, documentModified);
    });

  self.port.on("UpdatePreferences", function(payload) {
    var newPrefs = JSON.parse(payload);
    UpdatePreferences(newPrefs);
  });


  //--------------------------------------------------------------------
  // Main program may send this message to determine whether this script
  // is still valid. If not, the caller will have an exception raised.
  //--------------------------------------------------------------------
  self.port.on("testValid", function() {
    // do nothing
  });

  /*****************************************************************************
  ** FINI - paintitblack.js
  *****************************************************************************/

})();

