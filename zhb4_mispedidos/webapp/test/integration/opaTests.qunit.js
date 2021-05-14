/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"hb4/zhb4_mispedidos/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});
