/*global QUnit*/

sap.ui.define([
	"hb4/zhb4_mispedidos/controller/Lotes.controller"
], function (Controller) {
	"use strict";

	QUnit.module("Lotes Controller");

	QUnit.test("I should test the Lotes controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
