sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"../model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/routing/History",
	"sap/m/Dialog",
	"sap/m/DialogType",
	"sap/m/Button",
	"sap/m/ButtonType",
	"sap/m/MessageToast",
	"sap/ui/layout/HorizontalLayout",
	"sap/ui/layout/VerticalLayout",
	"sap/m/Text",
    "sap/m/TextArea",
	"sap/ui/core/Fragment",
	"sap/ui/core/syncStyleClass"
], function (BaseController, JSONModel, formatter, Filter, FilterOperator, History, Dialog, DialogType, Button, ButtonType, MessageToast,
	HorizontalLayout,
	VerticalLayout, Text, TextArea, Fragment, syncStyleClass) {
	"use strict";
	var oController;
	var vMaterial;
	return BaseController.extend("hb4.zhb4_mispedidos.controller.Componentes", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
            oController = this;
            var oView = this.getView();
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});
			this.getRouter().getRoute("componentes").attachPatternMatched(this._onObjectMatched, this);
			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.setModel(oViewModel, "objectView");
			this.getOwnerComponent().getModel().metadataLoaded().then(function () {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
            });
            oView.addEventDelegate({
				onAfterShow: function (oEvent) {
					oController.onRefresh();
				}
			}, oView);
		},

		action: function (e) {
			var oRouter = oController.getOwnerComponent().getRouter();
			oController.getView().unbindElement();
			var oHistory = History.getInstance(),
				sPreviousHash = oHistory.getPreviousHash();
			if (sPreviousHash !== undefined) {
				history.go(-1);
			} else {
				var bReplace = true;
				oRouter.navTo("Lotes", {}, bReplace);
			}
		},

        onRefresh: function (){
            var oModel = this.getView().getModel();
            oModel.refresh(true); 
        },

		onAgregar: function (oEvent) {
			oController.getRouter().navTo("agregarInsumo", {
				pedido: oController.pedido,
				posicion: oController.posicion,
				materialLote: oController.materialLote
			});
		},
		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function (oEvent) {
			var pedido = oEvent.getParameter("arguments").pedido;
			oController.pedido = pedido;
			var materialLote = oEvent.getParameter("arguments").materialLote;
			oController.materialLote = materialLote;
			var posicion = oEvent.getParameter("arguments").posicion;
            oController.posicion = posicion;
            this.onOpenBusyDialog();
			this.getModel().metadataLoaded().then(function () {
				var sObjectPath = this.getModel().createKey("lotesSet", {
					pedido: pedido,
					posicion: posicion,
					materialLote: materialLote
				});
                this._bindView("/" + sObjectPath);
			}.bind(this));

			this.obtenerComponentes(pedido, posicion, materialLote);

		},

        onOpenBusyDialog: function () {
			// load BusyDialog fragment asynchronously
			if (!this._pBusyDialog) {
				this._pBusyDialog = Fragment.load({
					name: "hb4.zhb4_mispedidos.view.BusyDialog",
					controller: this
				}).then(function (oBusyDialog) {
					this.getView().addDependent(oBusyDialog);
					syncStyleClass("sapUiSizeCompact", this.getView(), oBusyDialog);
					return oBusyDialog;
				}.bind(this));
			}

			this._pBusyDialog.then(function (oBusyDialog) {
				oBusyDialog.open();
				//this.simulateServerRequest();
			}.bind(this));
        },
        
		obtenerComponentes: function (pedido, posicion, materialLote) {
			var sPath = this.getModel().createKey("lotesSet", {
				pedido: pedido,
				posicion: posicion,
				materialLote: materialLote
			});
			sPath = "/" + sPath + "/componentesSet";
			this.getModel().read(sPath, {
				success: function (oData) {
					var oModelComponentes = new JSONModel();
					oModelComponentes.setData(oData.results);
                    oController.getView().byId("tableItems").setModel(oModelComponentes, "Componentes");
                    this._pBusyDialog.then(function (oBusyDialog) {
						oBusyDialog.close();
					});
				}.bind(this),
				error: function () {
                    this._pBusyDialog.then(function (oBusyDialog) {
						oBusyDialog.close();
					});
                    sap.m.MessageToast.show("Error al cargar Componentes");
				}.bind(this)
			});

			oController.obtenerEnmiendas();
		},

		obtenerEnmiendas: function () {
			var aFiltros = [];
            var Documento = oController.pedido + "&" + oController.posicion;
			aFiltros.push(new sap.ui.model.Filter("Documento", sap.ui.model.FilterOperator.EQ, Documento));
			this.getView().getModel().read("/enmiendaListadoSet", {
				filters: aFiltros,
				success: function (oData) {
					var oTableJSON = new sap.ui.model.json.JSONModel();
					var Anexos = {
						Datos: oData.results
					};
					oTableJSON.setData(Anexos);
					this.getView().byId("__tblEnmiendas").setModel(oTableJSON, "Anexos");
				}.bind(this)
			});
		},

		onObtenerAnexo: function (oEvent) {
			var oItem = oEvent.getSource().getParent();
			var oTabla = oEvent.getSource().getParent().getParent();
			var oDatos = oTabla.getModel("Anexos").getProperty(oItem.getBindingContextPath());
			var lv_path = "";
			if (oDatos.Extension === "HTM" || oDatos.Extension === "HTML") {
				lv_path = oDatos.Anexo;
				window.open(lv_path, "_system");
			} else if (oDatos.Extension === "TEXT") {
				if (!this.dialogNota) {
					this.dialogNota = sap.ui.xmlfragment("zppsegocreporte.Z_PP_SegOC_Report.view.Nota", this);
					var i18nModel = new sap.ui.model.resource.ResourceModel({
						bundleUrl: "i18n/i18n.properties"
					});
					this.dialogNota.setModel(i18nModel, "i18n");
				}
				sap.ui.getCore().byId("_iNotaAdj").setValue(oDatos.Anexo);
				this.dialogNota.open();
			} else {

				var oRootPath = jQuery.sap.getModulePath("hb4.zhb4_mispedidos");
				var sRead = oRootPath + "/sap/opu/odata/sap/ZOS_HB4_MODIFICACION_PEDIDO_SRV/enmiendaSet('" + oDatos.Anexo + "')/" + "$" + "value";
				var oView = this.getView();

				oView.byId("framePDF").setContent("<iframe title=\"Enmienda\" src=\"" + sRead +
					"\" width=\"92%\" height=\"600\" seamless></iframe>");

				//window.open(lv_path, "_blank");
				// $.get(lv_path, function (data) {
				// 	var a = document.createElement("a");
				// 	a.href = lv_path;
				// 	a.download = oDatos.NombreArchivo;
				// 	a.click();
				// });
			}
		},
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function (sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oDataModel.metadataLoaded().then(function () {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls '_bindView'
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oViewModel = this.getModel("objectView"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.nombre,
				sObjectName = oObject.variedad;

			oViewModel.setProperty("/busy", false);
			// Add the object page to the flp routing history
			this.addHistoryEntry({
				title: this.getResourceBundle().getText("objectTitle") + " - " + sObjectName,
				icon: "sap-icon://enter-more",
				intent: "#ModificaciondePedido-display&/lotesSet/" + sObjectId
			});

			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("saveAsTileTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		onAnular: function (oEvent) {
			vMaterial = oEvent.getSource().getParent().getParent().getCells()[1].getText().substring(0,18);
			if (!oController._DialogMotivoAnularInsumo) {
				oController._DialogMotivoAnularInsumo = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.AnularInsumo", oController);
				var i18nModel = new sap.ui.model.resource.ResourceModel({
					bundleUrl: "i18n/i18n.properties"
				});
				oController._DialogMotivoAnularInsumo.setModel(i18nModel, "i18n");
			}

			//sap.ui.getCore().byId("_iMotivoRechazo").setModel(oController.getView().getModel());
			sap.ui.getCore().byId("_iMotivoAnularInsumo").setValue(null);
			oController._DialogMotivoAnularInsumo.open();
		},

		onAnularInsumo: function () {
			if (sap.ui.getCore().byId("_iMotivoAnularInsumo").getValue()) {
				if (!this.oAnularDialogInsumo) {
					this.oAnularDialogInsumo = new Dialog({
						type: DialogType.Message,
						title: "Confirmación Anulación",
						content: new Text({
							text: "¿Confirma Solicitud de Anulación del Insumo?"
						}),
						beginButton: new Button({
							type: ButtonType.Emphasized,
							text: "Confirmar",
							press: function () {
								oController.onConfirmaAnularInsumo();
								this.oAnularDialogInsumo.close();
							}.bind(this)
						}),
						endButton: new Button({
							text: "Cancelar",
							press: function () {
								this.oAnularDialogInsumo.close();
							}.bind(this)
						})
					});
				}

				this.oAnularDialogInsumo.open();
			} else {
				MessageToast.show("Debe ingresar el motivo de solicitud de anulación");
			}

		},

		onConfirmaAnularInsumo: function () {
			var motivo = sap.ui.getCore().byId("_iMotivoAnularInsumo").getValue();
			var sPath = this.getView().getModel().createKey("/componentesSet", {
				pedido: oController.pedido,
				posicion: oController.posicion,
				materialLote: oController.materialLote,
				material: vMaterial
			});

			oController._DialogMotivoAnularInsumo.close();
			oController._DialogMotivoAnularInsumo.destroy();
			oController._DialogMotivoAnularInsumo = null;

			this.getView().setBusy(true);
			var oEntidad = {
				pedido: oController.pedido,
				posicion: oController.posicion,
				materialLote: oController.materialLote,
				material: vMaterial,
				cantidadActual: "",
				fechaEntrega: "",
				estado: "",
				esDisminuible: "",
				esBorrable: "",
				operacion: "B",
				motivo: motivo
			};

			this.getView().getModel().update(sPath, oEntidad, {
				success: function (resultado) {
					MessageToast.show("Solicitud de anulación enviada correctamente");
					this.getView().setBusy(false);
					this.obtenerComponentes(oController.pedido, oController.posicion, oController.materialLote);
				}.bind(this),
				error: function (error) {
					MessageToast.show("No se pudo enviar la solicitud");
					oController.getView().setBusy(false);
				}
			});
		},

		onCancelarAnularInsumo: function () {
			oController._DialogMotivoAnularInsumo.close();
			oController._DialogMotivoAnularInsumo.destroy();
			oController._DialogMotivoAnularInsumo = null;
		},

		onDisminuir: function (oEvent) {
			vMaterial = oEvent.getSource().getParent().getParent().getCells()[1].getText().substring(0,18);
			if (!oController._DialogoDisminuir) {
				oController._DialogDisminuir = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.Disminuir", oController);
				var i18nModel = new sap.ui.model.resource.ResourceModel({
					bundleUrl: "i18n/i18n.properties"
				});
				oController._DialogDisminuir.setModel(i18nModel, "i18n");
			}

			//sap.ui.getCore().byId("_iMotivoRechazo").setModel(oController.getView().getModel());
			sap.ui.getCore().byId("_iMotivoDisminuir").setValue(null);
			oController._DialogDisminuir.open();
		},

		onDisminuirInsumo: function () {
			if (sap.ui.getCore().byId("_iMotivoDisminuir").getValue()) {
				if (!this.oDisminuirDialogInsumo) {
					this.oDisminuirDialogInsumo = new Dialog({
						type: DialogType.Message,
						title: "Confirmación Disminuir Cantidad",
						content: new Text({
							text: "¿Confirma Solicitud para Disminuir la Cantidad del Insumo?"
						}),
						beginButton: new Button({
							type: ButtonType.Emphasized,
							text: "Confirmar",
							press: function () {
								oController.onConfirmaDisminuirInsumo();
								this.oDisminuirDialogInsumo.close();
							}.bind(this)
						}),
						endButton: new Button({
							text: "Cancelar",
							press: function () {
								this.oDisminuirDialogInsumo.close();
							}.bind(this)
						})
					});
				}

				this.oDisminuirDialogInsumo.open();
			} else {
				MessageToast.show("Debe ingresar el motivo de la solicitud");
			}

		},

		onConfirmaDisminuirInsumo: function () {
			var motivo = sap.ui.getCore().byId("_iMotivoDisminuir").getValue();
			var sPath = this.getView().getModel().createKey("/componentesSet", {
				pedido: oController.pedido,
				posicion: oController.posicion,
				materialLote: oController.materialLote,
				material: vMaterial
			});

			oController._DialogDisminuir.close();
			oController._DialogDisminuir.destroy();
			oController._DialogDisminuir = null;

			this.getView().setBusy(true);
			var oEntidad = {
				pedido: oController.pedido,
				posicion: oController.posicion,
				materialLote: oController.materialLote,
				material: vMaterial,
				cantidadActual: "",
				fechaEntrega: "",
				estado: "",
				esDisminuible: "",
				esBorrable: "",
				operacion: "D",
				motivo: motivo
			};

			this.getView().getModel().update(sPath, oEntidad, {
				success: function (resultado) {
					MessageToast.show("Solicitud enviada correctamente");
					this.getView().setBusy(false);
					this.obtenerComponentes(oController.pedido, oController.posicion, oController.materialLote);
				}.bind(this),
				error: function (error) {
					MessageToast.show("No se pudo enviar la solicitud");
					oController.getView().setBusy(false);
				}
			});
		},

		onCancelarDisminuirInsumo: function () {
			oController._DialogDisminuir.close();
			oController._DialogDisminuir.destroy();
			oController._DialogDisminuir = null;
		},

		onModificarFechaComponentes: function (oEvent) {

			if (!oController._DialogoModFechaInsumos) {
				oController._DialogoModFechaInsumos = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.EditarFEntregaInsumos", oController);
				var i18nModel = new sap.ui.model.resource.ResourceModel({
					bundleUrl: "i18n/i18n.properties"
				});
				oController._DialogoModFechaInsumos.setModel(i18nModel, "i18n");
			}
			this.obtenerEditablesFecha(oController.pedido, oController.posicion, oController.materialLote);
		},

		obtenerEditablesFecha: function (pedido, posicion, materialLote) {

			var sPath = this.getModel().createKey("lotesSet", {
				pedido: pedido,
				posicion: posicion,
				materialLote: materialLote
			});
			sPath = "/" + sPath + "/componentesFechaActualizableSet";

			this.getModel().read(sPath, {
				success: function (oData) {
                    var oJsonModel = new sap.ui.model.json.JSONModel();
                    if (oData.results["length"] > 0){
                        oJsonModel.setData(oData);
                        var today = new Date();
                        var vSetDate = new Date();
                        vSetDate.setDate(today.getDate()+7);
                        sap.ui.getCore().byId("_iReemplazoFechaEntregaInsumos").setMinDate(vSetDate);
					    sap.ui.getCore().byId("tableModificables").setModel(oJsonModel, "fechaEntrega");
                        oController._DialogoModFechaInsumos.open();
                    }else{
                        sap.m.MessageToast.show("No existen componentes en los que pueda editar la fecha de entrega");
                    }
				},
				error: function () {
					sap.m.MessageToast.show("Error al cargar Componentes");
				}
			});

		},

		onGrabarFechaEntregaInsumos: function () {
			if (sap.ui.getCore().byId("_iReemplazoFechaEntregaInsumos").getValue()) {
                if (this.validarFecha(sap.ui.getCore().byId("_iReemplazoFechaEntregaInsumos").getValue(), this.getView().byId("_fechaMaxima").getText())){
                    if (!this.oFechaEntregaInsumosDialog) {
                        this.oFechaEntregaInsumosDialog = new Dialog({
                            type: DialogType.Message,
                            title: "Confirmación cambio de Fecha",
                            content: new Text({
                                text: "¿Confirma cambio de Fecha de Entrega para los Insumos?"
                            }),
                            beginButton: new Button({
                                type: ButtonType.Emphasized,
                                text: "Confirmar",
                                press: function () {
                                    oController.onConfirmaFechaEntregaInsumos();
                                    this.oFechaEntregaInsumosDialog.close();
                                }.bind(this)
                            }),
                            endButton: new Button({
                                text: "Cancelar",
                                press: function () {
                                    this.oFechaEntregaInsumosDialog.close();
                                }.bind(this)
                            })
                        });
                    }

                    this.oFechaEntregaInsumosDialog.open();
                }else{
                    var mensaje = "Ingrese una Fecha menor a la Fecha de Cosecha " + this.getView().byId("_fechaMaxima").getText();
                    MessageToast.show(mensaje);
                }
            } else {
                MessageToast.show("Ingrese nueva Fecha de Entrega");
            }
		},

        validarFecha: function(fechaIngresada, fechaMaxima){

            var dateMaximo = new Date(fechaMaxima.substring(6,10),fechaMaxima.substring(3,5)-1,fechaMaxima.substring(0,2));
            var datos = fechaIngresada.split("/");
            var dia = datos[0];
            if (dia < 10){
                dia = "0" + dia.toString();
            }
            var mes = datos[1];
            if (mes < 10){
                mes = "0" + mes.toString();
            }
            var anio = datos[2];
            anio = "20" + anio.toString();
            var dateIngresada = new Date(anio,mes-1,dia);;

            if  (dateMaximo < dateIngresada){
                return false;
            }else{
                return true;
            }

        },

		onConfirmaFechaEntregaInsumos: function () {
			var fechaEntrega = sap.ui.getCore().byId("_iReemplazoFechaEntregaInsumos").getValue();
			var sPath = this.getView().getModel().createKey("/componentesSet", {
				pedido: oController.pedido,
				posicion: oController.posicion,
				materialLote: oController.materialLote,
				material: "1"
			});

			oController._DialogoModFechaInsumos.close();
			oController._DialogoModFechaInsumos.destroy();
			oController._DialogoModFechaInsumos = null;

			this.getView().setBusy(true);
			var oEntidad = {
				pedido: oController.pedido,
				posicion: oController.posicion,
				materialLote: oController.materialLote,
				material: vMaterial,
				cantidadActual: "",
				fechaEntrega: fechaEntrega,
				estado: "",
				esDisminuible: "",
				esBorrable: "",
				operacion: "F",
				motivo: ""
			};

			this.getView().getModel().update(sPath, oEntidad, {
				success: function (resultado) {
					MessageToast.show("Modificacion realizada correctamente");
					this.getView().setBusy(false);
					this.obtenerComponentes(oController.pedido, oController.posicion, oController.materialLote);
				}.bind(this),
				error: function (error) {
					MessageToast.show("No se pudo enviar la solicitud");
					oController.getView().setBusy(false);
				}
			});
		},

		onCancelarFechaEntregaInsumos: function () {
			oController._DialogoModFechaInsumos.close();
			oController._DialogoModFechaInsumos.destroy();
			oController._DialogoModFechaInsumos = null;
		}

	});

});