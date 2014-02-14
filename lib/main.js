//==============================================================================
// FILE:  main.js
//
// This file is part of Paint It Black!, a Firefox addon.
// Copyright (c) 2014 by Robert L. Pyron (rpyron@alum.mit.edu)
// Distributed under the terms of the MIT License.
//
//==============================================================================

(function() {

  /*****************************************************************************
  ** GLOBALS
  *****************************************************************************/

  //-------------------------------------------
  // We need to access some stuff from the SDK.
  //-------------------------------------------
  const widgets = require("sdk/widget");
  const tabs = require("sdk/tabs");
  const data = require("sdk/self").data;
  const prefSet = require("sdk/simple-prefs");
  const privateBrowsing = require("sdk/private-browsing");

  //--------------------------------------------------
  // We need to access some external (local) JS files.
  // Note lack of '.js' filename extension.
  //--------------------------------------------------
  const sprintf = require("./3rdParty/sprintf.min").sprintf;
  const truncateUrl = require("./truncateUrl").truncateUrl;

  /*****************************************************************************
  ** WIDGET
  *****************************************************************************/

  //--------------
  // Widget icons.
  //--------------
  const active_icon = data.url("images/favicon-active.png");
  const inactive_icon = data.url("images/favicon-inactive.png");

  //-------------------
  // Create the widget.
  //-------------------
  var paintitblackWidget = widgets.Widget({
    id: "paintitblack-icon",
    label: "Paint It Black!",
    tooltip: "Paint It Black!",
    contentURL: inactive_icon,
    onClick: function onWidgetClick() {
      ToggleDocumentColors(tabs.activeTab);
    }
  });

  //--------------------------------------------------------
  // Update the widget icon based on current document state.
  //--------------------------------------------------------
  function UpdateDocumentState(documentState,documentUrl) {
    // If we were not passed any arguments, ask the active tab
    // to return information about its state.
    if (arguments.length < 2) {
      QueryDocumentState(tabs.activeTab);
      return;
    }

    // Only change the widget favicon for the active tab.
    if (documentUrl != tabs.activeTab.url) {
      return;
    }

    var active_tooltip = "Paint It Black!\n is ON for this page.";
    var inactive_tooltip = "Paint It Black!\n is OFF for this page.";
    paintitblackWidget.contentURL = documentState ? active_icon : inactive_icon;
    paintitblackWidget.tooltip = documentState ? active_tooltip : inactive_tooltip;
  };


  /*****************************************************************************
  ** PREFERENCES
  *****************************************************************************/

  //---------------------------------------
  // Retrieve preferences, ensure that all
  // preferences are within allowed ranges,
  // and send to content script.
  //---------------------------------------
  function UpdatePreferences(tab) {

    // Don't let these values stray outside acceptable boundaries.
    prefSet.prefs["clampLow" ] = clamp(prefSet.prefs["clampLow" ], 0, 100);
    prefSet.prefs["clampHigh"] = clamp(prefSet.prefs["clampHigh"], 0, 100);

    // Convert preferences to a JSON string.
    var jsonPrefs = JSON.stringify({
      "autoColor"            : prefSet.prefs["autoColor"           ],
      "autoAdjustFontWeight" : prefSet.prefs["autoAdjustFontWeight"],
      "clampLow"             : prefSet.prefs["clampLow"            ],
      "clampHigh"            : prefSet.prefs["clampHigh"           ]
    });

    // Send new preferences to specified tab.
    // If no tab specified, send to active tab.
    if (arguments.length < 1) {
      tab = tabs.activeTab;
    }
    return SendMessageToTab(tab,"UpdatePreferences",jsonPrefs);
  }

  //---------------------------------------
  // Listen for changes to this extension's
  // preferences. Note that `""` listens to
  // all changes in the extension's branch.
  //---------------------------------------
  prefSet.on("", function onPrefChange(prefName) {
    for each (var tab in tabs) {
      UpdatePreferences(tab);
    }
  });

  //------------------
  // Utility function.
  //------------------
  function clamp(value, lo, hi) {
    var v = value;
    v = Math.max(v,lo);
    v = Math.min(v,hi);
    return v;
  }

  /*****************************************************************************
  ** SendMessageToTab() -- Send a message to the specified tab.
  **
  ** This will fail if the tab has no worker, which will happen on pages
  ** such as "about:blank", "about:config", "about:newtab", etc,
  **
  ** The worker is attached to the tab by HandleChangedTabContent(), which is
  ** called after a "ready" message is received from that tab. The worker is
  ** stored in a tab property called "worker", which is NOT part of the addon SDK.
  **
  ** Returns true if message was successfully sent.
  **
  *****************************************************************************/
  function SendMessageToTab(tab,message,payload) {
    try {
      tab.worker.port.emit(message,payload);
      return true;
    }
    catch (e) {
      return false;
    }
  }

  //-------------------------------------------------------------------
  // These functions send the appropriate message to the specified tab.
  //-------------------------------------------------------------------
  function ModifyDocumentColors(tab,forceUpdateColors) {
    return SendMessageToTab(tab,"ModifyDocumentColors",forceUpdateColors);
  }
  function RevertDocumentColors(tab)  { return SendMessageToTab(tab,"RevertDocumentColors");  }
  function ToggleDocumentColors(tab)  { return SendMessageToTab(tab,"ToggleDocumentColors");  }
  function QueryDocumentState(tab)    { return SendMessageToTab(tab,"QueryDocumentState"); }


  /*****************************************************************************
  ** Respond to tab events: "ready" , "load" , "pageshow" , "activate", "close"
  *****************************************************************************/
  (function() {

    function HandleChangedTabContent(tab) {

      // This message will indicate whether the worker is present and still valid.
      if ( SendMessageToTab(tab,"testValid") ) {
        return;
      }

      // Destroy any previous worker.
      if (tab.hasOwnProperty("worker")) {
        tab.worker.destroy();
        tab.worker = null;
      }

      // Attach our content script to the tab.
      // I believe the worker will be null for empty tabs.
      tab.worker = tab.attach({
        contentScriptFile: [
          data.url("3rdParty/jquery-2.1.0.min.js"),
          data.url("3rdParty/tinycolor.min.js"),
          data.url("../lib/3rdParty/sprintf.min.js"),   // under '../lib' so it can be accessed by main and by content script
          data.url("../lib/truncateUrl.js"),            // under '../lib' so it can be accessed by main and by content script
          data.url("PaintItBlack.js")
        ]
      });

      // Not necessary, I just want to see result in log.
      SendMessageToTab(tab,"testValid");

      // Set a message handler for "UpdateDocumentState".
      tab.worker.port.on("UpdateDocumentState", function onUpdateDocumentState(documentUrl, documentState) {
        UpdateDocumentState(documentState, documentUrl);
      });

      // Ask the tab about its current state.
      QueryDocumentState(tab);

    };

    //--------------------------------------------------------------------------
    // From https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/tabs
    //
    //    This event is emitted when the DOM for a tab's content is ready. It is
    //    equivalent to the DOMContentLoaded event for the given content page.
    //
    //    A single tab will emit this event every time the DOM is loaded: so
    //    it will be emitted again if the tab's location changes or the content
    //    is reloaded.
    //
    //    After this event has been emitted, all properties relating to the
    //    tab's content can be used.
    //
    // We need to:
    //    - Attach a content script to this tab.
    //    - Make sure this tab has a copy of the current user preferences.
    //    - Don't modify colors until 'pageShow' or 'activate' event.
    //--------------------------------------------------------------------------
    tabs.on("ready", function onTabReady(tab) {
      HandleChangedTabContent(tab); // Attach a content script to this tab.
      UpdatePreferences(tab);       // Make sure this tab has a copy of the current user preferences.
      QueryDocumentState(tab);      //
    });

    //--------------------------------------------------------------------------
    // From https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/tabs
    //
    //    This event is emitted when the page for the tab's content is loaded.
    //    It is equivalent to the load event for the given content page.
    //
    //    A single tab will emit this event every time the page is loaded: so
    //    it will be emitted again if the tab's location changes or the content
    //    is reloaded. This event is similar to the ready event, except that it
    //    can be used for pages that do not have a DOMContentLoaded event,
    //    like images.
    //
    //    After this event has been emitted, all properties relating to the
    //    tab's content can be used. For pages that have a DOMContentLoaded
    //    event, load is fired after ready.
    //
    // We don't need to do anything in response to this message.
    // Rationale:
    //    - If there is a DOM, we've already received a "ready" message.
    //    - If there is no DOM, there is no text that has to be colored.
    // Actually, there are a few things we should do:
    //    - Make sure this tab has a copy of the current user preferences.
    //    - Don't modify colors until 'pageShow' or 'activate' event.
    //--------------------------------------------------------------------------
    tabs.on("load", function onTabLoad(tab) {
      UpdatePreferences(tab);       // Make sure this tab has a copy of the current user preferences.
      QueryDocumentState(tab);
    });

    //--------------------------------------------------------------------------
    // From https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/tabs
    //
    //    The pageshow event is emitted when the page for a tab's content
    //    is loaded. It is equivalent to the pageshow event for the given
    //    content page.
    //
    //    This event is similar to the load and ready events, except unlike
    //    load and ready, pageshow is triggered if the page was retrieved
    //    from the bfcache. This means that if the user loads a page, loads
    //    a new page, then moves back to the previous page using the "Back"
    //    button, the pageshow event is emitted when the user moves back to
    //    the previous page, while the load and ready events are not.
    //
    //    This event is not emitted when the tab is made the active tab: to
    //    get notified about that, you need to listen to the activate event.
    //
    //    After this event has been emitted, all properties relating to the
    //    tab's content can be used. It is emitted after load and ready.
    //
    // We need to:
    //    - Make sure this tab has a copy of the current user preferences.
    //    - Update document colors (because preferences may have changed).
    //--------------------------------------------------------------------------
    tabs.on("pageshow", function onTabPageshow(tab) {
      UpdatePreferences(tab);       // Make sure this tab has a copy of the current user preferences.
      ModifyDocumentColors(tab,forceUpdateColors=false);
      QueryDocumentState(tab);
    });

    //--------------------------------------------------------------------------
    // From https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/tabs
    //
    //  This event is emitted when the tab is made active.
    //
    // We need to:
    //    - Make sure this tab has a copy of the current user preferences.
    //    - Since this may be the first time the tab is visible, we need to
    //      modify the tab's colors (depending on autoColor preference).
    //    - AutoColor may currently be turned off, but the page could still
    //      modified from earlier in this browser session. Update the document
    //      colors.
    //--------------------------------------------------------------------------
    tabs.on("activate", function onTabActivate(tab) {
      UpdatePreferences(tab);       // Make sure this tab has a copy of the current user preferences.
      ModifyDocumentColors(tab,forceUpdateColors=false);
      QueryDocumentState(tab);
    });

    //--------------------------------------------------------------------------
    // From https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/tabs
    //
    //  This event is emitted when the active tab is made inactive.
    //
    // We don't need to do anything in response to this message.
    //--------------------------------------------------------------------------
    tabs.on("deactivate", function onTabDeactivate(tab) {
    });

    //--------------------------------------------------------------------------
    // From https://developer.mozilla.org/en-US/Add-ons/SDK/High-Level_APIs/tabs
    //
    //    This event is emitted when a tab is closed. When a window is closed
    //    this event will be emitted for each of the open tabs in that window.
    //
    // We don't need to do anything in response to this message.
    //--------------------------------------------------------------------------
    tabs.on("close", function onTabClose(tab) {
    });

  })();

  /*****************************************************************************
  ** FINI - main.js
  *****************************************************************************/

})();

