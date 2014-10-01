define(function(require){
	var $ = require('jquery'),
		_ = require('underscore'),
		monster = require('monster'),
		toastr = require('toastr');

	var app = {
		name: 'demo',

		i18n: [ 'en-US' ],//, 'fr-FR' ],

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		load: function(callback){
			var self = this;

			self.initApp(function() {
				callback && callback(self);
			});
		},

		// Method used by the Monster-UI Framework, shouldn't be touched unless you're doing some advanced kind of stuff!
		initApp: function(callback) {
			var self = this;

			// Used to init the auth token and account id of this app
			monster.pub('auth.initApp', {
				app: self,
				callback: callback
			});
		},

		// Entry Point of the app
		render: function(container){
			var self = this,
				container = container || $('#ws-content');

			// Get the initial dynamic data we need before displaying the app
			self.getRenderData(function(data) {
				// Load the data in a Handlebars template
				var demoTemplate = $(monster.template(self, 'layout', data));

				// Bind UI and Socket events
				self.bindUIEvents(demoTemplate);
				self.bindSocketsEvents(demoTemplate, data);

				// Once everything has been attached to the template, we can add it to our main container
				(container)
					.empty()
					.append(demoTemplate);
			});
		},

		// Binding Events
		bindUIEvents: function(template) {
			var self = this;

			template.find('#clearEvents').on('click', function() {
				template.find('.table tbody tr:not(.no-events)').remove();
			});

			template.find('.device-item').on('click', function() {
				var isInactive = !$(this).hasClass('active');
				template.find('.device-item').removeClass('active');

				template.find('table tbody tr').removeClass('inactive');

				if(isInactive) {
					var	id = $(this).data('id');

					if(id !== '') {
						$(this).addClass('active');
						template.find('table tbody tr:not([data-deviceid="' + id + '"])').addClass('inactive');
					}
				}
			});
		},

		bindSocketsEvents: function(template, globalData) {
			var self = this,
				addEvent = function(data) {
					console.log(data);
					var formattedEvent = self.formatEvent(data),
						eventTemplate = monster.template(self, 'event', formattedEvent);

					if(formattedEvent.extra.deviceId && formattedEvent.extra.deviceId in globalData.registeredDevices) {
						monster.ui.fade(template.find('.device-item[data-id="'+ formattedEvent.extra.deviceId +'"]'));
					}

					template.find('.list-events tbody').prepend(eventTemplate);
				};

			// subscribe to call events
			monster.socket.emit("subscribe", { account_id: self.accountId, auth_token: self.authToken, binding: "call.CHANNEL_CREATE.*"});
			monster.socket.emit("subscribe", { account_id: self.accountId, auth_token: self.authToken, binding: "call.CHANNEL_ANSWER.*"});
			monster.socket.emit("subscribe", { account_id: self.accountId, auth_token: self.authToken, binding: "call.CHANNEL_DESTROY.*"});

			// Bind some js code to the reception of call events
			monster.socket.on("CHANNEL_CREATE", function (data) {
				addEvent(data);
			});

			monster.socket.on("CHANNEL_ANSWER", function (data) {
				addEvent(data);
			});

			monster.socket.on("CHANNEL_DESTROY", function (data) {
				addEvent(data);
			});
		},

		// Formatting data
		formatEvent: function(data) {
			var self = this,
				formattedData = data;

			formattedData.extra = {};

			formattedData.extra.to = data['To'].substr(0, data['To'].indexOf('@'));
			formattedData.extra.friendlyEvent = self.i18n.active().demo.events[data['Event-Name']];
			formattedData.extra.classEvent = data['Event-Name'] === 'CHANNEL_CREATE' ? 'info' : (data['Event-Name'] === 'CHANNEL_ANSWER' ? 'success' : 'error');

			if('Custom-Channel-Vars' in data && 'Authorizing-Type' in data['Custom-Channel-Vars'] && data['Custom-Channel-Vars']['Authorizing-Type'] === 'device') {
				formattedData.extra.deviceId = data['Custom-Channel-Vars']['Authorizing-ID'];
			}

			return formattedData;
		},

		formatRenderData: function(data) {
			var self = this,
				formattedData = {
					registeredDevices: {}
				};

			_.each(data.devices, function(device) {
				_.each(data.deviceStatus, function(deviceStatus) {
					if(deviceStatus.device_id === device.id) {
						formattedData.registeredDevices[device.id] = device;
					}
				})
			});

			return formattedData;
		},

		// Utils
		getRenderData: function(globalCallback) {
			var self = this;

			//globalCallback({});
			monster.parallel({
					deviceStatus: function(callback) {
						self.getDevicesStatus(function(data) {
							callback(null, data);
						});
					},
					devices: function(callback) {
						self.listDevices(function(data) {
							callback(null, data);
						});
					}
				},
				function(err, results) {
					var formattedData = self.formatRenderData(results);

					globalCallback && globalCallback(formattedData);
				}
			);
		},

		// API Calls
		getDevicesStatus: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.getStatus',
				data: {
					accountId: self.accountId
				},
				success: function(devices) {
					callback(devices.data);
				}
			});
		},

		listDevices: function(callback) {
			var self = this;

			self.callApi({
				resource: 'device.list',
				data: {
					accountId: self.accountId
				},
				success: function(devices) {
					callback(devices.data);
				}
			});
		}
	};

	return app;
});