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
            this._cargarModelos();

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

        onRefresh: function () {
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
            this._traerPulver(pedido, posicion);
            this._traerFert(pedido, posicion);
            this._traerLluvias(pedido, posicion);
            this._cargarFertilizantes();
            this._cargarStewardship(pedido, posicion);
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
					this.dialogNota = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.Nota", this);
				}
				sap.ui.getCore().byId("_iNotaAdj").setValue(oDatos.Anexo);
				this.dialogNota.open();
            } else {
                var oRootPath = jQuery.sap.getModulePath("hb4.zhb4_mispedidos");
                var sRead = oRootPath + "/sap/opu/odata/sap/ZOS_HB4_MODIFICACION_PEDIDO_SRV/enmiendaSet('" + oDatos.Anexo + "')/" + "$" + "value";
                var oView = this.getView();

                oView.byId("framePDF").setContent("<iframe title=\"Enmienda\" src=\"" + sRead +
                    "\" width=\"92%\" height=\"600\" seamless></iframe>");
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
            this._traerFenolog(oObject.pedido, oObject.posicion);
        },

        onAnular: function (oEvent) {
            vMaterial = oEvent.getSource().getParent().getParent().getCells()[1].getText().substring(0, 18);
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
            vMaterial = oEvent.getSource().getParent().getParent().getCells()[1].getText().substring(0, 18);
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
                    if (oData.results["length"] > 0) {
                        oJsonModel.setData(oData);
                        var today = new Date();
                        var vSetDate = new Date();
                        vSetDate.setDate(today.getDate() + 7);
                        sap.ui.getCore().byId("_iReemplazoFechaEntregaInsumos").setMinDate(vSetDate);
                        sap.ui.getCore().byId("tableModificables").setModel(oJsonModel, "fechaEntrega");
                        oController._DialogoModFechaInsumos.open();
                    } else {
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
                if (this.validarFecha(sap.ui.getCore().byId("_iReemplazoFechaEntregaInsumos").getValue(), this.getView().byId("_fechaMaxima").getText())) {
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
                } else {
                    var mensaje = "Ingrese una Fecha menor a la Fecha de Cosecha " + this.getView().byId("_fechaMaxima").getText();
                    MessageToast.show(mensaje);
                }
            } else {
                MessageToast.show("Ingrese nueva Fecha de Entrega");
            }
        },

        validarFecha: function (fechaIngresada, fechaMaxima) {

            var dateMaximo = new Date(fechaMaxima.substring(6, 10), fechaMaxima.substring(3, 5) - 1, fechaMaxima.substring(0, 2));
            var datos = fechaIngresada.split("/");
            var dia = datos[0];
            if (dia < 10) {
                dia = "0" + dia.toString();
            }
            var mes = datos[1];
            if (mes < 10) {
                mes = "0" + mes.toString();
            }
            var anio = datos[2];
            anio = "20" + anio.toString();
            var dateIngresada = new Date(anio, mes - 1, dia);;

            if (dateMaximo < dateIngresada) {
                return false;
            } else {
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
        },

        // -------------------LABORES -----------------------------------------------------

        //PULVERIZACIONES

        onEditarPulv: function (oEvent) {
            var oPulv = oEvent.getSource().getBindingContext("modelPulverizaciones").getObject();

            //abro el fragment
            if (!this._oDialogPulv) {
                var oView = this.getView();
                this._oDialogPulv = sap.ui.xmlfragment(oView.getId(), "hb4.zhb4_mispedidos.view.EditPulv", this);
                this.getView().addDependent(this._oDialogPulv);
            }
            this._oDialogPulv.open();
            this.getView().byId("dialogPulv").setBusy(true);
            this._cargarModeloPulv(oPulv).then(function (oPulverizacion) {
                var oModelAddPulv = new JSONModel();
                oModelAddPulv.setData(oPulverizacion);
                oController.setModel(oModelAddPulv, "modelAddPulv");
                oController.getView().byId("dialogPulv").setBusy(false);
            });
        },

        onCancelarPulv: function () {
            this._oDialogPulv.close();
        },

        onVhProdPulv: function (oEvent) {
            //abro el fragment 
            if (!this._oVHProdPulv) {
                var oView = this.getView();
                this._oVHProdPulv = sap.ui.xmlfragment(oView.getId(), "hb4.zhb4_mispedidos.view.vhProdPulv", this);
                this.getView().addDependent(this._oVHProdPulv);
            }
            var oData = oEvent.getSource().getBindingContext("modelAddPulv").getObject();
            this._prodPulv = oData;
            if(!oData.variedad){
                MessageToast.show("Debe seleccionar un tipo para poder elegir un producto");
            } else {
                this._oVHProdPulv.open();
                var oView = oController.getView();
                oView.byId("dialogProdPulv").setBusy(true);
                this._traerProductos(oData.variedad).then(function () {
                    var sProd = oData.producto;
                    if (sProd) {
                        //selecciono el item en la tabla de productos
                        var oItem = oController._obtenerItemASeleccionar(sProd);
                        if (oItem) {
                            oController.getView().byId("idTablaProdPulv").setSelectedItem(oItem);
                        } else {
                            oController.getView().byId("idTablaProdPulv").removeSelections();
                        }
                    } else {
                        oController.getView().byId("idTablaProdPulv").removeSelections();
                    }
                    oView.byId("dialogProdPulv").setBusy(false);
                });
            }
        },

        handleVHProdPulv: function (oEvent) {
            //metodo para cargar el valor seleccionado en el value help de productos pulverización
            var dato = oController.getView().getModel("modelProdsPulv").getProperty(oEvent.getSource().getSelectedItem().getBindingContextPath()); //obtengo el dato que selecciono
            this._prodPulv.producto = dato.Producto;
            this._prodPulv.marca = dato.MarcaComercial;
            this._prodPulv.dosis = "";
            this._prodPulv.unidad = "";
            this.getModel("modelAddPulv").refresh();
            this._oVHProdPulv.close();
        },

        onCancelarVHProdPulv: function (oEvent) {
            //metodo cerrar value help
            this._oVHProdPulv.close();
        },

        onGuardarPulv: function () {
            //metodo guardar pulverización

            var oPulv = this.getModel("modelAddPulv").getData();

            var oNuevaPulv = {};
            var oView = this.getView();

            // si se ingresaron todos los datos continuo
            oView.byId("dialogPulv").setBusyIndicatorDelay(0);
            oView.byId("dialogPulv").setBusy(true);

            oNuevaPulv.Pedido = oPulv.pedido;
            oNuevaPulv.Posicion = oPulv.posicion;
            oNuevaPulv.NroPulv = oPulv.nropulv;
            if (!this._formatearFechaAString(oView.byId("_fechaPulv").getDateValue())) {
                MessageToast.show("Ingrese una fecha antes de guardar la Pulverización");
                this.getView().byId("dialogPulv").setBusy(false);
                return;
            }
            oNuevaPulv.Fecha = this._formatearFechaAString(oView.byId("_fechaPulv").getDateValue());
            oNuevaPulv.Superficie = oPulv.superficie;
            oNuevaPulv.Observaciones = oPulv.observaciones;

            //productos
            var aProductos = [], oProd = "";
            for (var i = 0; i < oPulv.productos.length; i++) {
                oProd = {}
                oProd.Tipo = oPulv.productos[i].variedad;
                oProd.Producto = oPulv.productos[i].producto;
                oProd.Dosis = oPulv.productos[i].dosis;
                oProd.Unidad = oPulv.productos[i].unidad;
                if (oProd.Tipo && oProd.Producto && oProd.Dosis && oProd.Unidad) {
                    aProductos.push(oProd);
                }
            }
            if (aProductos.length <= 0) {
                MessageToast.show("Ingrese al menos un producto completo antes de guardar la Pulverización");
                this.getView().byId("dialogPulv").setBusy(false);
                return;
            }
            oNuevaPulv.ProductosPulvSet = aProductos;
            this._editarPulv(oNuevaPulv);

        },

        onFiltrarProdPulv: function (oEvent) {
            //metodo de filtro
            var query = oEvent.getSource().getValue();
            var datos = oController.getView().byId("idTablaProdPulv").getBinding("items");;

            var filtro = null;

            //aplico el filtro
            if (query) {
                filtro = new Filter([
                    new Filter("MarcaComercial", FilterOperator.Contains, query),
                    new Filter("PrincipioAct1", FilterOperator.Contains, query),
                    new Filter("PrincipioAct2", FilterOperator.Contains, query),
                ], false);
            }
            datos.filter(filtro, "Application");
        },

        onAgregarProd: function (oEvent) {
            var aProductos = this.getModel("modelAddPulv").getProperty("/productos");
            var oProd = {
                id: (aProductos.length + 1),
                variedad: "",
                producto: "",
                marca: "",
                dosis: "",
                unidad: "",
                mostrarAgregar: false,
                mostrarBorrar: true
            };
            aProductos[aProductos.length - 1].mostrarAgregar = false;
            aProductos.push(oProd);
            this.getModel("modelAddPulv").setProperty("/productos", aProductos);
        },

        onBorrarProd: function (oEvent) {
            var oObject = oEvent.getSource().getBindingContext("modelAddPulv").getObject();
            var aProductos = this.getModel("modelAddPulv").getProperty("/productos");
            if (aProductos.length > 1) {
                aProductos.splice((oObject.id - 1), 1);
                if (this._validarProdPulv(aProductos[aProductos.length - 1])) {
                    aProductos[aProductos.length - 1].mostrarAgregar = true;
                } else {
                    aProductos[aProductos.length - 1].mostrarAgregar = false;
                }
                this.getModel("modelAddPulv").setProperty("/productos", aProductos);
                this._acomodarIdsPulv();
            } else {
                MessageToast.show("Debe ingresar al menos un producto para guardar la pulverización");
            }
            this.getModel("modelAddPulv").refresh();
        },

        onChangeVariedad: function (oEvent) {
            var oObject = oEvent.getSource().getBindingContext("modelAddPulv").getObject();
            oObject.producto = "";
            oObject.marca = "";
            oObject.dosis = "";
            oObject.unidad = "";
            this.getModel("modelAddPulv").refresh();
            this.onValidarAgregarPulv(oEvent);
        },

        onValidarAgregarPulv: function (oEvent) {
            var oObject = oEvent.getSource().getBindingContext("modelAddPulv").getObject();
            var aProductos = this.getModel("modelAddPulv").getProperty("/productos");
            if (aProductos[aProductos.length - 1].id === oObject.id) {
                if (this._validarProdPulv(oObject)) {
                    oObject.mostrarAgregar = true;
                } else {
                    oObject.mostrarAgregar = false;
                }
                this.getModel("modelAddPulv").refresh();
            }
        },

        onVerProdsPulv: function (oEvent) {
            var oObject = oEvent.getSource().getBindingContext("modelPulverizaciones").getObject();
            //abro el fragment
            if (!this._oDialogProductosPulv) {
                var oView = this.getView();
                this._oDialogProductosPulv = sap.ui.xmlfragment(oView.getId(), "hb4.zhb4_mispedidos.view.ProductosPulv", this);
                this.getView().addDependent(this._oDialogProductosPulv);
                this._oDialogProductosPulv.open();
            }

            this._oDialogProductosPulv.open();
            this.getView().byId("dialogProductosPulv").setBusy(true);
            this._cargarProductosPulv(oObject).then(function (aProductos) {
                var oModelProductosPulv = new JSONModel();
                oModelProductosPulv.setData(aProductos);
                oController.setModel(oModelProductosPulv, "modelProductosPulv");
                oController.getView().byId("dialogProductosPulv").setBusy(false);
            });
        },

        onCancelarProductosPulv: function () {
            this._oDialogProductosPulv.close();
        },

        //FERTILIZACIONES

        onEditarFert: function (oEvent) {
            var oFert = oEvent.getSource().getBindingContext("modelFertilizaciones").getObject();

            //abro el fragment
            if (!this._oDialogFert) {
                var oView = this.getView();
                this._oDialogFert = sap.ui.xmlfragment(oView.getId(), "hb4.zhb4_mispedidos.view.EditFert", this);
                this.getView().addDependent(this._oDialogFert);
                this._oDialogFert.open();
            }

            this._oDialogFert.open();
            this.getView().byId("dialogFert").setBusy(true);
            this._cargarModeloFert(oFert).then(function (oFertilizacion) {
                var oModelAddFert = new JSONModel();
                oModelAddFert.setData(oFertilizacion);
                oController.setModel(oModelAddFert, "modelAddFert");
                oController.getView().byId("dialogFert").setBusy(false);
            });
        },

        onCancelarFert: function () {
            this._oDialogFert.close();
        },

        onVhProdFert: function (oEvent) {
            //abro el fragment 
            if (!this._oVHProdFert) {
                var oView = this.getView();
                this._oVHProdFert = sap.ui.xmlfragment(oView.getId(), "hb4.zhb4_mispedidos.view.vhProdFert", this);
                this.getView().addDependent(this._oVHProdFert);
            }
            var oData = oEvent.getSource().getBindingContext("modelAddFert").getObject();
            this._prodFert = oData;
            this._oVHProdFert.open();
            var aDatos = oController.getModel("modelProdsFert").getData();
            if(aDatos.length > 0){
                var sProd = oData.producto;
                if (sProd) {
                    //selecciono el item en la tabla de productos
                    var oItem = oController._obtenerItemASeleccionarFert(sProd);
                    if (oItem) {
                        oController.getView().byId("idTablaProdFert").setSelectedItem(oItem);
                    } else {
                        oController.getView().byId("idTablaProdFert").removeSelections();
                    }
                } else {
                    oController.getView().byId("idTablaProdFert").removeSelections();
                }
            }
            // var oView = oController.getView();
            // oView.byId("dialogProdFert").setBusy(true);
            // this._traerProductosFert(oData.estado).then(function () {
            //     var sProd = oData.producto;
            //     if (sProd) {
            //         //selecciono el item en la tabla de productos
            //         var oItem = oController._obtenerItemASeleccionarFert(sProd);
            //         if (oItem) {
            //             oController.getView().byId("idTablaProdFert").setSelectedItem(oItem);
            //         } else {
            //             oController.getView().byId("idTablaProdFert").removeSelections();
            //         }
            //     } else {
            //         oController.getView().byId("idTablaProdFert").removeSelections();
            //     }
            //     oView.byId("dialogProdFert").setBusy(false);
            // });
        },

        _cargarFertilizantes: function(){
            //cargo el fragment de fertilizantes
            var oView = this.getView();
            if (!this._oVHProdFert) {
                this._oVHProdFert = sap.ui.xmlfragment(oView.getId(), "hb4.zhb4_mispedidos.view.vhProdFert", this);
                this.getView().addDependent(this._oVHProdFert);
            }
            oView.byId("dialogProdFert").setBusy(true);
            this._traerProductosFert().then(function () {
                oView.byId("dialogProdFert").setBusy(false);
            });
        },
        
        handleVHProdFert: function (oEvent) {
            //metodo para cargar el valor seleccionado en el value help de fertilizantes
            var dato = oController.getView().getModel("modelProdsFert").getProperty(oEvent.getSource().getSelectedItem().getBindingContextPath()); //obtengo el dato que selecciono
            this._prodFert.producto = dato.Producto;
            this._prodFert.marca = dato.MarcaComercial;
            this._prodFert.dosis = "";
            this._prodFert.unidad = "";
            this.getModel("modelAddFert").refresh();
            this._oVHProdFert.close();
        },

        onCancelarVHProdFert: function (oEvent) {
            //metodo cerrar value help
            this._oVHProdFert.close();
        },

        onGuardarFert: function () {
            //metodo guardar pulverización
            var oFert = this.getModel("modelAddFert").getData();

            var oNuevaFert = {};
            var oView = this.getView();

            // si se ingresaron todos los datos continuo
            oView.byId("dialogFert").setBusy(true);

            oNuevaFert.Pedido = oFert.pedido;
            oNuevaFert.Posicion = oFert.posicion;
            oNuevaFert.NroFert = oFert.nrofert;
            oNuevaFert.Fecha = this._formatearFechaAString(oView.byId("_fechaFert").getDateValue());
            oNuevaFert.Superficie = oFert.superficie;
            oNuevaFert.Tipo = oFert.tipo;
            oNuevaFert.Observaciones = oFert.observaciones;
            if (parseFloat(oFert.superficie, 2) <= 0) {
                MessageToast.show("Ingrese una superficie válida antes de guardar la fertilización");
                this.getView().byId("dialogFert").setBusy(false);
                return;
            }
            //productos
            var aProductos = [], oProd = "";
            for (var i = 0; i < oFert.productos.length; i++) {
                oProd = {}
                oProd.Estado = oFert.productos[i].estado;
                oProd.Producto = oFert.productos[i].producto;
                if (oFert.productos[i].dosis) {
                    oProd.Dosis = parseFloat(oFert.productos[i].dosis, 2).toString();
                }
                if (oFert.productos[i].dosisProm) {
                    oProd.DosisProm = parseFloat(oFert.productos[i].dosisProm, 2).toString();
                }
                oProd.Unidad = oFert.productos[i].unidad;
                if (oProd.Estado && oProd.Producto && oProd.Unidad) {
                    if (oProd.Dosis || oProd.DosisProm) {
                        aProductos.push(oProd);
                    }
                }
            }
            if (aProductos.length <= 0) {
                MessageToast.show("Ingrese al menos un producto completo antes de guardar la fertilización");
                this.getView().byId("dialogFert").setBusy(false);
                return;
            }
            oNuevaFert.ProductosFertSet = aProductos;
            this._editarFert(oNuevaFert);
        },

        onFiltrarProdFert: function (oEvent) {
            //metodo de filtro
            var query = oEvent.getSource().getValue();
            var datos = oController.getView().byId("idTablaProdFert").getBinding("items");;

            var filtro = null;

            //aplico el filtro
            if (query) {
                filtro = new Filter([
                    new Filter("MarcaComercial", FilterOperator.Contains, query),
                    // new Filter("PrincipioAct1", FilterOperator.Contains, query),
                    // new Filter("PrincipioAct2", FilterOperator.Contains, query)
                ], false);
            }
            datos.filter(filtro, "Application");
        },

        onAgregarProdFert: function (oEvent) {
            var aProductos = this.getModel("modelAddFert").getProperty("/productos");
            var oProd = {
                id: (aProductos.length + 1),
                estado: "",
                producto: "",
                marca: "",
                dosis: "",
                dosisProm: "",
                unidad: "",
                mostrarAgregar: false,
                mostrarBorrar: true
            };
            aProductos[aProductos.length - 1].mostrarAgregar = false;
            aProductos.push(oProd);
            this.getModel("modelAddFert").setProperty("/productos", aProductos);
        },

        onBorrarProdFert: function (oEvent) {
            var oObject = oEvent.getSource().getBindingContext("modelAddFert").getObject();
            var aProductos = this.getModel("modelAddFert").getProperty("/productos");
            if (aProductos.length > 1) {
                aProductos.splice((oObject.id - 1), 1);
                if (this._validarProdFert(aProductos[aProductos.length - 1])) {
                    aProductos[aProductos.length - 1].mostrarAgregar = true;
                } else {
                    aProductos[aProductos.length - 1].mostrarAgregar = false;
                }
                this.getModel("modelAddFert").setProperty("/productos", aProductos);
                this._acomodarIdsFert();
            } else {
                MessageToast.show("Debe ingresar al menos un producto para guardar la fertilización");
            }
            this.getModel("modelAddFert").refresh();
        },

        onChangeEstado: function (oEvent) {
            // var oObject = oEvent.getSource().getBindingContext("modelAddFert").getObject();
            // oObject.producto = "";
            // oObject.marca = "";
            // oObject.dosis = "";
            // oObject.dosisProm = "";
            // oObject.unidad = "";
            // this.getModel("modelAddFert").refresh();
            this.onValidarAgregarFert(oEvent);
        },

        onValidarAgregarFert: function (oEvent) {
            var oObject = oEvent.getSource().getBindingContext("modelAddFert").getObject();
            var aProductos = this.getModel("modelAddFert").getProperty("/productos");
            if (aProductos[aProductos.length - 1].id === oObject.id) {
                if (this._validarProdFert(oObject)) {
                    oObject.mostrarAgregar = true;
                } else {
                    oObject.mostrarAgregar = false;
                }
                this.getModel("modelAddFert").refresh();
            }
        },

        onVerProdsFert: function (oEvent) {
            var oObject = oEvent.getSource().getBindingContext("modelFertilizaciones").getObject();
            //abro el fragment
            if (!this.dialogProductosFert) {
                var oView = this.getView();
                this.dialogProductosFert = sap.ui.xmlfragment(oView.getId(), "hb4.zhb4_mispedidos.view.ProductosFert", this);
                this.getView().addDependent(this.dialogProductosFert);
                this.dialogProductosFert.open();
            }

            this.dialogProductosFert.open();
            this.getView().byId("dialogProductosFert").setBusy(true);
            this._cargarProductosFert(oObject).then(function (aProductos) {
                var oModelProductosFert = new JSONModel();
                oModelProductosFert.setData(aProductos);
                oController.setModel(oModelProductosFert, "modelProductosFert");
                oController.getView().byId("dialogProductosFert").setBusy(false);
            });
        },

        onCancelarProductosFert: function () {
            this.dialogProductosFert.close();
        },

        onChangeTipoFert: function () {
            var aProductos = this.getModel("modelAddFert").getProperty("/productos");
            for (var i = 0; i < aProductos.length; i++) {
                aProductos[i].dosis = "";
                aProductos[i].dosisProm = "";
                aProductos[i].unidad = "";
            }
            aProductos[aProductos.length - 1].mostrarAgregar = false;
            this.getModel("modelAddFert").refresh();
        },

        //FIN FERTILIZACION

        //FENOLOGIAS
        onEditarFenolog: function () {
            var oModelAddFenolog = this.getModel("modelAddFenolog");
            var oModelAddFenologData = oModelAddFenolog.getData();
            var oView = this.getView();
            //guardo valores 
            oModelAddFenologData.emergenciaTrigo = oView.byId("_fechaEmergenciaTrigo").getDateValue();
            oModelAddFenologData.antesis = oView.byId("_fechaAntesisTrigo").getDateValue();
            oModelAddFenologData.madurez = oView.byId("_fechaMadurezTrigo").getDateValue();
            oModelAddFenologData.emergenciaSoja = oView.byId("_fechaEmergenciaSoja").getDateValue();
            oModelAddFenologData.r5 = oView.byId("_fechaR5Soja").getDateValue();
            oModelAddFenologData.r8 = oView.byId("_fechaR8Soja").getDateValue();

            oModelAddFenologData.editarFenolog = true;

            oModelAddFenolog.refresh();
        },

        onCancelarFenolog: function () {
            var oModelAddFenolog = this.getModel("modelAddFenolog");
            var oModelAddFenologData = oModelAddFenolog.getData();
            var oView = this.getView();

            oView.byId("_fechaEmergenciaTrigo").setDateValue(oModelAddFenologData.emergenciaTrigo);
            oView.byId("_fechaAntesisTrigo").setDateValue(oModelAddFenologData.antesis);
            oView.byId("_fechaMadurezTrigo").setDateValue(oModelAddFenologData.madurez);
            oView.byId("_fechaEmergenciaSoja").setDateValue(oModelAddFenologData.emergenciaSoja);
            oView.byId("_fechaR5Soja").setDateValue(oModelAddFenologData.r5);
            oView.byId("_fechaR8Soja").setDateValue(oModelAddFenologData.r8);

            oModelAddFenologData.editarFenolog = false;
            oModelAddFenolog.refresh();
        },

        onGuardarFenolog: function () {
            oController.getView().byId("ObjectPageLayout").setBusy(true);
            var oView = this.getView();
            var oData = {};
            var oModelAddFenolog = this.getModel("modelAddFenolog").getData();
            var oLote = oView.getBindingContext().getObject();
            var sObjectPath = "", accion = "update";
            if (oModelAddFenolog.cargarFenTR) {
                if (!oModelAddFenolog.emergenciaTrigo && !oModelAddFenolog.antesis && !oModelAddFenolog.madurez) {
                    accion = "create";
                    sObjectPath = "/FenologiaSet";
                } else {
                    accion = "update";
                    sObjectPath = this.getModel("labores").createKey("/FenologiaSet", {
                        Pedido: oLote.pedido,
                        Posicion: oLote.posicion
                    });
                }
                oData.Emergencia = this._formatearFechaAString(oView.byId("_fechaEmergenciaTrigo").getDateValue());
                oData.Antesis = this._formatearFechaAString(oView.byId("_fechaAntesisTrigo").getDateValue());
                oData.Madurez = this._formatearFechaAString(oView.byId("_fechaMadurezTrigo").getDateValue());
            }

            if (oModelAddFenolog.cargarFenSO) {
                if (!oModelAddFenolog.emergenciaSoja && !oModelAddFenolog.r5 && !oModelAddFenolog.r8) {
                    accion = "create";
                    sObjectPath = "/FenologiaSet";
                } else {
                    accion = "update";
                    sObjectPath = this.getModel("labores").createKey("/FenologiaSet", {
                        Pedido: oLote.pedido,
                        Posicion: oLote.posicion
                    });
                }
                oData.Emergencia = this._formatearFechaAString(oView.byId("_fechaEmergenciaSoja").getDateValue());
                oData.R5 = this._formatearFechaAString(oView.byId("_fechaR5Soja").getDateValue());
                oData.R8 = this._formatearFechaAString(oView.byId("_fechaR8Soja").getDateValue());
            }

            oData.Pedido = oLote.pedido;
            oData.Posicion = oLote.posicion;

            // var sObjectPath = this.getModel("labores").createKey("/FenologiaSet", {
            //     Pedido: oLote.pedido,
            //     Posicion: oLote.posicion
            // });
            if (accion === "create") {
                this.getModel("labores").create(sObjectPath, oData, {
                    success: function (oData) {
                        oController.getView().byId("ObjectPageLayout").setBusy(false);
                        MessageToast.show("Fenología editada");
                        oController._traerFenolog(oLote.pedido, oLote.posicion);
                    }.bind(this),
                    error: function (oError) {
                        MessageToast.show("Error al editar Fenología");
                        oController.getView().byId("ObjectPageLayout").setBusy(false);
                    }
                });
            } else {
                this.getModel("labores").update(sObjectPath, oData, {
                    success: function (oData) {
                        oController.getView().byId("ObjectPageLayout").setBusy(false);
                        MessageToast.show("Fenología editada");
                        oController._traerFenolog(oLote.pedido, oLote.posicion);
                    }.bind(this),
                    error: function (oError) {
                        MessageToast.show("Error al editar Fenología");
                        oController.getView().byId("ObjectPageLayout").setBusy(false);
                    }
                });
            }
        },

        // METODOS INTERNOS

        //FERTILZACION

        _cargarModeloPulv: function (pulv) {
            return new Promise(function (resolve, reject) {
                var oView = oController.getView();

                var oPulverizacion = {};

                oPulverizacion.nropulv = pulv.NroPulv;
                oPulverizacion.pedido = pulv.Pedido;
                oPulverizacion.posicion = pulv.Posicion;
                var oFecha = oController._formatearFechaADate(pulv.Fecha);
                oView.byId("_fechaPulv").setDateValue(oFecha);
                oPulverizacion.superficie = pulv.Superficie;
                oPulverizacion.observaciones = pulv.Observaciones;

                var sObjectPath = oController.getModel("labores").createKey("/PulverizacionesSet", {
                    Pedido: pulv.Pedido,
                    Posicion: pulv.Posicion,
                    NroPulv: pulv.NroPulv,
                    Bp: ""
                });
                oController.getModel("labores").read(sObjectPath + "/ProductosPulvSet", {
                    success: function (oData) {
                        var aProductos = [], oProd = {};
                        for (var i = 0; i < oData.results.length; i++) {
                            oProd = {};
                            oProd.id = i + 1;
                            oProd.variedad = oData.results[i].Tipo;
                            oProd.producto = oData.results[i].Producto;
                            oProd.marca = oData.results[i].MarcaComercial;
                            oProd.dosis = oData.results[i].Dosis;
                            oProd.unidad = oData.results[i].Unidad;
                            oProd.mostrarAgregar = false;
                            oProd.mostrarBorrar = true;
                            aProductos.push(oProd);
                        }
                        aProductos[oData.results.length - 1].mostrarAgregar = true;
                        aProductos[oData.results.length - 1].mostrarBorrar = true;
                        oPulverizacion.productos = aProductos;
                        resolve(oPulverizacion);
                    },
                    error: function () {
                        oPulverizacion.productos = [];
                        reject(oPulverizacion);
                    }
                });
            });
        },

        _traerPulver: function (sPedido, sPosicion) {
            var oViewModel = this.getModel("objectView");
            oViewModel.setProperty("/busy", true);
            var aFilters = [];
            aFilters.push(new sap.ui.model.Filter("Pedido", sap.ui.model.FilterOperator.EQ, sPedido));
            aFilters.push(new sap.ui.model.Filter("Posicion", sap.ui.model.FilterOperator.EQ, sPosicion));
            this.getModel("labores").read("/PulverizacionesSet", {
                filters: aFilters,
                success: function (oData) {
                    oController.getModel("modelPulverizaciones").setData(oData.results);
                    oViewModel.setProperty("/busy", false);
                }.bind(this),
                error: function (oError) {
                    oController.getModel("modelPulverizaciones").setData([]);
                    oViewModel.setProperty("/busy", false);
                }.bind(this)
            });
        },

        _traerProductos: function (sVariedad) {
            return new Promise(function (resolve, reject) {
                var aFilters = [];
                aFilters.push(new sap.ui.model.Filter("Tipo", sap.ui.model.FilterOperator.EQ, sVariedad));
                oController.getModel("labores").read("/ProductosPulvSet", {
                    filters: aFilters,
                    success: function (oData) {
                        oController.getModel("modelProdsPulv").setData(oData.results);
                        resolve();
                    }.bind(oController),
                    error: function (oError) {
                        oController.getModel("modelProdsPulv").setData([]);
                        resolve();
                    }
                });
            });
        },

        _cargarModelos: function () {
            this.setModel(this.getOwnerComponent().getModel("labores"), "labores");

            //modelo pulverizaciones
            var oModelPulv = new JSONModel();
            this.setModel(oModelPulv, "modelPulverizaciones");

            //modelo fertilizaciones
            var oModelFert = new JSONModel();
            this.setModel(oModelFert, "modelFertilizaciones");

            //modelo fenología
            var oModelFenolog = new JSONModel({
                cargarFenTR: false,
                cargarFenSO: false,
                editarFenolog: false
            });
            this.setModel(oModelFenolog, "modelAddFenolog");

            //modelo productos de fertilizacion
            var oModelProdsFert = new JSONModel();
            oModelProdsFert.setSizeLimit(10000);
            this.setModel(oModelProdsFert, "modelProdsFert");

            //modelo productos de pulverizacion
            var oModelProdsPulv = new JSONModel();
            oModelProdsPulv.setSizeLimit(10000);
            this.setModel(oModelProdsPulv, "modelProdsPulv");

            //modelo de lluvia
            var oModelLluv = new JSONModel({
                mostrarLluvias: false
            });
            this.setModel(oModelLluv, "modelLluvia");

            //Cargar api Key Google Maps
            new Promise(function (fnResolve, fnReject) {
                jQuery.sap.includeScript(
                    // para PRD 
                    "https://maps.googleapis.com/maps/api/js?key=AIzaSyAjQU1p7l6-AtR9FRwwAkhutE4fObWoy_c&callback=initMap&libraries=&v=weekly",
                    // "https://maps.googleapis.com/maps/api/js?key=AIzaSyBHtmWTtq2hI9zXXcdX8J1O_PLFf_8nvko&callback=initMap&libraries=&v=weekly",
                    "map",
                    fnResolve,
                    fnReject
                );
            }).then(function () { });
        },

        _editarPulv: function (oNuevaPulv) {
            this.getModel("labores").create("/PulverizacionesSet", oNuevaPulv, {
                success: function (oData) {
                    oController.getView().byId("dialogPulv").setBusy(false);
                    oController._oDialogPulv.close();
                    MessageToast.show("Pulverización editada");
                    oController._traerPulver(oNuevaPulv.Pedido, oNuevaPulv.Posicion);
                }.bind(this),
                error: function (oError) {
                    MessageToast.show("Error al editar Pulverización");
                    oController.getView().byId("dialogPulv").setBusy(false);
                }
            });
        },

        _obtenerItemASeleccionar: function (sNroProd) {
            var oItem = {};
            var aItemsTabla = this.getView().byId("idTablaProdPulv").getItems();
            var oObject;
            for (var i = 0; i < aItemsTabla.length; i++) {
                oObject = aItemsTabla[i].getBindingContext("modelProdsPulv").getObject();
                if (oObject.Producto === sNroProd) {
                    oItem = aItemsTabla[i];
                }
            }

            return oItem;
        },

        _validarProdPulv: function (oProd) {
            var bValidado = false;
            if (oProd.variedad && oProd.producto && oProd.dosis && oProd.unidad) {
                bValidado = true;
            }
            return bValidado;
        },

        _acomodarIdsPulv: function () {
            var aProductos = this.getModel("modelAddPulv").getProperty("/productos");
            for (var i = 0; i < aProductos.length; i++) {
                aProductos[i].id = i + 1;
            }
            this.getModel("modelAddPulv").refresh();
        },

        _cargarProductosPulv: function (oPulv) {
            return new Promise(function (resolve, reject) {
                var sObjectPath = oController.getModel("labores").createKey("/PulverizacionesSet", {
                    Pedido: oPulv.Pedido,
                    Posicion: oPulv.Posicion,
                    NroPulv: oPulv.NroPulv,
                    Bp: ""
                });
                oController.getModel("labores").read(sObjectPath + "/ProductosPulvSet", {
                    success: function (oData) {
                        resolve(oData.results);
                    }.bind(oController),
                    error: function (oError) {
                        resolve([]);
                    }
                });
            });
        },

        //FERTILIZACION
        _traerFert: function (sPedido, sPosicion) {
            var oViewModel = this.getModel("objectView");
            oViewModel.setProperty("/busy", true);
            var aFilters = [];
            aFilters.push(new sap.ui.model.Filter("Pedido", sap.ui.model.FilterOperator.EQ, sPedido));
            aFilters.push(new sap.ui.model.Filter("Posicion", sap.ui.model.FilterOperator.EQ, sPosicion));
            this.getModel("labores").read("/FertilizacionesSet", {
                filters: aFilters,
                success: function (oData) {
                    oController.getModel("modelFertilizaciones").setData(oData.results);
                    oViewModel.setProperty("/busy", false);
                }.bind(oController),
                error: function (oError) {
                    oController.getModel("modelFertilizaciones").setData([]);
                    oViewModel.setProperty("/busy", false);
                }.bind(oController)
            });
        },

        _cargarModeloFert: function (fert) {
            return new Promise(function (resolve, reject) {
                var oView = oController.getView();

                var oFertilizacion = {};

                oFertilizacion.nrofert = fert.NroFert;
                oFertilizacion.pedido = fert.Pedido;
                oFertilizacion.posicion = fert.Posicion;
                var oFecha = oController._formatearFechaADate(fert.Fecha);
                oView.byId("_fechaFert").setDateValue(oFecha);
                oFertilizacion.superficie = fert.Superficie;
                oFertilizacion.observaciones = fert.Observaciones;
                oFertilizacion.tipo = fert.Tipo;

                var sObjectPath = oController.getModel("labores").createKey("/FertilizacionesSet", {
                    Pedido: fert.Pedido,
                    Posicion: fert.Posicion,
                    NroFert: fert.NroFert,
                    Bp: ""
                });
                oController.getModel("labores").read(sObjectPath + "/ProductosFertSet", {
                    success: function (oData) {
                        var aProductos = [], oProd = {};
                        for (var i = 0; i < oData.results.length; i++) {
                            oProd = {};
                            oProd.id = i + 1;
                            oProd.estado = oData.results[i].Estado;
                            oProd.producto = oData.results[i].Producto;
                            oProd.marca = oData.results[i].MarcaComercial;
                            oProd.dosis = oData.results[i].Dosis;
                            oProd.dosisProm = oData.results[i].DosisProm;
                            oProd.unidad = oData.results[i].Unidad;
                            oProd.mostrarAgregar = false;
                            oProd.mostrarBorrar = true;
                            aProductos.push(oProd);
                        }
                        aProductos[oData.results.length - 1].mostrarAgregar = true;
                        aProductos[oData.results.length - 1].mostrarBorrar = true;
                        oFertilizacion.productos = aProductos;
                        resolve(oFertilizacion);
                    },
                    error: function () {
                        oFertilizacion.productos = [];
                        reject(oFertilizacion);
                    }
                });
            });
        },

        _traerProductosFert: function (sEstado) {
            return new Promise(function (resolve, reject) {
                var aDatos = oController.getModel("modelProdsFert").getData();
                if(aDatos.length > 0){
                    resolve();
                } else {
                    // var aFilters = [];
                    // aFilters.push(new sap.ui.model.Filter("Estado", sap.ui.model.FilterOperator.EQ, sEstado));
                    oController.getModel("labores").read("/ProductosFertSet", {
                        // filters: aFilters,
                        success: function (oData) {
                            oController.getModel("modelProdsFert").setData(oData.results);
                            resolve();
                        }.bind(oController),
                        error: function (oError) {
                            oController.getModel("modelProdsFert").setData([]);
                            resolve();
                        }
                    });
                }
            });
        },

        _obtenerItemASeleccionarFert: function (sNroProd) {
            var oItem = {};
            var aItemsTabla = this.getView().byId("idTablaProdFert").getItems();
            var oObject;
            for (var i = 0; i < aItemsTabla.length; i++) {
                oObject = aItemsTabla[i].getBindingContext("modelProdsFert").getObject();
                if (oObject.Producto === sNroProd) {
                    oItem = aItemsTabla[i];
                }
            }

            return oItem;
        },

        _editarFert: function (oNuevaFert) {
            this.getModel("labores").create("/FertilizacionesSet", oNuevaFert, {
                success: function (oData) {
                    oController.getView().byId("dialogFert").setBusy(false);
                    oController._oDialogFert.close();
                    MessageToast.show("Fertilización editada");
                    oController._traerFert(oNuevaFert.Pedido, oNuevaFert.Posicion);
                }.bind(this),
                error: function (oError) {
                    MessageToast.show("Error al editar Fertilización");
                    oController.getView().byId("dialogFert").setBusy(false);
                }
            });
        },

        _validarProdFert: function (oProd) {
            var bValidado = false;
            if (oProd.estado && oProd.producto && oProd.unidad) {
                if (oProd.dosis || oProd.dosisProm) {
                    bValidado = true;
                }
            }
            return bValidado;
        },

        _acomodarIdsFert: function () {
            var aProductos = this.getModel("modelAddFert").getProperty("/productos");
            for (var i = 0; i < aProductos.length; i++) {
                aProductos[i].id = i + 1;
            }
            this.getModel("modelAddFert").refresh();
        },

        _cargarProductosFert: function (oFert) {
            return new Promise(function (resolve, reject) {
                var sObjectPath = oController.getModel("labores").createKey("/FertilizacionesSet", {
                    Pedido: oFert.Pedido,
                    Posicion: oFert.Posicion,
                    NroFert: oFert.NroFert,
                    Bp: ""
                });
                oController.getModel("labores").read(sObjectPath + "/ProductosFertSet", {
                    success: function (oData) {
                        resolve(oData.results);
                    }.bind(oController),
                    error: function (oError) {
                        resolve([]);
                    }
                });
            });
        },

        //FENOLOGIA

        _traerFenolog: function (sPedido, sPosicion) {

            //refrescar datos
            var oModelAddFenolog = this.getModel("modelAddFenolog");
            var oModelAddFenologData = oModelAddFenolog.getData();
            oModelAddFenologData.emergenciaTrigo = null;
            oModelAddFenologData.antesis = null;
            oModelAddFenologData.madurez = null;
            oModelAddFenologData.emergenciaSoja = null;
            oModelAddFenologData.r5 = null;
            oModelAddFenologData.r8 = null;
            oModelAddFenologData.editarFenolog = false;
            oModelAddFenolog.refresh();

            var oViewModel = this.getModel("objectView");
            oViewModel.setProperty("/busy", true);
            var aFilters = [];
            var sObjectPath = this.getModel("labores").createKey("/FenologiaSet", {
                Pedido: sPedido,
                Posicion: sPosicion
            });
            var oLote = oController.getView().getBindingContext().getObject();
            this.getModel("labores").read(sObjectPath, {
                filters: aFilters,
                success: function (oData) {
                    if (oLote.cultivo === "Trigo" || oLote.cultivo === "TR") {
                        oController.getView().byId("_fechaEmergenciaTrigo").setDateValue(oController._formatearFechaADate(oData.Emergencia));
                        oController.getView().byId("_fechaAntesisTrigo").setDateValue(oController._formatearFechaADate(oData.Antesis));
                        oController.getView().byId("_fechaMadurezTrigo").setDateValue(oController._formatearFechaADate(oData.Madurez));
                        oController.getModel("modelAddFenolog").setProperty("/cargarFenTR", true);
                    } else if (oLote.cultivo === "Soja" || oLote.cultivo === "SO") {
                        oController.getView().byId("_fechaEmergenciaSoja").setDateValue(oController._formatearFechaADate(oData.Emergencia));
                        oController.getView().byId("_fechaR5Soja").setDateValue(oController._formatearFechaADate(oData.R5));
                        oController.getView().byId("_fechaR8Soja").setDateValue(oController._formatearFechaADate(oData.R8));
                        oController.getModel("modelAddFenolog").setProperty("/cargarFenSO", true);
                    }
                    oViewModel.setProperty("/busy", false);
                }.bind(this),
                error: function (oError) {
                    if (oLote.cultivo === "Trigo" || oLote.cultivo === "TR") {
                        oController.getView().byId("_fechaEmergenciaTrigo").setDateValue(null);
                        oController.getView().byId("_fechaAntesisTrigo").setDateValue(null);
                        oController.getView().byId("_fechaMadurezTrigo").setDateValue(null);
                        oController.getModel("modelAddFenolog").setProperty("/cargarFenTR", true);
                    } else if (oLote.cultivo === "Soja" || oLote.cultivo === "SO") {
                        oController.getView().byId("_fechaEmergenciaSoja").setDateValue(null);
                        oController.getView().byId("_fechaR5Soja").setDateValue(null);
                        oController.getView().byId("_fechaR8Soja").setDateValue(null);
                        oController.getModel("modelAddFenolog").setProperty("/cargarFenSO", true);
                    }
                    oViewModel.setProperty("/busy", false);
                }.bind(this)
            });
        },

        //FIN FENOLOGIA

        //LLUVIA
        onEditarLluv: function () {
            var oModelLluvia = this.getModel("modelLluvia");
            var oModelLluviaData = oModelLluvia.getData();

            oModelLluviaData.isEdit = true;

            oModelLluvia.refresh();
        },

        onCancelarEditLluv: function () {
            var oModelLluvia = this.getModel("modelLluvia");
            var oModelLluviaData = oModelLluvia.getData();

            for (var i = 0; i < oModelLluviaData.Lluvias.length; i++) {
                if (parseFloat(oModelLluviaData.Lluvias[i].Enero, 2) > 0) {
                    oModelLluviaData.Lluvias[i].EneroNuevo = oModelLluviaData.Lluvias[i].Enero;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Febrero, 2) > 0) {
                    oModelLluviaData.Lluvias[i].FebreroNuevo = oModelLluviaData.Lluvias[i].Febrero;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Marzo, 2) > 0) {
                    oModelLluviaData.Lluvias[i].MarzoNuevo = oModelLluviaData.Lluvias[i].Marzo;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Abril, 2) > 0) {
                    oModelLluviaData.Lluvias[i].AbrilNuevo = oModelLluviaData.Lluvias[i].Abril;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Mayo, 2) > 0) {
                    oModelLluviaData.Lluvias[i].MayoNuevo = oModelLluviaData.Lluvias[i].Mayo;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Junio, 2) > 0) {
                    oModelLluviaData.Lluvias[i].JunioNuevo = oModelLluviaData.Lluvias[i].Junio;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Julio, 2) > 0) {
                    oModelLluviaData.Lluvias[i].JulioNuevo = oModelLluviaData.Lluvias[i].Julio;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Agosto, 2) > 0) {
                    oModelLluviaData.Lluvias[i].AgostoNuevo = oModelLluviaData.Lluvias[i].Agosto;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Septiembre, 2) > 0) {
                    oModelLluviaData.Lluvias[i].SeptiembreNuevo = oModelLluviaData.Lluvias[i].Septiembre;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Octubre, 2) > 0) {
                    oModelLluviaData.Lluvias[i].OctubreNuevo = oModelLluviaData.Lluvias[i].Octubre;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Noviembre, 2) > 0) {
                    oModelLluviaData.Lluvias[i].NoviembreNuevo = oModelLluviaData.Lluvias[i].Noviembre;
                }
                if (parseFloat(oModelLluviaData.Lluvias[i].Diciembre, 2) > 0) {
                    oModelLluviaData.Lluvias[i].DiciembreNuevo = oModelLluviaData.Lluvias[i].Diciembre;
                }
            }

            oModelLluviaData.isEdit = false;

            oModelLluvia.refresh();
        },

        onGuardarEditLluv: function () {
            var aDataLuvias = this.getModel("modelLluvia").getData().Lluvias;
            var oData = {}, aLluvias = [], oLluvia = {};
            var oLote = {};
            this.getView().byId("tableLluv").setBusy(true);

            for (var i = 0; i < aDataLuvias.length; i++) {
                if (parseFloat(aDataLuvias[i].EneroNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "1";
                    oLluvia.Cantidad = aDataLuvias[i].EneroNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].FebreroNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "2";
                    oLluvia.Cantidad = aDataLuvias[i].FebreroNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].MarzoNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "3";
                    oLluvia.Cantidad = aDataLuvias[i].MarzoNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].AbrilNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "4";
                    oLluvia.Cantidad = aDataLuvias[i].AbrilNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].MayoNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "5";
                    oLluvia.Cantidad = aDataLuvias[i].MayoNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].JunioNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "6";
                    oLluvia.Cantidad = aDataLuvias[i].JunioNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].JulioNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "7";
                    oLluvia.Cantidad = aDataLuvias[i].JulioNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].AgostoNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "8";
                    oLluvia.Cantidad = aDataLuvias[i].AgostoNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].SeptiembreNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "9";
                    oLluvia.Cantidad = aDataLuvias[i].SeptiembreNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].OctubreNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "10";
                    oLluvia.Cantidad = aDataLuvias[i].OctubreNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].NoviembreNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "11";
                    oLluvia.Cantidad = aDataLuvias[i].NoviembreNuevo;
                    aLluvias.push(oLluvia);
                }
                if (parseFloat(aDataLuvias[i].DiciembreNuevo, 2) > 0) {
                    oLluvia = {};
                    oLluvia.Dia = aDataLuvias[i].Id;
                    oLluvia.Mes = "12";
                    oLluvia.Cantidad = aDataLuvias[i].DiciembreNuevo;
                    aLluvias.push(oLluvia);
                }
            }

            oLote = this.getView().getBindingContext().getObject();
            oData = {};
            oData.Pedido = oLote.pedido;
            oData.Posicion = oLote.posicion;
            oData.EsEditar = 'X';
            oData.LluviaSet = aLluvias;

            //mando los cambios al back
            this.getModel("labores").create("/LoteSet", oData, {
                success: function (oDataResp) {
                    oController.getView().byId("tableLluv").setBusy(false);
                    MessageToast.show("Lluvias editadas");
                    oController._traerLluvias(oData.Pedido, oData.Posicion);
                }.bind(this),
                error: function (oError) {
                    MessageToast.show("Error al editar lluvias");
                    oController.getView().byId("tableLluv").setBusy(false);
                }
            });
        },

        onAgregarLluv: function () {
            this._navigate("labores", "display", null);
        },

        _traerLluvias: function (sPedido, sPosicion) {
            var oViewModel = this.getModel("objectView");
            oController.getView().byId("tableLluv").setBusy(true);
            var aFilters = [];
            aFilters.push(new sap.ui.model.Filter("Pedido", sap.ui.model.FilterOperator.EQ, sPedido));
            aFilters.push(new sap.ui.model.Filter("Posicion", sap.ui.model.FilterOperator.EQ, sPosicion));
            this.getModel("labores").read("/LluviaSet", {
                filters: aFilters,
                success: function (oData) {
                    if (oData.results.length > 0) {
                        oController.getModel("modelLluvia").setProperty("/mostrarLluvias", true);
                    } else {
                        oController.getModel("modelLluvia").setProperty("/mostrarLluvias", false);
                    }
                    oController._cargarModeloLLuvia(oData.results);
                    oController.getView().byId("tableLluv").setBusy(false);
                }.bind(oController),
                error: function (oError) {
                    oController.getModel("modelLluvia").setProperty("/mostrarLluvias", false);
                    oController._cargarModeloLLuvia([]);
                    oController.getView().byId("tableLluv").setBusy(false);
                }.bind(oController)
            });
        },

        _cargarModeloLLuvia: function (aDatos) {
            var aData = {}, aLluvias = [], oLluvia = {}, oTotal = {}, j = 0;
            if (aDatos.length > 0) {
                for (var i = 0; i < aDatos.length; i++) {
                    oLluvia = {};
                    oLluvia.Id = parseInt(aDatos[i].Dia);
                    j = aLluvias.map(function (e) {
                        return e.Id;
                    }).indexOf(aDatos[i].Dia);

                    if (j >= 0) {
                        switch (aDatos[i].Mes) {
                            case "1":
                                aLluvias[j].EneroNuevo = aDatos[i].Cantidad;
                                aLluvias[j].Enero = aDatos[i].Cantidad;
                                aLluvias[j].MostrarEnero = true;
                                break;
                            case "2":
                                aLluvias[j].FebreroNuevo = aDatos[i].Cantidad;
                                aLluvias[j].Febrero = aDatos[i].Cantidad;
                                aLluvias[j].MostrarFebrero = true;
                                break;
                            case "3":
                                aLluvias[j].MarzoNuevo = aDatos[i].Cantidad;
                                aLluvias[j].Marzo = aDatos[i].Cantidad;
                                aLluvias[j].MostrarMarzo = true;
                                break;
                            case "4":
                                aLluvias[j].AbrilNuevo = aDatos[i].Cantidad
                                aLluvias[j].Abril = aDatos[i].Cantidad;
                                aLluvias[j].MostrarAbril = true;
                                break;
                            case "5":
                                aLluvias[j].MayoNuevo = aDatos[i].Cantidad
                                aLluvias[j].Mayo = aDatos[i].Cantidad;
                                aLluvias[j].MostrarMayo = true;
                                break;
                            case "6":
                                aLluvias[j].JunioNuevo = aDatos[i].Cantidad
                                aLluvias[j].Junio = aDatos[i].Cantidad;
                                aLluvias[j].MostrarJunio = true;
                                break;
                            case "7":
                                aLluvias[j].JulioNuevo = aDatos[i].Cantidad
                                aLluvias[j].Julio = aDatos[i].Cantidad;
                                aLluvias[j].MostrarJulio = true;
                                break;
                            case "8":
                                aLluvias[j].AgostoNuevo = aDatos[i].Cantidad
                                aLluvias[j].Agosto = aDatos[i].Cantidad;
                                aLluvias[j].MostrarAgosto = true;
                                break;
                            case "9":
                                aLluvias[j].SeptiembreNuevo = aDatos[i].Cantidad
                                aLluvias[j].Septiembre = aDatos[i].Cantidad;
                                aLluvias[j].MostrarSeptiembre = true;
                                break;
                            case "10":
                                aLluvias[j].OctubreNuevo = aDatos[i].Cantidad
                                aLluvias[j].Octubre = aDatos[i].Cantidad;
                                aLluvias[j].MostrarOctubre = true;
                                break;
                            case "11":
                                aLluvias[j].NoviembreNuevo = aDatos[i].Cantidad
                                aLluvias[j].Noviembre = aDatos[i].Cantidad;
                                aLluvias[j].MostrarNoviembre = true;
                                break;
                            case "12":
                                aLluvias[j].DiciembreNuevo = aDatos[i].Cantidad
                                aLluvias[j].Diciembre = aDatos[i].Cantidad;
                                aLluvias[j].MostrarDiciembre = true;
                                break;
                            default:
                                break;
                        }
                    } else {
                        switch (aDatos[i].Mes) {
                            case "1":
                                oLluvia.EneroNuevo = aDatos[i].Cantidad;
                                oLluvia.Enero = aDatos[i].Cantidad;
                                oLluvia.MostrarEnero = true;
                                break;
                            case "2":
                                oLluvia.FebreroNuevo = aDatos[i].Cantidad;
                                oLluvia.Febrero = aDatos[i].Cantidad;
                                oLluvia.MostrarFebrero = true;
                                break;
                            case "3":
                                oLluvia.MarzoNuevo = aDatos[i].Cantidad;
                                oLluvia.Marzo = aDatos[i].Cantidad;
                                oLluvia.MostrarMarzo = true;
                                break;
                            case "4":
                                oLluvia.AbrilNuevo = aDatos[i].Cantidad;
                                oLluvia.Abril = aDatos[i].Cantidad;
                                oLluvia.MostrarAbril = true;
                                break;
                            case "5":
                                oLluvia.MayoNuevo = aDatos[i].Cantidad;
                                oLluvia.Mayo = aDatos[i].Cantidad;
                                oLluvia.MostrarMayo = true;
                                break;
                            case "6":
                                oLluvia.JunioNuevo = aDatos[i].Cantidad;
                                oLluvia.Junio = aDatos[i].Cantidad;
                                oLluvia.MostrarJunio = true;
                                break;
                            case "7":
                                oLluvia.JulioNuevo = aDatos[i].Cantidad;
                                oLluvia.Julio = aDatos[i].Cantidad;
                                oLluvia.MostrarJulio = true;
                                break;
                            case "8":
                                oLluvia.AgostoNuevo = aDatos[i].Cantidad;
                                oLluvia.Agosto = aDatos[i].Cantidad;
                                oLluvia.MostrarAgosto = true;
                                break;
                            case "9":
                                oLluvia.SeptiembreNuevo = aDatos[i].Cantidad;
                                oLluvia.Septiembre = aDatos[i].Cantidad;
                                oLluvia.MostrarSeptiembre = true;
                                break;
                            case "10":
                                oLluvia.OctubreNuevo = aDatos[i].Cantidad;
                                oLluvia.Octubre = aDatos[i].Cantidad;
                                oLluvia.MostrarOctubre = true;
                                break;
                            case "11":
                                oLluvia.NoviembreNuevo = aDatos[i].Cantidad;
                                oLluvia.Noviembre = aDatos[i].Cantidad;
                                oLluvia.MostrarNoviembre = true;
                                break;
                            case "12":
                                oLluvia.DiciembreNuevo = aDatos[i].Cantidad;
                                oLluvia.Diciembre = aDatos[i].Cantidad;
                                oLluvia.MostrarDiciembre = true;
                                break;
                            default:
                                break;
                        }
                        aLluvias.push(oLluvia);
                    }
                }
            }
            aData.Lluvias = aLluvias;
            aData.Totales = this._cargarTotalLluvias(aLluvias);
            aData.isEdit = false;
            if (aLluvias.length > 0) {
                aData.mostrarLluvias = true;
            } else {
                aData.mostrarLluvias = false;
            }
            this.getModel("modelLluvia").setData(aData);
        },

        _cargarTotalLluvias: function (aLluvias) {
            var oTotales = {}
            oTotales.Enero = 0, oTotales.Febrero = 0, oTotales.Marzo = 0,
                oTotales.Abril = 0, oTotales.Mayo = 0, oTotales.Junio = 0,
                oTotales.Julio = 0, oTotales.Agosto = 0, oTotales.Septiembre = 0,
                oTotales.Octubre = 0, oTotales.Noviembre = 0, oTotales.Diciembre = 0;
            for (var i = 0; i < aLluvias.length; i++) {
                if (parseFloat(aLluvias[i].Enero, 2) > 0) {
                    oTotales.Enero = parseFloat(oTotales.Enero, 2) + parseFloat(aLluvias[i].Enero, 2);
                }
                if (parseFloat(aLluvias[i].Febrero, 2) > 0) {
                    oTotales.Febrero = parseFloat(oTotales.Febrero, 2) + parseFloat(aLluvias[i].Febrero, 2);
                }
                if (parseFloat(aLluvias[i].Marzo, 2) > 0) {
                    oTotales.Marzo = parseFloat(oTotales.Marzo, 2) + parseFloat(aLluvias[i].Marzo, 2);
                }
                if (parseFloat(aLluvias[i].Abril, 2) > 0) {
                    oTotales.Abril = parseFloat(oTotales.Abril, 2) + parseFloat(aLluvias[i].Abril, 2);
                }
                if (parseFloat(aLluvias[i].Mayo, 2) > 0) {
                    oTotales.Mayo = parseFloat(oTotales.Mayo, 2) + parseFloat(aLluvias[i].Mayo, 2);
                }
                if (parseFloat(aLluvias[i].Junio, 2) > 0) {
                    oTotales.Junio = parseFloat(oTotales.Junio, 2) + parseFloat(aLluvias[i].Junio, 2);
                }
                if (parseFloat(aLluvias[i].Julio, 2) > 0) {
                    oTotales.Julio = parseFloat(oTotales.Julio, 2) + parseFloat(aLluvias[i].Julio, 2);
                }
                if (parseFloat(aLluvias[i].Agosto, 2) > 0) {
                    oTotales.Agosto = parseFloat(oTotales.Agosto, 2) + parseFloat(aLluvias[i].Agosto, 2);
                }
                if (parseFloat(aLluvias[i].Septiembre, 2) > 0) {
                    oTotales.Septiembre = parseFloat(oTotales.Septiembre, 2) + parseFloat(aLluvias[i].Septiembre, 2);
                }
                if (parseFloat(aLluvias[i].Octubre, 2) > 0) {
                    oTotales.Octubre = parseFloat(oTotales.Octubre, 2) + parseFloat(aLluvias[i].Octubre, 2);
                }
                if (parseFloat(aLluvias[i].Noviembre, 2) > 0) {
                    oTotales.Noviembre = parseFloat(oTotales.Noviembre, 2) + parseFloat(aLluvias[i].Noviembre, 2);
                }
                if (parseFloat(aLluvias[i].Diciembre, 2) > 0) {
                    oTotales.Diciembre = parseFloat(oTotales.Diciembre, 2) + parseFloat(aLluvias[i].Diciembre, 2);
                }
            }
            return oTotales;
        },

        _navigate: function (sSemanticObject, sActionName, oParameters, sObjectHash) {
            var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation"),
                hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                    target: {
                        semanticObject: sSemanticObject,
                        action: sActionName
                    },
                    params: oParameters
                })) || "";

            oCrossAppNavigator.toExternal({
                target: {
                    shellHash: hash + (sObjectHash ? sObjectHash : "")
                }
            });
        },

        //FIN LLUVIA

        _formatearFechaAString: function (dFecha) {
            if (dFecha) {
                var a = dFecha.getFullYear().toString();
                var m = (dFecha.getMonth() + 1).toString();
                var d = dFecha.getDate().toString();
                (d.length == 1) && (d = '0' + d);
                (m.length == 1) && (m = '0' + m);
                return a + m + d;
            } else {
                return "";
            }
        },

        _formatearFechaADate: function (sFecha) {
            if (sFecha) {
                var anio = sFecha.substring(0, 4);
                var mes = sFecha.substring(4, 6);
                var dia = sFecha.substring(6, 8);

                return new Date(anio, mes - 1, dia);
            } else {
                return null;
            }
        },

        onNavegarLabores: function () {
            oController.oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
            var oTarget = {};
            oTarget["semanticObject"] = "labores";
            oTarget["action"] = "display";
            oController.oCrossAppNav.toExternal({
                target: oTarget
            });
        },

        // ----------------------- STEWARDHISPPPPPP ----------------
        _cargarStewardship: function (pedido, posicion) {
            var aFilters = [];
            aFilters.push(new sap.ui.model.Filter("Pedido", sap.ui.model.FilterOperator.EQ, pedido));
            aFilters.push(new sap.ui.model.Filter("Posicion", sap.ui.model.FilterOperator.EQ, posicion));

            this.getModel().read("/stewardshipSet", {
                filters: aFilters,
                success: function (oData) {
                    var oModelSiembra = new JSONModel();
                    oModelSiembra.setData(oData.results);
                    oController.getView().byId("_idTableSiembra").setModel(oModelSiembra, "Siembra");
                }.bind(this),
                error: function () {
                }.bind(this)
            });
        },

        onMostrarCOriginal: function (oEvent) {

            let oRow = oEvent.getSource().getBindingContext("Siembra").getObject();

            oController.elementosMapa = [];
            let aElemento = this.getElementoMapa(oRow.CoordOriginales);
            oController.elementosMapa.push(aElemento);
            oController.mostrarMapaNuevo();

        },

        getElementoMapa: function (sElementoMapa) {
 
            let aCoordenadas = [];
            var aPuntos = sElementoMapa.split("/");
            for (let index = 0; index < aPuntos.length; index++) {
                const sPunto = aPuntos[index];
                let aPunto = sPunto.split("@");

                if (
                    !isNaN(parseFloat(aPunto[0])) &&
                    !isNaN(parseFloat(aPunto[1]))
                ) {
                    aCoordenadas.push({
                        lat: parseFloat(aPunto[0]),
                        lng: parseFloat(aPunto[1]),
                    });
                }
            }

            return aCoordenadas;

        },

        onMostrarCNueva: function (oEvent) {

            let oRow = oEvent.getSource().getBindingContext("Siembra").getObject();
            oController.elementosMapa = [];

            // Obtengo N coordenadas
            var oModel = oController.getView().getModel();

            var sPath = "/mapaLoteSet";

            var aFilters = [];
            var oFiltro = new sap.ui.model.Filter("Pedido", sap.ui.model.FilterOperator.EQ, oRow.Pedido);
            aFilters.push(oFiltro);
            oFiltro = new sap.ui.model.Filter("Posicion", sap.ui.model.FilterOperator.EQ, oRow.Posicion);
            aFilters.push(oFiltro);
            debugger;

            oModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {

                    let oModelMapa = new JSONModel();
                    if (oData.results.length > 0) {
                        oData.results.forEach(item => {
                            let aElemento = oController.getElementoMapa(item.Coordenadas);
                            oController.elementosMapa.push(aElemento);
                        });
                    }
                    oController.mostrarMapaNuevo();
                },
                error: function (oError) {

                },
            });
        },

        mostrarMapaNuevo: function (oRow) {

            if (oController.elementosMapa.length == 0) {
                MessageToast.show("No hay coordenadas cargadas");
                return;
            }

            var oView = oController.getView();
            var oElemento;

            if (!oController.frgMapa) {
                oController.frgMapa = Fragment.load({
                    id: oView.getId(), //"frgMapa",
                    name: "hb4.zhb4_mispedidos.view.Mapa",
                    controller: oController,
                }).then(function (frgMapa) {
                    oView.addDependent(frgMapa);
                    return frgMapa;
                });
            }

            oController.frgMapa.then(function (frgMapa) {

                frgMapa.open();

                const oMap = new google.maps.Map(
                    oController.getView().byId("map").getDomRef(),
                    {
                        zoom: 15,
                        center: oController.elementosMapa[0][0],
                        mapTypeId: "satellite",
                    }
                );

                for (let index = 0; index < oController.elementosMapa.length; index++) {
                    const aElemento = oController.elementosMapa[index];

                    if (aElemento.length == 1) {

                        oElemento = new google.maps.Marker({
                            position: aElemento[0],
                            label: "Purga"
                        });

                        oElemento.setMap(oMap);

                    } else {

                        oElemento = new google.maps.Polygon({
                            zoom: 10,
                            paths: aElemento,
                            strokeColor: "#FF0000",
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            fillColor: "#FF0000",
                            fillOpacity: 0.35
                        });

                        oElemento.setMap(oMap);

                    }

                }

            });

        },

        onMostrarCPurga: function (oEvent) {
            let oRow = oEvent.getSource().getBindingContext("Siembra").getObject();
            // oController.mostrarMapa(oRow.CoordPurga);
            oController.elementosMapa = [];
            let aElemento = this.getElementoMapa(oRow.CoordPurga);
            oController.elementosMapa.push(aElemento);
            oController.mostrarMapaNuevo();
        },

        mostrarMapa: function (sCoordenadas) {
            var oView = oController.getView();

            oController.Zona = sCoordenadas;

            if (oController.Zona == "") {
                MessageToast.show("No hay coordenadas cargadas");
                return;
            }

            if (!oController.frgMapa) {
                oController.frgMapa = Fragment.load({
                    id: oView.getId(),
                    name: "hb4.zhb4_mispedidos.view.Mapa",
                    controller: oController,
                }).then(function (frgMapa) {
                    oView.addDependent(frgMapa);
                    return frgMapa;
                }.bind(oController));
            }
            oController.frgMapa.then(function (frgMapa) {
                frgMapa.open();
                oController.initMap();
            });
        },

        onCloseMap: function (oEvent) {
            oEvent.getSource().getParent().close();
        }

    });

});