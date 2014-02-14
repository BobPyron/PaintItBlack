_Paint It Black!_
=================

_Paint It Black!_ is a Firefox extension with a very simple goal &mdash; it forces text to be black, whenever possible. No more pale gray text on a bright white background!. 

_Paint It Black!_ does not transmit any data anywhere.

Installation and Usage
----------------------

From Firefox, use the "File Open" dialog to load *paintitblack.xpi*. No restart is necessary. 

>If the xpi file is not available (for example, if you downloaded this project from Github), you will need to 
[install the Firefox Addon SDK](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation), 
then [build using the *cfx* tool](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Getting_Started_With_cfx).

By default, _Paint It Black!_ will automatically operate on all pages as they are loaded.

An icon will be placed on the Firefox toolbar at bottom of the window. This icon may be clicked to toggle between ON and OFF.

Minimum required Firefox version is ????? (heck, I don't know, but I developed this addon using Firefox ESR 24.3.0).

Limitations
-----------
* Only text color will be modified, not background color.
* Text color will only be modified if it is already darker than the background color.
* Headers and links will not be forced all the way to black, but may be made darker than the original.
* No colors within a "&lt;PRE&gt;...&lt;/PRE&gt;" block will be modified. This behavior probably should be controlled by a preference.
* Font faces will not be modified, although **font weight may be forced to normal**.

TODO List
---------
* Place source code on Github (https://github.com/BobPyron/paint-it-black).
* Submit to Mozilla Addons.
* ????
* PROFIT!!!

Known Problems
--------------
* When the _Paint It Black!_ icon is toggled, focus does not return to the document.
* Color does not change on visited links.
* Some sites do not color as expected.
* _Paint It Black!_ adds custom class names to HTML elements. To improve speed 
when toggling on and off, these class names are never removed. They add clutter 
when viewing the HTML with 
[Firebug](https://addons.mozilla.org/en-US/firefox/addon/firebug/?src=ss), with 
[View Source Chart](https://addons.mozilla.org/en-US/firefox/addon/view-source-chart/?src=ss), 
or probably with other source viewers, but are otherwise harmless.


Alternate Programs
------------------
* Within Firefox, "Tools/Options/Content/Colors...", un-check "Allow pages to choose their own colors". This will affect every page without exception, will totally destroy all color information on a page, and make all pages uniformly ugly.
* [Stylish](https://addons.mozilla.org/en-US/firefox/addon/stylish/?src=ss). This addon is incredibly flexible, but it is very cumbersome to make even small changes. I keep this installed to deal with pop-ups and intrusive page headers.
* [NoSquint](https://addons.mozilla.org/en-US/firefox/addon/nosquint/?src=ss). Slightly more flexible than Firefox "colors" option, but if a page uses both dark text on light background, and light text on dark background, you are out of luck. On the other hand, it is a lot easier and faster to use than Stylish. This program has an easy-to-use system for site-specific exceptions. It also has a very nice font size manager.

Copyright and License Information
---------------------------------
_Paint It Black!_ is Copyright (C) 2014 by Robert L. Pyron (rpyron@alum.mit.edu),
and is distributed under the MIT License. 

_Paint It Black!_ uses code from several other sources:

#### Paint It Black!
- Copyright (c) 2014 Robert L. Pyron (mailto:rpyron@alum.mit.edu). All rights reserved.
- Distributed under terms of The MIT License (see below).
- Source: https://github.com/BobPyron/paint-it-black

#### JQuery
- Copyright 2014 jQuery Foundation and other contributors
- Distributed under terms of The MIT License (see below).
- Source: http://jquery.com/

#### TinyColor
- Copyright (c) 2012, Brian Grinstead, http://briangrinstead.com
- Distributed under terms of The MIT License (see below).
- Source: https://github.com/bgrins/TinyColor

#### sprintf
- Copyright (c) 2007-2013, Alexandru Marasteanu <hello [at) alexei (dot] ro>. All rights reserved.
- Distributed under terms of The BSD-3-clause License (see below).
- Source: https://github.com/alexei/sprintf.js

Rant
----

Over the past eight to ten years, at least, many websites have started using gray text on a white background, and the trend is spreading. Every time I open my browser, I think I'm growing cataracts. Even [AARP.org](http://www.AARP.org) is not immune.

I had more to say, then I discovered 
[Contrast Rebellion](http://contrastrebellion.com/), 
which says it better, more completely, and more politely than I can, and gives useful pointers to further reading.

By the way, I blame this at least in part on 
[Lorem Ipsum](https://www.google.com/#newwindow=1&q=lorem+ipsum).
Nobody can read and interpret Lorem Ipsum anyway, so there is no incentive to realize that the text is physically unreadable.

Web designers who believe a site should look "pretty", but don't want the user to read the actual content, can still specify a font face with very thin strokes :).

