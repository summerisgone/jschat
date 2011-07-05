Jschat is web application for online support via Jabber
=======================================================

Quick start
-----------

1. Enter repository directory and open ``index.html`` in browser.
2. Click on **Start chat**, enter name, email and message.
3. Chat

Dependencies
------------

Originally application was written with  `JavascriptMVC <http://javascriptmvc.com/>`_
framework. But lated I decided to rewrite it on lighter 
`Backbone.js <http://documentcloud.github.com/backbone/>`_

So the requirements are:

* jQuery as workhorse
* `Underscore.js <http://documentcloud.github.com/underscore/>`_  as requirement for backbone and a nice *"tie to go along with jQuery's tux"*.
* `Backbone.js <http://documentcloud.github.com/backbone/>`_ as MVC framework
* `Strophe.js <http://strophe.im/strophejs/>`_  as XMPP layer library (*)
* `Fleshed <http://flxhr.flensed.com/>`_  for browsers, that doen't support CORS to initiate cross-domain connection via Flash
* `Handlebars.js <http://handlebars.strobeapp.com/>`_ as javascript tempalte engine (**)

\* - You will need also BOSH connection manager, like a `punjab <https://github.com/metajack/punjab>`_ as bridge to XMPP server
.

\*\* - Maybe it is better to use `Mustache <http://mustache.github.com/>`_?

Some libraries may be dowloaded from CDN and github: ::

    <script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.6.1/jquery.min.js"></script>
    <script type="text/javascript" src="http://documentcloud.github.com/underscore/underscore-min.js"></script>
    <script type="text/javascript" src="http://documentcloud.github.com/backbone/backbone-min.js"></script>
    <script type="text/javascript" src="http://flxhr.flensed.com/code/build/flXHR.js"></script>


Documentation
-------------

Documentation generated from source file with `Pycco <http://fitzgen.github.com/pycco/>`_,  see it in repository ``docs`` folder.
