//
// Declare namespace
Jschat = {};

//
//Models
//=======
// This is tool from [JavascriptMVC](http://javascriptmvc.com/) framework.
// It used to create binded to `this` callbacks, when _.bind() can not do this.
Jschat.JsmvcCallback = {
	callback: function( funcs ) {
		var makeArray = $.makeArray,
		isFunction = $.isFunction,
		isArray = $.isArray,
		extend = $.extend,
		concatArgs = function(arr, args){
			return arr.concat(makeArray(args));
		};
		
		// args that should be curried
		var args = makeArray(arguments),
		self;
		
		funcs = args.shift();
		
		if (!$.isArray(funcs) ) {
			funcs = [funcs];
		}
		
		self = this;
		for( var i =0; i< funcs.length;i++ ) {
			if(typeof funcs[i] == "string" && !isFunction(this[funcs[i]])){
				throw ("class.js  does not have a "+funcs[i]+" method!");
			}
		}
		return function class_cb() {
			var cur = concatArgs(args, arguments),
			isString, 
			length = funcs.length,
			f = 0,
			func;
			
			for (; f < length; f++ ) {
				func = funcs[f];
				if (!func ) {
					continue;
				}
				
				isString = typeof func == "string";
				if ( isString && self._set_called ) {
					self.called = func;
				}
				cur = (isString ? self[func] : func).apply(self, cur || []);
				if ( f < length - 1 ) {
					cur = !isArray(cur) || cur._use_call ? [cur] : cur;
				}
			}
			return cur;
		};
	}
};

//Contact model
//--------------
//Presence updated with `updatePrecense`. While updating,
//program selects best status from `Jschat.Contact.Statuses`
Jschat.Contact = Backbone.Model.extend({
	updatePrecense: function(presence){
		var status;
		if ($(presence).attr('type')) {
			status =  $(presence).attr('type');
		} else {
			if ($(presence).find('show').length) {
				status = $(presence).find('show').text();
			} else {
				status = 'available';
			}
		}
		if (_.indexOf(Jschat.Contact.Statuses, status) > _.indexOf(Jschat.Contact.Statuses, this.status)) {
			this.set({status: status});
		}
	}
});
Jschat.Contact.Statuses = ['unavailable', 'xa', 'dnd', 'away', 'available', 'chat'];

//Roster model
//-------------
//
//It has special method to hold information about 
//started conversation, current manager and so on.

Jschat.Roster = Backbone.Collection.extend({
	initialize: function(){
//		While conversation started, program should keep messaging only with 
//		selected manager
		this._freezeManager = false;
		this.manager = null;
		this.bind('change:status', function(contact, new_status){
			this.updateManager();
		});
		this.bind('add', function(){
			this.updateManager();
		});
//		all of the object's function properties will be bound to ``this``.
		_.bindAll(this); 
	},
//	public method
	freezeManager: function(){
		this._freezeManager = true;
	},
	updateManager: function(){
		if (!this._freezeManager) {
			this.manager = this.reduce(function(old_val, new_val){
				// First available:
				if (old_val === null){
					return new_val;
				}
				var new_status = _.indexOf(Jschat.Contact.Statuses, new_val.get('status')),
				old_status = _.indexOf(Jschat.Contact.Statuses, old_val.get('status'));
				
				if (new_status >= old_status){
					return new_val;
				} else {
					return old_val;
				}
			}, this.manager);
		}
	},
	model: Jschat.Contact
});

//Static method to create rosters from XMPP stanzas
Jschat.Roster.serializeRoster = function(roster){
	res = [];
	$(roster).find('item').each(function(index, el){
		if ($(el).attr('subscription') === 'both'){
			res.push({
				jid: $(el).attr('jid'),
				bare_jid: Strophe.getBareJidFromJid($(el).attr('jid')),
				name: $(el).attr('name'),
				status: 'unavailable'
			});
		};
	});
	return res;
};

//Message model
//--------------
//
//Message can automatically detect direction by calling
//`message.incoming()`

Jschat.Message = Backbone.Model.extend({
	incoming: function(){
		var to = Strophe.getBareJidFromJid(this.to),
		myjid = Strophe.getBareJidFromJid(this.myjid);
		if (myjid === to) {
			return true;
		} else {
			return false;
		}
	},
	send: function(connection){
		connection.send($msg({
			to: this.get('to'),
			"type": 'chat'
		}).c('body').t(this.get('text')));
		return this;
	}
});

Jschat.ChatLog = Backbone.Collection.extend({
	model: Jschat.Message
});

//
//Views
//=====
//
//Template for chat history
Jschat.message_template = Handlebars.compile('<div class="message {{#incoming }}in{{/incoming}}{{^incoming }}out{{/incoming}}">'+
		'<div class="nick">{{#incoming }}{{ from }}{{/incoming}}{{^incoming }}You:{{/incoming}}</div>'+
		'<div class="text">{{ text }}</div></div>');
//Template for welcome message
Jschat.welcome_template = Handlebars.compile('Name: {{ name }}, Email: {{ email }}');
	Jschat.viewstates = {
		offline: 0,
		connecting: 1,
		online: 2
	};

//Chat view
//----------
//
//Main view in module. It handles everything user action in chat:
//Opening chat, sending messages, closing chat
Jschat.ChatView = Backbone.View.extend({
	initialize: function(){
		this.status = Jschat.viewstates.offline; // Default status
		this.send_on_enter = true;
		this.msgValid = false; // Require both filled Name and text before send message
		
		this.bind('change:status', this.onStatusChange);
		this.bind('change:msgValid', this.onMsgValidChange);
		this.trigger('change:status');
		this.bind('add:message', this.onMessageAdd);
		
		_.bindAll(this);
	},
	render: function(){
		this.el.show('200');
	},
	events: {
		'click #id_close': 'destroy',
		'focusin input,textarea': 'focusin',
		'focusout input,textarea': 'focusout',
		'change input,textarea': 'onFormChange',
		'keyup input,textarea': 'onFormChange',
		'keyup textarea': 'onKeyUp',
		'click #id_send': 'sendMsg'
	},
	destroy: function(){
		this.el.hide('200');
	},
	focusin: function(ev){
		$('label[for=' + $(ev.target).attr('id') + ']').hide();
	},
	focusout: function(ev){
		if ($(ev.target).val() === '') {
			$('label[for=' + $(ev.target).attr('id') + ']').show();
		}
	},
	onFormChange: function(){
		if ((this.el.find('#id_full_name').val().length > 0)
				&& (this.el.find('#id_text').val().length > 0)) {
			this.msgValid = true;
			this.trigger('change:msgValid');
		} else {
			this.msgValid = false;
			this.trigger('change:msgValid');
		}
	},
	onKeyUp: function(ev){
		if((ev.keyCode == 13) && (this.send_on_enter)){
			this.sendMsg(ev);
		}
	},
	getUserinfo: function(){
		return {
			'name': this.el.find('#id_full_name').val(),
			'email': this.el.find('#id_email').val()
		};
	},
	setStatus: function(new_status){
		switch(new_status){
		case Jschat.viewstates.offline:
			this.status = Jschat.viewstates.offline;
			break;
		case Jschat.viewstates.connecting:
			this.status = Jschat.viewstates.connecting;
			break;
		case Jschat.viewstates.online:
			this.status = Jschat.viewstates.online;
			break;
		}
		this.trigger('change:status');
	},
	sendMsg: function(ev){
		ev.preventDefault();
		// check if form is valid
		if (this.status === Jschat.viewstates.online && this.msgValid) {
			this.trigger('send:message', this.el.find('textarea').val());
			this.clear();
		}
		return true;
	},
	clear: function(){
		this.el.find('textarea').val('');
	},
	onStatusChange: function(){
		switch(this.status){
		case Jschat.viewstates.online:
			if (this.msgValid) {
				this.el.find('#id_send').removeAttr('disabled').removeClass('disabled');
			}
			break;
		case Jschat.viewstates.offline:
			this.el.find('#id_send').attr('disabled', 'disabled').addClass('disabled');
			break;
		}			
	},
	onMsgValidChange: function(){
		if (this.msgValid) {
			if(this.status === Jschat.viewstates.online) {
				this.el.find('#id_send').removeAttr('disabled').removeClass('disabled');
			}
		} else {
			this.el.find('#id_send').attr('disabled', 'disabled').addClass('disabled');
		}
	},
	onMessageAdd: function(message, chatlog, ev) {
		if (this.el.find('#online-messages').is(':hidden')) {
			this.el.find('#online-messages').show(200);
		}
		var chat =  this.el.find('#online-message-list');
		chat.append(Jschat.message_template(message.toJSON()));
		chat.scrollTop(chat[0].scrollHeight);
	}
});

//
//Main class
//==========
//
Jschat.Xmpp = function(options) {
	if (!options) options = {}; 
    if (this.defaults) options = _.extend(this.defaults, options);
    this.options = options;
    this.initialize();
};


//Xmpp class implementation
//-------------------------
 
_.extend(Jschat.Xmpp.prototype, Jschat.JsmvcCallback, Backbone.Events, {
//	Default options can be overriden in constructor:
//	
//	`chat = new Jschat.Xmpp({'jid': 'me@jabber.org})`
	defaults: {
		jid: 'jschat-demo@jabber.org',
		password: 'password',
		bosh_service: 'http://bosh.metajack.im:5280/xmpp-httpbind',
		view_el_id: 'online-block'
	},
	initialize: function(){
		this.connection = new Strophe.Connection(this.options.bosh_service);
		this.roster = new Jschat.Roster();
		this.chatlog = new Jschat.ChatLog();
		this.view = new Jschat.ChatView({
			el: $('#'+this.options.view_el_id)
		});
		this._welcomeSent = false;
//	    this.connection.rawInput = function (data) { console.log('RECV: ' + data); };
//	    this.connection.rawOutput = function (data) { console.log('SEND: ' + data); };
//		listen events
		this.bind('connected', this.onConnect);
		if (this.options.autoConnect){
			this.connect();
		}
		this.chatlog.bind('add', this.callback('onMessageAdd'));
		this.view.bind('send:message', this.callback('sendMessage'));
	},
	connect: function(){
		this.connection.connect(this.options.jid, this.options.password, this.callback('onConnectChange'));
		this.trigger('ui:connect');
	},
	onConnectChange: function(status_code, error){
		for (st in Strophe.Status) {
			if (status_code === Strophe.Status[st]) {
				console.log('status: ' + st);
			}
		}
		if (status_code === Strophe.Status.CONNECTED) {
			this.trigger('connected');
		}
	},
	onConnect: function(){
		// request roster
		var roster_iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
		this.connection.sendIQ(roster_iq, this.callback('onRoster'));
		this.trigger('ui:roster');
		// add handlers
		this.connection.addHandler(this.callback('onContactPresence'), null, 'presence');
		this.connection.addHandler(this.callback('onMessage'), null, 'message', 'chat');
	},
	onRoster: function(roster){
		this.connection.send($pres());
		this.trigger('ui:ready');
		this.view.setStatus(Jschat.viewstates.online);
		
		var items = Jschat.Roster.serializeRoster(roster);
		
		for (var i=0; i<items.length; i++) {
			this.roster.add(items[i]);
		}
		return true;
	},
	onContactPresence: function(presence){
		var from = Strophe.getBareJidFromJid($(presence).attr('from')),
			contact = this.roster.detect(function(c){return c.get('bare_jid') === from;});
		if (contact) {
			contact.updatePrecense(presence);
		}
        if(this.options.autoChat){
        	_.delay(function(self){
        		self.sendWelcome();
        	}, '2000', this);
        }
		return true;
	},
//	Public method, use it directly if you set `{autoChat: false}`
	sendWelcome: function(){
    	if (!this._welcomeSent) {
    		var userinfo = this.getUserinfo();
    		this.roster.freezeManager();
    		this._welcomeSent = true;
    		this.sendMessage({
    			text: userinfo,
    			from: this.options.jid,
    			to: this.roster.manager.get('jid'),
    			hidden: true,
    			dt: new Date()
    		});
    	}
	},
//	`sendMessage` used for send all messages 
	sendMessage: function(message){
		if (!this._welcomeSent){
			this.sendWelcome();
		}
		if (typeof(message) === 'string'){
			var msg = new Jschat.Message({
				text: message,
				from: this.options.jid,
				to: this.roster.manager.get('jid'),
				incoming: false,
				dt: new Date()
			});
		} else {
			var msg = new Jschat.Message(message);
		}
		msg.send(this.connection);
		if (!msg.get('hidden')){
			this.chatlog.add(msg);
		} 
	},
//	Prepare and render userinfo
	getUserinfo: function(){
		return Jschat.welcome_template(this.view.getUserinfo());
	},
//	Handler for incoming messages
	onMessage: function(message){
		var msg = new Jschat.Message({
			text: $(message).find('body').text(),
			from: $(message).attr('from'),
			to: $(message).attr('to'),
			incoming: true,
			dt: new Date()
		});
		this.chatlog.add(msg);
		return true;
	},
//	Only trigger view event
	onMessageAdd: function(message){
		this.view.trigger('add:message', message);
	}
});