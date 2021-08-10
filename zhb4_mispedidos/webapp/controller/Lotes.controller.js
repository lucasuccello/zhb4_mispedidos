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
    "sap/ui/core/BusyIndicator",
    "sap/ui/core/Fragment",
    "hb4/zhb4_mispedidos/includes/firma",
    "sap/m/MessageBox"
], function (BaseController, JSONModel, formatter, Filter, FilterOperator, History, Dialog, DialogType, Button, ButtonType, MessageToast,
    HorizontalLayout,
    VerticalLayout, Text, TextArea, BusyIndicator, Fragment, Firma, MessageBox) {
    "use strict";
    var oController;
    var oJSONModel = new JSONModel();
    var oMessage;
    var vCeldaPosClick;
    var vPedido;
    var vPosicion;
    var vMaterialLote;
    return BaseController.extend("hb4.zhb4_mispedidos.controller.Lotes", {

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
            var oTabModel = new JSONModel();
            oController.setModel(oTabModel, "tabFilters");
            oView.addEventDelegate({
                onAfterShow: function (oEvent) {
                    oController.onRefresh();
                }
            }, oView);

            this.getRouter().getRoute("Lotes").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function () {
            if (oController.selectedItem) {
                this.byId("cbCartaOferta").setSelectedItem(this.byId("cbCartaOferta").getSelectedKey(oController.selectedItem));
                this.onSelection();
            }
        },

        onAfterRendering: function () {
            oController = this;
            oController.onSetContrato();
            var oView = this.getView();
            oView.addEventDelegate({
                onAfterShow: function (oEvent) {
                    oController.onRefresh();
                }
            }, oView);
            this.getCultivos();
            this.cargarMapas();
        },

        onSetContrato: function () {
            var that = this;
            var oModel1 = new sap.ui.model.json.JSONModel();
            oController.getView().getModel().read("/CartaOfertaSet", {
                success: function (oData, oResponse) {
                    var data = oData;
                    oModel1.setData(data);
                    this.getView().byId("cbCartaOferta").setModel(oModel1, "keyContract");
                    this.getView().byId("_buttonNuevoLote").setVisible(false);
                    this.CartaOferta = oData.results;
                    if (oData.results.length === 1) {
                        this.setDefaultContract(oData.results[0].Pedido);
                        if (oData.results[0].PuedeAgregarLote === "X") {
                            this.getView().byId("_buttonNuevoLote").setVisible(true);
                        }
                    }
                }.bind(this),
                error: function (oError) { }
            });
        },

        setDefaultContract: function (Pedido) {
            this.getView().byId("cbCartaOferta").setSelectedKey(Pedido);
            this.getView().byId("cbCartaOferta").setEditable(false);
            this.onSelection();
        },

        onSelection: function (oEvent) {

            var vKey;
            var vPuedeAgregarLote = "";
            this.byId("framePDFContrato").setContent(null);
            this.getView().byId("_buttonNuevoLote").setVisible(false);
            if (oEvent) {
                var oComboBox = oEvent.getSource(),
                    vKey = oComboBox.getSelectedKey();
                var oModelLocal = this.getModel();
                oController.selectedItem = vKey;
            } else {
                vKey = this.getView().byId("cbCartaOferta").getSelectedKey();
            }

            for (let index = 0; index < this.CartaOferta.length; index++) {
                if (this.CartaOferta[index].Pedido === vKey) {
                    if (this.CartaOferta[index].PuedeAgregarLote === "X") {
                        this.getView().byId("_buttonNuevoLote").setVisible(true);
                    }
                    break;
                }
            }

            if (vKey) {
                oController.Pedido = vKey;
                var aFilters = this.createFilters(vKey);
                var oModel = this.getModel(),
                    sPath = "/lotesSet";

                oModel.read(sPath, {

                    filters: aFilters,

                    success: function (oData) {
                        var oTableModel = new JSONModel();
                        oTableModel.setData(oData.results);
                        this.getView().byId("table").setModel(oTableModel, "tabFilters");
                        this.onCargarPDFContratos();
                    }.bind(this),
                    error: function () {
                        sap.m.MessageToast.show("Error al cargar Lotes");
                    }
                });

                this._MinimoHectareas = 30; //valor default
                setTimeout(function () {
                    //Solicito los parametros para la aplicacion
                    this.getView().getModel("Onboarding").callFunction("/ObtenerParametros", {
                        urlParameters: {},
                        success: function (oDataReturn, oResponse) {

                            var valorMin = oDataReturn.results.filter(function (element) { return element.key === "HECTAREA_MINIMA" }).map(function (element) { return element.valor });
                            if ((valorMin === "") || (valorMin === undefined))
                                valorMin = 30;
                            this._MinimoHectareas = parseInt(valorMin);
                            console.log("Hectareas minimas: " + this._MinimoHectareas);
                        }.bind(this),
                        error: function (oError) {
                            this._MinimoHectareas = 30;
                        }.bind(this)
                    });
                }.bind(this), 100);

            } else {
                var oTabModel = new JSONModel();
                oController.setModel(oTabModel, "tabFilters");
            }
        },

        createFilters: function (sKey) {
            return [new Filter("pedido", FilterOperator.EQ, sKey)];
        },
		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
        onPress: function (oEvent) {
            // The source is the list item that got pressed
            this._showObject(oEvent.getSource());
        },

        onAgregarLote: function (oEvent) {
            // The source is the list item that got pressed
            this._showObjectNuevoLote(oEvent.getSource());
        },

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
        onRefresh: function () {
            var oTable = this.byId("table");
            oTable.getBinding("items").refresh();
            oTable.getModel().refresh(true);
            var modelo1 = this.getView().getModel("tabFilters");
            modelo1.refresh(true);
            var modelo2 = this.getView().getModel();
            modelo2.refresh(true);
        },

        /* =========================================================== */
        /* internal methods                                            */
        /* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
        _showObject: function (oItem) {
            this.byId("framePDFContrato").setContent(null);
            this.getRouter().navTo("componentes", {
                pedido: oItem.getCells()[11].getText(),
                posicion: oItem.getCells()[12].getText(),
                materialLote: oItem.getCells()[13].getText()
                //pedido: oItem.getBindingContext().getProperty("pedido"),
                //posicion: oItem.getBindingContext().getProperty("posicion"),
                //materialLote: oItem.getBindingContext().getProperty("materialLote")
            });

        },

        onModificarFecha: function (oEvent) {
            //vPedido = oEvent.getSource().getBindingContext().getProperty("pedido");
            //vPosicion = oEvent.getSource().getBindingContext().getProperty("posicion");
            //vMaterialLote = oEvent.getSource().getBindingContext().getProperty("materialLote");
            vPedido = oEvent.getSource().getParent().getParent().getCells()[11].getText();
            vPosicion = oEvent.getSource().getParent().getParent().getCells()[12].getText();
            vMaterialLote = oEvent.getSource().getParent().getParent().getCells()[13].getText();
            var vFechaActual = oEvent.getSource().getParent().getParent().getCells()[7].getText();
            //var vFechaActual = oEvent.getSource().getBindingContext().getProperty("fechaEntrega");
            if (!this._DialogEditarFechaEntrega) {
                this._DialogEditarFechaEntrega = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.EditarFEntrega", this);
                var i18nModel = new sap.ui.model.resource.ResourceModel({
                    bundleUrl: "i18n/i18n.properties"
                });
                this._DialogEditarFechaEntrega.setModel(i18nModel, "i18n");
            }
            var dateStr = vFechaActual.substring(0, 2) + "/" + vFechaActual.substring(3, 5) + "/" + vFechaActual.substring(8, 10);
            sap.ui.getCore().byId("_iReemplazoFechaEntrega").setValue(dateStr);
            sap.ui.getCore().byId("_iReemplazoFechaEntrega").setMinDate(new Date());
            this._DialogEditarFechaEntrega.open();
        },

        onGrabarFechaEntrega: function () {
            var valorActual = sap.ui.getCore().byId("_iReemplazoFechaEntrega").getValue();
            if (valorActual) {
                if (!this.oEditDialogFechaEntrega) {
                    this.oEditDialogFechaEntrega = new Dialog({
                        type: DialogType.Message,
                        title: "Confirmación nueva Fecha Entrega",
                        content: new Text({
                            text: "Esto modificará también las fechas de los componentes, ¿Confirma la Modificación de la fecha de cosecha?"
                        }),
                        beginButton: new Button({
                            type: ButtonType.Emphasized,
                            text: "Confirmar",
                            press: function () {
                                this.onConfirmaEditarFechaEntrega();
                                this.oEditDialogFechaEntrega.close();
                            }.bind(this)
                        }),
                        endButton: new Button({
                            text: "Cancel",
                            press: function () {
                                this.oEditDialogFechaEntrega.close();
                            }.bind(this)
                        })
                    });
                }

                this.oEditDialogFechaEntrega.open();
            } else {
                sap.m.MessageToast.show("Ingrese nueva Fecha de Cosecha");
            }
        },

        onCancelarFechaEntrega: function () {
            this._DialogEditarFechaEntrega.close();
            this._DialogEditarFechaEntrega.destroy();
            this._DialogEditarFechaEntrega = null;
        },

        onConfirmaEditarFechaEntrega: function () {
            var nuevaFecha = sap.ui.getCore().byId("_iReemplazoFechaEntrega").getValue();
            this._DialogEditarFechaEntrega.close();
            this._DialogEditarFechaEntrega.destroy();
            this._DialogEditarFechaEntrega = null;
            var sPath = this.getView().getModel().createKey("/lotesSet", {
                pedido: vPedido,
                posicion: vPosicion,
                materialLote: vMaterialLote
            });

            this.getView().setBusy(true);
            var oEntidad = {
                pedido: vPedido,
                posicion: vPosicion,
                materialLote: vMaterialLote,
                nombre: "",
                cultivo: "",
                variedad: "",
                fechaCosecha: "",
                fechaEntrega: nuevaFecha,
                estado: "",
                aporteActual: "",
                credito: "",
                rindeEsperado: "",
                potencialRinde: "",
                zona: "",
                total: "",
                provincia: "",
                localidad: "",
                ha: "",
                operacion: "F",
                motivo: ""
            };

            this.getView().getModel().update(sPath, oEntidad, {
                success: function (resultado) {
                    MessageToast.show("Fecha Modificada correctamente");
                    this.getView().setBusy(false);
                    //this.obtenerLotes(vPedido);
                    this.onSelection();
                }.bind(this),
                error: function (error) {
                    MessageToast.show("No se pudo modificar la Fecha");
                    oController.getView().setBusy(false);
                }
            });
        },

        obtenerLotes: function (sOjectId) {
            var sPath = this.getModel().createKey("lotesSet", {
                pedido: vPedido,
                posicion: "1",
                materialLote: "material"
            });

            this.getModel().read(sPath, {
                success: function (oData) {
                    var oModelLotes = new JSONModel();
                    oModelLotes.setProperty("/lotesSet", oData.results);
                    oController.getView().byId("table").setModel(oModelLotes);
                },
                error: function () {
                    sap.m.MessageToast.show("Error al cargar Materiales a Aprobar");
                }
            });
            var sPath = this.getModel().createKey("lotesSet", {
                pedido: vPedido,
                posicion: "1",
                nombre: "lotes"
            });

        },

        onUpdateFinished: function () {

        },

        onCargarPDFContratos: function () {
            var vKey = this.getView().byId("cbCartaOferta").getSelectedKey();
            if (vKey) {
                var aFilters = [];
                aFilters.push(new sap.ui.model.Filter("Documento", sap.ui.model.FilterOperator.EQ, vKey));
                this.getView().getModel().read("/contratoPdfListadoSet", {
                    filters: aFilters,
                    success: function (oData) {
                        var oTableJSON = new sap.ui.model.json.JSONModel();
                        var Anexos = {
                            Datos: oData.results
                        };
                        oTableJSON.setData(Anexos);
                        this.getView().byId("__tblContratosAnexos").setModel(oTableJSON, "Anexos");
                    }.bind(this)
                });
            }
        },

        onVisualizarAnexo: function (oEvent) {

            var oItem = oEvent.getSource().getParent();
            var oTabla = oEvent.getSource().getParent().getParent();
            var oDatos = oTabla.getModel("Anexos").getProperty(oItem.getBindingContextPath());
            var lv_path;
            if (oDatos.Extension === "HTM" || oDatos.Extension === "HTML") {
                lv_path = "";
                lv_path = oDatos.Anexo;
                this.getView().byId("framePDFContrato").setContent("<iframe title=\"Anexos\" src=\"" + lv_path +
                    "\" width=\"92%\" height=\"600\" seamless></iframe>");
            } else {
                var oRootPath = jQuery.sap.getModulePath("hb4.zhb4_mispedidos");
                var sRead = oRootPath + "/sap/opu/odata/sap/ZOS_HB4_MODIFICACION_PEDIDO_SRV/contratoPdfSet('" + oDatos.Anexo + "')/" + "$" + "value";
                this.getView().byId("framePDFContrato").setContent("<iframe title=\"Contrato\" src=\"" + sRead +
                    "\" width=\"92%\" height=\"600\" seamless></iframe>");
            }
        },

        onAnularLote: function (oEvent) {
            //vPedido = oEvent.getSource().getBindingContext().getProperty("pedido");
            //vPosicion = oEvent.getSource().getBindingContext().getProperty("posicion");
            //vMaterialLote = oEvent.getSource().getBindingContext().getProperty("materialLote");
            vPedido = oEvent.getSource().getParent().getParent().getCells()[11].getText();
            vPosicion = oEvent.getSource().getParent().getParent().getCells()[12].getText();
            vMaterialLote = oEvent.getSource().getParent().getParent().getCells()[13].getText();
            if (!oController._DialogMotivoAnular) {
                oController._DialogMotivoAnular = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.Anular", oController);
                var i18nModel = new sap.ui.model.resource.ResourceModel({
                    bundleUrl: "i18n/i18n.properties"
                });
                oController._DialogMotivoAnular.setModel(i18nModel, "i18n");
            }

            //sap.ui.getCore().byId("_iMotivoRechazo").setModel(oController.getView().getModel());
            sap.ui.getCore().byId("_iMotivoAnular").setValue(null);
            oController._DialogMotivoAnular.open();
        },

        onAnular: function () {
            if (sap.ui.getCore().byId("_iMotivoAnular").getValue()) {
                if (!this.oAnularDialog) {
                    this.oAnularDialog = new Dialog({
                        type: DialogType.Message,
                        title: "Confirmación Anulación",
                        content: new Text({
                            text: "¿Confirma Solicitud de Anulación de Lote?"
                        }),
                        beginButton: new Button({
                            type: ButtonType.Emphasized,
                            text: "Confirmar",
                            press: function () {
                                oController.onConfirmaAnular();
                                this.oAnularDialog.close();
                            }.bind(this)
                        }),
                        endButton: new Button({
                            text: "Cancelar",
                            press: function () {
                                this.oAnularDialog.close();
                            }.bind(this)
                        })
                    });
                }

                this.oAnularDialog.open();
            } else {
                MessageToast.show("Debe ingresar el motivo de solicitud de anulación de Lote");
            }

        },

        onConfirmaAnular: function () {
            var motivo = sap.ui.getCore().byId("_iMotivoAnular").getValue();
            var sPath = this.getView().getModel().createKey("/lotesSet", {
                pedido: vPedido,
                posicion: vPosicion,
                materialLote: vMaterialLote
            });

            oController._DialogMotivoAnular.close();
            oController._DialogMotivoAnular.destroy();
            oController._DialogMotivoAnular = null;
            this.getView().setBusy(true);
            var oEntidad = {
                pedido: vPedido,
                posicion: vPosicion,
                materialLote: vMaterialLote,
                nombre: "",
                cultivo: "",
                variedad: "",
                fechaCosecha: "",
                fechaEntrega: "",
                estado: "",
                aporteActual: "",
                credito: "",
                rindeEsperado: "",
                potencialRinde: "",
                zona: "",
                total: "",
                provincia: "",
                localidad: "",
                ha: "",
                operacion: "B",
                motivo: motivo
            };

            this.getView().getModel().update(sPath, oEntidad, {
                success: function (resultado) {
                    MessageToast.show("Solicitud de anulación enviada correctamente");
                    this.getView().setBusy(false);
                    //this.obtenerLotes(vPedido);
                    this.onSelection();
                }.bind(this),
                error: function (error) {
                    MessageToast.show("No se pudo enviar la solicitud");
                    oController.getView().setBusy(false);
                }
            });
        },

        onCancelarAnular: function () {
            oController._DialogMotivoAnular.close();
            oController._DialogMotivoAnular.destroy();
            oController._DialogMotivoAnular = null;
        },

        // NUEVO LOTE -----------------------------------------------------------------------------------------------------------
		_showObjectNuevoLote: function (oItem) {

                this.setModel(this.getOwnerComponent().getModel("lotesMDL"), "lotesMdl");  //modelo de los lotes
                this.setModel(this.getOwnerComponent().getModel("landingMDL"), "landingMdl"); //modelo de la landing
                this.setModel(this.getOwnerComponent().getModel("dataMDL"), "dataMdl"); //modelo de la landing
                this.setModel(this.getOwnerComponent().getModel("rindesMDL"), "rindesMdl");
                this.setModel(this.getOwnerComponent().getModel("personalMDL"), "personalMdl");
                this.setModel(new JSONModel, "viewLoteMdl");  //modelo temporal para lotes

                this.getModel("landingMdl").setSizeLimit(9999);

                var oCopiar = {copiar: false};
                this.setModel(new JSONModel(oCopiar), "copiarMdl");

                this._operacion = null;
                this.map = null;
                this.map2 = null;
                this.valorGlugo = 0;
                this._precioFuturoTrigo = 1;
                this._precioFuturoSoja = 1;     
                this.glufoTrigo = "";
                this.glufoSoja = "";         
                this.cultivo = "";    //@nueva  
                var aData = [];

                this.getView().getModel().read("/businessPartnerSet", {
                    success: function (resultado) {
                        this.datosPersonalesLanding(resultado);
                    }.bind(this),
                    error: function (error) {
                    }
                });
        },

        datosPersonalesLanding: function (data) {

            var oData = {
                partner: data.results[0].partner,
                cuit: data.results[0].cuit,
                apellido: data.results[0].apellido,
                mail: data.results[0].mail,
                nombre: data.results[0].nombre,
                razonSocial: data.results[0].razonSocial,
                domFiscalCalle: "",
                //domFiscalNro: "",
                domFiscalNumero: "",
                domFiscalPiso: "",
                domFiscalDepto: "",
                codigoPostal: "",
                localidadKey: "",
                localidadText: "",
                //telFijo: "",
                //telMovil: "",
                telefono: "",
                movil: "",
                mailAlternativo: ""
            };

            this.getModel("personalMdl").setData(oData);

            this.getLinks();

            this.getPreciosFuturos();  //precio de soja y trigo a futuro  

            this._operacion = "crear";
            //this.getView().bindElement({path : sPath, model: "viewLoteMdl"});  
            let oDataCrear = {
                loteLanding: false,
                loteLandingCompleto: false,
                nombreCampo: "",
                provincia: "",
                provinciaCode: "",
                localidad: "",
                localidadCode: "",
                cultivo: "",
                cultivoCode: "",
                variedad: "",
                variedadCode: "",
                hectareas: 1.00,
                zona: "",
                rindeEsperado: "",
                coordPoligono: "",
                coordEntrega: "",
                fechaSiembra: "",
                fechaEntrega: "",
                contactoNombre: "",
                contactoTel: "",
                direccionEntrega: "",
                grabado: "",
                highlight: "",
                materialLote: "",
                conversor: 1,
                aporte: 0,
                potencialRinde: 1,
                precioMaterialLote: 0,   //@cambio
                observaciones: "",
                map: null,
                map2: null,
                drawingManager: null,
                coordEdit: [],
                insumos: [],   
                //@nueva
                hectareasTotales: "",
                direccionEntregaSem: "",     
                coordEntregaSemilla: "",
                insumosInfo: []
                //                                 
                };               
        
            this.getModel("viewLoteMdl").setData(oDataCrear);  //modelo temporal para lotes

            this._configurarCampos("crear");
        },

        getCultivos: function () {
            this.getView().getModel().read("/cultivoSet", {
                success: function (oData, oResponse) {
                    this.getView().setModel(new JSONModel(oData.results), "MatchCultivos");
                }.bind(this),
                error: function (oError) { }
            });
        },
        //links de anexos
        getLinks: function () {

            this.getView().getModel().callFunction("/ObtenerFecha", {
                urlParameters: {},
                success: function (oDataReturn, oResponse) {
                    /* this.byId("linkAnexo3").setHref(oDataReturn.LinkAnexo3);
                    this.byId("linkAnexo4").setHref(oDataReturn.LinkAnexo4);
                    this.byId("linkAnexo5").setHref(oDataReturn.LinkAnexo5);
                    this.byId("linkAnexo6").setHref(oDataReturn.LinkAnexo6); */
                    this.microstarTrigo = oDataReturn.MicrostarTrigo;
                    this.microstarSoja = oDataReturn.MicrostarSoja;
                    this.glufoTrigo = oDataReturn.GlufoTrigo;
                    this.glufoSoja = oDataReturn.GlufoSoja;
                }.bind(this),
                error: function (oError) {

                }.bind(this)
            });
        },

        getPreciosFuturos: function () {
            var oPersonal = this.getModel("personalMdl");
            //var oPersonal = this.getModel("personalMdl").getData( );

            var sPath = "/PreciosPrefijadosPorCuit(cuit='" + oPersonal.getData().cuit + "',cultivo_ID='TR')/precio";

            //chequeo primero hay un precio por cuit de lo contrario obtengo el precio como siempre
            this.getModel("landingMdl").read(sPath, {
                success: function (oDataReturn, oResponse) {
                    if (oDataReturn.precio === 0 || oDataReturn.precio === null) {
                        this.getModel("landingMdl").read("/Cultivos('TR')", {
                            success: function (oDataReturn, oResponse) {
                                this.obtenerPrecioFuturoTrigo(oDataReturn.simboloPrecioFuturo, oDataReturn.precioFuturoDefault);
                            }.bind(this),
                            error: function (oError) {
                            }
                        });
                    }
                    else {
                        this._precioFuturoTrigo = oDataReturn.precio;
                        console.log("Usando precio de trigo:" + this._precioFuturoTrigo);
                    }
                }.bind(this),
                error: function (oError) {
                    this.getModel("landingMdl").read("/Cultivos('TR')", {
                        success: function (oDataReturn, oResponse) {
                            this.obtenerPrecioFuturoTrigo(oDataReturn.simboloPrecioFuturo, oDataReturn.precioFuturoDefault);
                        }.bind(this),
                        error: function (oError) {
                        }
                    });
                }.bind(this)
            });

            var sPath = "/PreciosPrefijadosPorCuit(cuit='" + oPersonal.cuit + "',cultivo_ID='SO')/precio";

            this.getModel("landingMdl").read(sPath, {
                success: function (oDataReturn, oResponse) {
                    if (oDataReturn.precio === 0 || oDataReturn.precio === null) {
                        this.getModel("landingMdl").read("/Cultivos('SO')", {
                            success: function (oDataReturn, oResponse) {
                                this.obtenerPrecioFuturoSoja(oDataReturn.simboloPrecioFuturo, oDataReturn.precioFuturoDefault);
                            }.bind(this),
                            error: function (oError) {
                            }
                        });
                    }
                    else {
                        this._precioFuturoSoja = oDataReturn.precio;
                        console.log("Usando precio de soja:" + this._precioFuturoSoja);
                    }
                }.bind(this),
                error: function (oError) {
                    this.getModel("landingMdl").read("/Cultivos('SO')", {
                        success: function (oDataReturn, oResponse) {
                            this.obtenerPrecioFuturoSoja(oDataReturn.simboloPrecioFuturo, oDataReturn.precioFuturoDefault);
                        }.bind(this),
                        error: function (oError) {
                        }
                    });
                }.bind(this)
            });
        },

        /* Obtiene el valor del precio futuro activo configurado en /Cultivos('SO')/simboloPrecioFuturo */
        obtenerPrecioFuturoSoja: function (simbolo, precioDefault) {
            var sPath = this.getModel("landingMdl").createKey("/PreciosFuturosActuales", {
                simbolo: simbolo
            });

            this.getView().getModel("landingMdl").read(sPath, {
                success: function (oData) {
                    this._precioFuturoSoja = parseFloat(oData.precio);
                    console.log("Usando precio de soja:" + this._precioFuturoSoja);

                }.bind(this),
                error: function (oError) {
                    // poner precio por defecto del cultivo
                    this._precioFuturoSoja = parseFloat(precioDefault);
                    console.log("Usando precio de soja:" + this._precioFuturoSoja);
                }.bind(this)
            })
        },

        obtenerPrecioFuturoTrigo: function (simbolo, precioDefault) {
            var sPath = this.getModel("landingMdl").createKey("/PreciosFuturosActuales", {
                simbolo: simbolo
            });

            this.getView().getModel("landingMdl").read(sPath, {
                success: function (oData) {
                    this._precioFuturoTrigo = parseFloat(oData.precio);
                    console.log("Usando precio de trigo:" + this._precioFuturoTrigo);
                }.bind(this),
                error: function (oError) {
                    // poner precio por defecto del cultivo
                    this._precioFuturoTrigo = parseFloat(precioDefault);
                    console.log("Usando precio de trigo:" + this._precioFuturoTrigo);
                }.bind(this)
            })
        },

        //Configurar los campos a mostrar
        _configurarCampos: function (sOperacion) {
            if (sOperacion === "crear") {
                if (!this._DialogNuevoLote) {
                    this._DialogNuevoLote = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.AgregarLote", this);
                    var i18nModel = new sap.ui.model.resource.ResourceModel({
                        bundleUrl: "i18n/i18n.properties"
                    });
                }
                this._DialogNuevoLote.setModel(i18nModel, "i18n");
                this._DialogNuevoLote.setModel(this.getView().getModel("MatchCultivos"), "MatchCultivos");
                this._DialogNuevoLote.setModel(this.getView().getModel("viewLoteMdl"), "viewLoteMdl");
                this._DialogNuevoLote.setModel(this.getView().getModel("landingMdl"), "landingMdl");
                this._inicializarNuevo();
                this.getFechasDesde("Nuevo");
                this._DialogNuevoLote.open();
            }
        },

        _inicializarNuevo: function () {
            this.byIdFragment("iNombreN").setValueState("Error");
            this.byIdFragment("lblCultivoN").setVisible(false);
            this.byIdFragment("cboCultivoN").setVisible(false);
            this.byIdFragment("lblProvN").setVisible(false);
            this.byIdFragment("cboProvinciaN").setVisible(false);
            this.byIdFragment("lblLocalidadN").setVisible(false);
            this.byIdFragment("cboLocalidadN").setVisible(false);
            this.byIdFragment("lblVariedadN").setVisible(false);
            this.byIdFragment("cboVariedadN").setVisible(false);
            this.byIdFragment("linkVariedad").setVisible(false);
            this.byIdFragment("lblHectareasN").setVisible(false);
            this.byIdFragment("iHectareasN").setVisible(false);
            this.byIdFragment("lblRindeN").setVisible(false);
            this.byIdFragment("iRindeN").setVisible(false);
            this.byIdFragment("lblFechaSiembraN").setVisible(false);
            this.byIdFragment("dpFechaSiembraN").setVisible(false);
            //@nueva
            this.byIdFragment("btnMapaN").setVisible(false);
            this.byIdFragment("iHectareasTotalesN").setVisible(false);
            this.byIdFragment("lblHectareasTotalesN").setVisible(false);     
            //       
        },

        getFechasDesde: function (sOperacion) {

            this.getModel().callFunction("/ObtenerFecha", {
                urlParameters: {},
                success: function (oDataReturn, oResponse) {
                    sap.ui.getCore().byId("dpFechaSiembraN").setMinDate(oDataReturn.SiembraDesde);
                    sap.ui.getCore().byId("dpFechaEntregaN").setMinDate(oDataReturn.EntregaDesde);
                    sap.ui.getCore().byId("linkVariedad").setHref(oDataReturn.LinkVariedades);
                    this.glufoTrigo = oDataReturn.GlufoTrigo;
                    this.glufoSoja = oDataReturn.GlufoSoja;
                }.bind(this),
                error: function (oError) {

                }.bind(this)
            });

        },

        //NUEVO
        onIngresoNombreCampo: function (oEvent) {
            //chequeo que ingrese al menos 3 aracteres para habilitar los demas controles
            if (oEvent.getSource().getValue().length < 3) return;

            oEvent.getSource().setValueState("None");
            sap.ui.getCore().byId("lblCultivoN").setVisible(true);
            sap.ui.getCore().byId("cboCultivoN").setVisible(true);
        },

        //Al seleccionar un cultivo...cargo las provincias
        onSeleccionarCultivo: function (oEvent) {
            var aFilters = [];
            var sCultivo = oEvent.getSource().getSelectedKey();

            aFilters.push(new Filter("cultivo_ID", FilterOperator.EQ, sCultivo));

            //Agrego los filtros al binding del combo
            sap.ui.getCore().byId("cboProvinciaN").setSelectedKey(null);
            sap.ui.getCore().byId("cboProvinciaN").getBinding("items").filter(aFilters);

            sap.ui.getCore().byId("lblProvN").setVisible(true);
            sap.ui.getCore().byId("cboProvinciaN").setVisible(true);   
            
            //@nueva
            var oModel = this.getModel("viewLoteMdl");
            oModel.setProperty("/cultivo", oEvent.getParameter("selectedItem").getText());               
        },

        //Al seleccionar una provincia...cargo las localidades
        onSeleccionarProvincia: function (oEvent) {
            var aFilters = [];
            var sProvincia = oEvent.getSource().getSelectedKey();
            var sCultivo = sap.ui.getCore().byId("cboCultivoN").getSelectedKey();

            aFilters.push(new Filter("cultivo_ID", FilterOperator.EQ, sCultivo));
            aFilters.push(new Filter("provincia_ID", FilterOperator.EQ, sProvincia));

            //Agrego los filtros al binding del combo
            sap.ui.getCore().byId("cboLocalidadN").setSelectedKey(null);
            sap.ui.getCore().byId("cboLocalidadN").getBinding("items").filter(aFilters);

            sap.ui.getCore().byId("lblLocalidadN").setVisible(true);
            sap.ui.getCore().byId("cboLocalidadN").setVisible(true);           
            
            //@nueva
            var oModel = this.getModel("viewLoteMdl");
            oModel.setProperty("/provincia", oEvent.getParameter("selectedItem").getText());            
        },

        //Al seleccionar una localidad...cargo las variedades
        onSeleccionarLocalidad: function (oEvent) {
            var aFilters = [];
            var sLocalidad = oEvent.getSource().getSelectedKey();
            var sCultivo = sap.ui.getCore().byId("cboCultivoN").getSelectedKey();

            this.showBusyDialog("Cargando", "Obteniendo datos...");

            aFilters.push(new Filter("cultivo_ID", FilterOperator.EQ, sCultivo));
            aFilters.push(new Filter("localidad_ID", FilterOperator.EQ, sLocalidad));

            //Agrego los filtros al binding del combo
            sap.ui.getCore().byId("cboVariedadN").setSelectedKey(null);
            sap.ui.getCore().byId("cboVariedadN").getBinding("items").filter(aFilters);

            sap.ui.getCore().byId("lblVariedadN").setVisible(true);
            sap.ui.getCore().byId("cboVariedadN").setVisible(true);
            sap.ui.getCore().byId("linkVariedad").setVisible(true);

            //potencial de rinde
            var sPath = "/Localidades('" + sLocalidad + "')/region";

            this.getModel("landingMdl").read(sPath, {
                success: this._okRegionCB.bind(this),
                error: this._errorRegionCB.bind(this)
            });        
            
            //@nueva
            var oModel = this.getModel("viewLoteMdl");
            oModel.setProperty("/localidad", oEvent.getParameter("selectedItem").getText());                
            //        
                                
        },         
        
        _okRegionCB: function(oDataReturn, oResponse){
            var oData = this.getModel("viewLoteMdl").getData();

            oData.potencialRinde = oDataReturn.potencialRinde;

            if (oData.potencialRinde === undefined || oData.potencialRinde === null) oData.potencialRinde = "";

            this.hideBusyDialog();
        },

        _errorRegionCB: function (oError) {
            this.hideBusyDialog();
        },

        onSeleccionarVariedad: function (oEvent) {
            sap.ui.getCore().byId("lblHectareasN").setVisible(true);
            sap.ui.getCore().byId("iHectareasN").setVisible(true);
            sap.ui.getCore().byId("lblRindeN").setVisible(true);
            sap.ui.getCore().byId("iRindeN").setVisible(true);
            sap.ui.getCore().byId("lblFechaSiembraN").setVisible(true);
            sap.ui.getCore().byId("dpFechaSiembraN").setVisible(true);

            //@nueva
            this.byIdFragment("lblMapaN").setVisible(true);
            this.byIdFragment("btnMapaN").setVisible(true);        
            this.byIdFragment("iHectareasTotalesN").setVisible(true);
            this.byIdFragment("lblHectareasTotalesN").setVisible(true);

            var oModel = this.getModel("viewLoteMdl");
            oModel.setProperty("/variedad", oEvent.getParameter("selectedItem").getText());                
            //

            this.getInsumos();
        },

        getRindes: function () {
            this.getModel("landingMdl").read("/DensidadesMaterial", {
                success: this._okRindesCB.bind(this),
                error: this._errorRindesCB.bind(this)
            });
        },

        _okRindesCB: function (oDataReturn, oResponse) {
            this.getModel("rindesMdl").setData(oDataReturn.results);
        },

        _errorRindesCB: function (oError) {

        },

        getInsumos: function () {
            var aFilters = [];
            var sVariedad = sap.ui.getCore().byId("cboVariedadN").getSelectedKey();

            aFilters.push(new Filter("variedad_ID", FilterOperator.EQ, sVariedad));
            this.getRindes();  //datos de rindes de material
            this.getCloudConfig(); // @nico
            this.getModel("landingMdl").read("/MaterialesPorVariedad", {
                filters: aFilters,
                urlParameters: { "$expand": "materialChico" },
                success: this._okInsumosCB.bind(this),
                error: this._errorInsumosCB.bind(this)
            });
        },

        getCloudConfig: function () {
            this.getModel("landingMdl").read("/Configuraciones");
        },

        _okInsumosCB: function (oDataReturn, oResponse) {
            var oData = this.getModel("viewLoteMdl").getData();
            var aRindes = this.getModel("rindesMdl").getData();  //@cambio 

            oData.insumos = [];

            oDataReturn.results.forEach((oMaterial) => {
                let aOpciones = [];  //@cambio 
                let fDensidad = 0;  //@cambio 
                let bDensidadRecomendada = false;  //@cambio 

                //densidad recomendada y fosforo y dosis  //@cambio 
                for (let i = 0; i < aRindes.length; i++) {
                    let oOpciones = {};


                    if (oMaterial.material_ID === aRindes[i].material_ID) {
                        if (bDensidadRecomendada === false) {
                            fDensidad = aRindes[i].densidadRecomendada;
                            bDensidadRecomendada = true;
                        }

                        if (oMaterial.tipoDeMaterial_ID !== "C" && aRindes[i].descripcion !== "No") {  //la opciones solo aplican a insumos
                            oOpciones = JSON.parse(JSON.stringify(aRindes[i]));
                            aOpciones.push(oOpciones);
                        }
                    }
                }

                let oDataInsumos = {
                    material: oMaterial.material_ID,
                    descripcion: oMaterial.descripcion,
                    descripcionLarga: oMaterial.descripcionLarga,
                    mostrarEnPantalla: oMaterial.mostrarEnPantalla || false,
                    cultivoCode: oMaterial.cultivo_ID,
                    tipoMaterial: oMaterial.tipoDeMaterial_ID,
                    densidad: oMaterial.densidad,
                    variedadCode: oMaterial.variedad_ID,
                    cantidad: fDensidad,     //0,
                    conversor: oMaterial.conversor,
                    opciones: aOpciones,  //@cambio
                    mostrarOpciones: false, //@cambio
                    precio: oMaterial.precio, //@cambio
                    descripcionDensidades: oMaterial.descripcionDensidades, //@cambio
                    orden: oMaterial.orden, //@cambio      
                    unidadMedidaPrecio: oMaterial.unidadMedidaPrecio, //@cambio 
                    densidadEditable: oMaterial.densidadEditable,
                    esGlufo: false,
                    agregarGlufo: false,
                    cantidadGlufoOriginal: 0,
                    tipoDeInsumo_ID: oMaterial.tipoDeInsumo_ID, // @nico pasar estos campos
                    materialChico: oMaterial.materialChico, // @nico pasar estos campos
                    materialChico_ID: oMaterial.materialChico_ID, // @nico pasar estos campos
                };

                //@cambio
                if (aOpciones.length > 1) oDataInsumos.mostrarOpciones = true;

                //cambio
                if (oMaterial.tipoDeMaterial_ID === "S" && oMaterial.mostrarEnPantalla === true) oDataInsumos.orden = 0;

                //if(oMaterial.descripcion.slice(0,9) === "Microstar") oDataInsumos.densidadEditable = false;

                // if (oMaterial.descripcion.slice(0, 5) === "Glufo" || oMaterial.material_ID === this.glufoTrigo || oMaterial.material_ID === this.glufoSoja) {
                // @nico
                if (oMaterial.tipoDeInsumo_ID === "G") {
                    oDataInsumos.esGlufo = true;
                    oDataInsumos.cantidadGlufoOriginal = oDataInsumos.cantidad; //@glufo  
                    oDataInsumos.cantidad = 0;  //@glufo    
                }

                //la cosecha no va como insumo
                if (oMaterial.tipoDeMaterial_ID !== "C") {
                    oData.insumos.push(oDataInsumos);
                    //oData.insumos = oDataInsumos;
                }

                //cosecha = material del lote
                if (oMaterial.tipoDeMaterial_ID === "C") {
                    this.getModel("viewLoteMdl").setProperty("/materialLote", oMaterial.material_ID);
                    oData.precioMaterialLote = oMaterial.precio;  //@cambio
                    oData.conversor = oMaterial.conversor;   //@prd
                }
            });

            this.getModel("viewLoteMdl").refresh();

            if (oDataReturn.length === 0) {
                MessageBox.show(
                    "Ha ocurrido un error al cargar los insumos, por favor vuelva a recargar la página", {
                    icon: MessageBox.Icon.ERROR,
                    title: "Ha ocurrido un error",
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (oAction) {
                        this.navBack();
                    }.bind(this)
                }
                );
            }

            //@nueva
            this.mostrarInfoInsumos();              
            
        },

        _errorInsumosCB: function (oError) {
            MessageBox.show(
                "Ha ocurrido un error al cargar los insumos, por favor vuelva a recargar la página", {
                icon: MessageBox.Icon.ERROR,
                title: "Ha ocurrido un error",
                actions: [MessageBox.Action.OK],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (oAction) {
                    this.navBack();
                }.bind(this)
            }
            );
        },

        //actualizo el campo cantidad segun la opcion seleccionada
        onOpcionesInsumos: function (oEvent) {
            var oParent = oEvent.getSource().getParent();
            oParent = oParent.getParent();
            var sPath = oParent.getBindingContextPath() + "/cantidad";

            this.getModel("viewLoteMdl").setProperty(sPath, oEvent.getSource().getSelectedKey());
            this.getModel("viewLoteMdl").refresh();

            this._liveChangeCantidad();
        },

        onLiveChangeCantidad: function (oEvent) {
            this._liveChangeCantidad();
        },

        _liveChangeCantidad: function () {
            var oData = this.getModel("viewLoteMdl").getData();
            var fAporte = 0;
            var fAporteAux = 0;
            var fPrecioFuturo = 0;
            var fHa = 1;
            fHa = parseFloat(oData.hectareas);


            oData.insumos.forEach((oInsumo) => {
                fAporteAux = this.calcularAporteInsumo(oInsumo, fHa);
                fAporte += fAporteAux;


                // glufo
                let fCantidadOriginal = parseFloat(oInsumo.cantidadGlufoOriginal);

                if (oInsumo.tipoDeInsumo_ID === "G" && oInsumo.agregarGlufo === true) {  //@glufo glufo + agreggar glufo
                    //oInsumo.cantidad = fCantidadOriginal;  //@prd
                    if (oInsumo.densidadEditable === false) {  //@prd
                        oInsumo.cantidad = fCantidadOriginal;
                    }
                    if (oInsumo.densidadEditable === true && oInsumo.cantidad === 0) {  //@prd
                        oInsumo.cantidad = fCantidadOriginal;
                    }
                } else if (oInsumo.tipoDeInsumo_ID === "G" && oInsumo.agregarGlufo === false) {  //@glufo glufo + no glufo
                    oInsumo.cantidad = 0;
                }


            });

            if (oData.cultivoCode === "SO") fPrecioFuturo = parseFloat(this._precioFuturoSoja);
            if (oData.cultivoCode === "TR") fPrecioFuturo = parseFloat(this._precioFuturoTrigo);

            fAporte = ((fAporte * 1000) / fPrecioFuturo) / fHa;

            oData.aporte = Math.ceil(fAporte).toFixed(2);   //redondeo hacia arriba
            this.getModel("viewLoteMdl").refresh();

            //@nueva
            this.mostrarInfoInsumos();               
        },

        // @nico nuevo metodo que calcula el aporte de un insumo
        calcularAporteInsumo: function (oInsumo, fHa) {
            var fCantidad = 0;
            var fCantidadMaterialChico = 0;
            //(oInsumo.material, oInsumo.tipoMaterial, oInsumo.conversor, oLote.rindeEsperado, oLote.hectareas, oInsumo.cantidad, oInsumo.mostrarEnPantalla, oInsumo.esGlufo, oInsumo.agregarGlufo)
            var fConversor = parseFloat(oInsumo.conversor);
            var fCantidadDensidadAux = parseFloat(oInsumo.cantidad);
            var fResto = 0;
            var fPrecio = parseFloat(oInsumo.precio);
            var fAporte = 0;
            var fHectareasPurga = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/HECTAREAS_PURGA")) || 3; // hectareas de purga a restar para calculo de semillas
            var fMinHectareasParaBigbag = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/MIN_HECTAREAS_PARA_SOLO_BIGBAG")) || 150; // minimo hectareas para enviar bigbag de semillas
            var fMargenRedondeoBigbag = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/MARGEN_REDONDEO_BIGBAG")) || 0.4; // menor a este valor redondea bigbag para abajo, si no para arriba

            // dejar calculadas las hectareas que se toman para semilla
            var fHaSemillas = fHa; // - fHectareasPurga; ya no se restan las 3 de purga
            var fConversorMaterialChico = oInsumo.materialChico ? parseFloat(oInsumo.materialChico.conversor) : 1;
            var fPrecioMaterialChico = (oInsumo.materialChico && oInsumo.materialChico.precio) ? parseFloat(oInsumo.materialChico.precio) : 0;

            if (!oInsumo.mostrarEnPantalla) {
                return 0;
            }
            switch (oInsumo.tipoMaterial) {
                //Cosecha se ignora
                case "C":
                    break;
                //Semilla, componente BBG (grande 700kg)
                case "S":

                    if (oInsumo.mostrarEnPantalla) {
                        // es un material grande (tiene versión chica cargada)
                        fCantidad = (fHaSemillas * fCantidadDensidadAux) / fConversor;
                        fResto = fCantidad % 1;

                        if (fHaSemillas >= fMinHectareasParaBigbag) {
                            // pedidos con más de minHectareasParaBigbag se mandan solo bigbag redondeados segun margenRedondeoBigbag
                            if (fResto >= fMargenRedondeoBigbag) {
                                // redondear para arriba
                                fCantidad = Math.ceil(fCantidad);
                            } else {
                                // redondear para abajo
                                fCantidad = Math.floor(fCantidad);
                            }
                        }
                        else {
                            //  pedidos con menos de minHectareasParaBigbag se mandan bigbag redondeado para abajo y se completa con bolsas del material chico
                            fCantidad = Math.floor(fCantidad);

                            // calcular cantidad de bolsas chicas si está cargado el materialChico
                            if (oInsumo.materialChico) {
                                fCantidadMaterialChico = fResto * fConversor / fConversorMaterialChico;
                                fCantidadMaterialChico = Math.ceil(fCantidadMaterialChico);
                            }

                        }

                    }

                    break; // fin Semilla

                //Purga, componente de valor fijo
                case "P":
                    fCantidad = fCantidadDensidadAux;
                    if (fCantidad === 0) {
                        fCantidad = 5;
                    }
                    break; // fin Purga

                // Insumos
                case "I":

                    switch (oInsumo.tipoDeInsumo_ID) {
                        case "M":
                            // Microstar


                            if (oInsumo.mostrarEnPantalla) {
                                // es un material grande (tiene versión chica cargada)
                                fCantidad = (fHa * fCantidadDensidadAux) / fConversor;
                                fResto = fCantidad % 1;

                                //  microstar siempre se redondea para abajo y se completa con material chico
                                fCantidad = Math.floor(fCantidad);

                                // calcular cantidad de bolsas chicas si está cargado el materialChico
                                if (oInsumo.materialChico) {
                                    fCantidadMaterialChico = fResto * fConversor / fConversorMaterialChico;
                                }

                            }
                            break; // fin Insumos Microstar

                        case "G":
                            // Glufo
                            if (oInsumo.agregarGlufo) {
                                fCantidad = fHa * oInsumo.cantidadGlufoOriginal;
                                fCantidad = fCantidad / fConversor;
                                fCantidad = Math.ceil(fCantidad);
                            }

                            break; //fin Insumos Glufo
                        default:
                            // otro insumo
                            fCantidad = fHa * fCantidadDensidadAux;
                            fCantidad = fCantidad / fConversor;
                            fCantidad = Math.ceil(fCantidad);
                            break;
                    }

                    break; // fin Insumos
            }

            // retornar aporte sumando los 2 materiales
            fAporte = fCantidad * fConversor * fPrecio
                + fCantidadMaterialChico * fConversorMaterialChico * fPrecioMaterialChico;

            if (fAporte < 0) {
                fAporte = 0;
            }
            return fAporte;

        },

        //@nueva
        //mostrar en pantalla todos los insumos
        mostrarInfoInsumos: function(){
            var oData = this.getModel("viewLoteMdl").getData();
            var fHa = parseFloat(oData.hectareas);
            var fAporte = parseFloat(oData.aporte);
            var aInfo = [];

            oData.insumos.forEach( (oInsumo)=>{
                let oDataInfo = {};

                let oResult = this.getInfoInsumosCantidades(oInsumo, fHa);

                oDataInfo.descripcion = oInsumo.descripcion;
                oDataInfo.unidades = oResult.cantidad;
                oDataInfo.cantidad = oResult.unidades;
                oDataInfo.kgAdescontar = fAporte.toFixed(2);
                oDataInfo.totalAdescontar = (fHa * fAporte).toFixed(2);
                aInfo.push(oDataInfo);
            });

            oData.insumosInfo = aInfo;                
            this.getModel("viewLoteMdl").refresh();
        
            //this.byIdFragment("vbInfo").setVisible(true);                
        },

        //@nueva
        //cantidad de insumo (copia de calcularAporteInsumo, pero devuelve cantidad en vez de aporte)
        getInfoInsumosCantidades: function(oInsumo, fHa){
            var fCantidad = 0;
            var fCantidadMaterialChico = 0;
            //(oInsumo.material, oInsumo.tipoMaterial, oInsumo.conversor, oLote.rindeEsperado, oLote.hectareas, oInsumo.cantidad, oInsumo.mostrarEnPantalla, oInsumo.esGlufo, oInsumo.agregarGlufo)
            var fConversor = parseFloat(oInsumo.conversor);
            var fCantidadDensidadAux = parseFloat(oInsumo.cantidad);
            var fResto = 0;
            var fPrecio = parseFloat(oInsumo.precio);
            var fAporte = 0;
            var fHectareasPurga = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/HECTAREAS_PURGA")) || 3; // hectareas de purga a restar para calculo de semillas
            var fMinHectareasParaBigbag = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/MIN_HECTAREAS_PARA_SOLO_BIGBAG")) || 150; // minimo hectareas para enviar bigbag de semillas
            var fMargenRedondeoBigbag = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/MARGEN_REDONDEO_BIGBAG")) || 0.4; // menor a este valor redondea bigbag para abajo, si no para arriba

            // dejar calculadas las hectareas que se toman para semilla
            var fHaSemillas = fHa; // - fHectareasPurga; ya no se restan las 3 de purga
            var fConversorMaterialChico = oInsumo.materialChico ? parseFloat(oInsumo.materialChico.conversor) : 1;
            var fPrecioMaterialChico = (oInsumo.materialChico && oInsumo.materialChico.precio) ? parseFloat(oInsumo.materialChico.precio) : 0;
            var fUnidades = 0;

            //if (!oInsumo.mostrarEnPantalla) {
            //    return 0;
            //}
            switch (oInsumo.tipoMaterial) {
                //Cosecha se ignora
                case "C":
                    break;
                //Semilla, componente BBG (grande 700kg)
                case "S":

                    if (oInsumo.mostrarEnPantalla) {
                        // es un material grande (tiene versión chica cargada)
                        fCantidad = (fHaSemillas * fCantidadDensidadAux) / fConversor;
                        fResto = fCantidad % 1;

                        if (fHaSemillas >= fMinHectareasParaBigbag) {
                            // pedidos con más de minHectareasParaBigbag se mandan solo bigbag redondeados segun margenRedondeoBigbag
                            if (fResto >= fMargenRedondeoBigbag) {
                                // redondear para arriba
                                fCantidad = Math.ceil(fCantidad);
                            } else {
                                // redondear para abajo
                                fCantidad = Math.floor(fCantidad);
                            }
                        }
                        else {
                            //  pedidos con menos de minHectareasParaBigbag se mandan bigbag redondeado para abajo y se completa con bolsas del material chico
                            fCantidad = Math.floor(fCantidad);

                            // calcular cantidad de bolsas chicas si está cargado el materialChico
                            if (oInsumo.materialChico) {
                                fCantidadMaterialChico = fResto * fConversor / fConversorMaterialChico;
                                fCantidadMaterialChico = Math.ceil(fCantidadMaterialChico);
                            }

                        }

                        fUnidades = fCantidad * fConversor;

                    }

                    break; // fin Semilla

                //Purga, componente de valor fijo
                case "P":
                    fCantidad = fCantidadDensidadAux;
                    //@nueva
                    /*
                    if (fCantidad === 0) {
                        fCantidad = 5;
                    }
                    */
                    //

                    fUnidades = fCantidad * fConversor;

                    break; // fin Purga

                // Insumos
                case "I":

                    switch (oInsumo.tipoDeInsumo_ID) {
                        case "M":
                            // Microstar


                            if (oInsumo.mostrarEnPantalla) {
                                // es un material grande (tiene versión chica cargada)
                                fCantidad = (fHa * fCantidadDensidadAux) / fConversor;
                                fResto = fCantidad % 1;

                                //  microstar siempre se redondea para abajo y se completa con material chico
                                fCantidad = Math.floor(fCantidad);

                                // calcular cantidad de bolsas chicas si está cargado el materialChico
                                if (oInsumo.materialChico) {
                                    fCantidadMaterialChico = fResto * fConversor / fConversorMaterialChico;
                                }

                            }

                            fUnidades = fCantidad * fConversor;

                            break; // fin Insumos Microstar

                        case "G":
                            // Glufo
                            if (oInsumo.agregarGlufo) {
                                fCantidad = fHa * oInsumo.cantidadGlufoOriginal;
                                fCantidad = fCantidad / fConversor;
                                fCantidad = Math.ceil(fCantidad);
                            }

                            fUnidades = fCantidad * fConversor;

                            break; //fin Insumos Glufo
                        default:
                            // otro insumo
                            fCantidad = fHa * fCantidadDensidadAux;
                            fCantidad = fCantidad / fConversor;
                            fCantidad = Math.ceil(fCantidad);

                            fUnidades = fCantidad * fConversor;

                            break;
                    }

                    break; // fin Insumos
            }

            var oReturn = {
                cantidad: fCantidad,
                unidades: fUnidades
            };

            return oReturn;
        },                 
            
        onChangeHectareas: function(oEvent){
            //var fHectareas = oEvent.getSource().getValue();
            var oLote = this.getModel("viewLoteMdl").getData();


            if (oLote.hectareas < this._MinimoHectareas) {  //@prd
                //if(oLote.hectareas < 50){  //@prd
                sap.m.MessageToast.show("El minimo de hectáreas es " + this._MinimoHectareas);
                return;
            }

            this._liveChangeCantidad();  //@prd

            BusyIndicator.show();

            this.getModel().callFunction("/ObtenerDisponible", {
                urlParameters: {
                    Cultivo: oLote.cultivoCode,
                    Variedad: oLote.variedadCode
                },
                success: function (oDataReturn, oResponse) {
                    BusyIndicator.hide();

                    if (oLote.hectareas <= parseFloat(oDataReturn.results[0].StockDisponible)) {
                        return;
                    }

                    MessageBox.error("No hay suficiente stock de la variedad seleccionada para cantidad de hectareas ingresadas. Intente con una cantidad de hectareas inferior o cambie de variedad", {
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK,
                        onClose: function (sAction) {
                            BusyIndicator.hide();
                        }.bind(this)
                    });
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("No hay suficiente stock de la variedad seleccionada para cantidad de hectareas ingresadas. Intente con una cantidad de hectareas inferior o cambie de variedad", {
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK,
                        onClose: function (sAction) {
                            BusyIndicator.hide();
                        }.bind(this)
                    });
                }.bind(this)
            });
        },

        onSeleccionarLugar: function (oEvent) {
            if (oEvent.getSource().getSelectedKey() === "01") {  //misma coord que lote
                if (this._operacion === "crear") sap.ui.getCore().byId("btnMapaEntregaN").setVisible(false);

                // Comentado porque no sé qué mostraría esto, no existe en el fragment
                if (this._operacion === "crear") sap.ui.getCore().byId("lblCoordEntregaN").setVisible(false);
                if (this._operacion === "crear") sap.ui.getCore().byId("iCoordEntregaN").setVisible(false);
                this._copiarUbicacionEnEntrega();
            }

            else if ((oEvent.getSource().getSelectedKey() === "02")) { //nueva coord de mapa
                if (this._operacion === "crear") sap.ui.getCore().byId("btnMapaEntregaN").setVisible(true);
            }
            //@nueva
            /*
            else if((oEvent.getSource().getSelectedKey() === "03")){ //ingresar direccion           
                if(this._operacion === "crear") sap.ui.getCore().byId("btnMapaEntregaN").setVisible(false);
                if(this._operacion === "crear") sap.ui.getCore().byId("lblCoordEntregaN").setVisible(false);
                if(this._operacion === "crear") sap.ui.getCore().byId("iCoordEntregaN").setVisible(false);                
            }         
            */
            //
        },

        //Copiar las coordenadas del poligono al Lugar de entrega
        _copiarUbicacionEnEntrega: function () {
            var oData = this.getModel("viewLoteMdl").getData();

            if (oData.coordPoligono === "" || oData.coordPoligono === null) return;

            if (this._operacion === "crear" && sap.ui.getCore().byId("cboLugarEntregaN").getSelectedKey() !== "01") return;

            var aCoord = oData.coordPoligono.split("/");

            oData.direccionEntrega = aCoord[0];
        },

        //@nueva
        //Copiar las coordenadas del poligono al Lugar de entrega de semilla
        _copiarUbicacionEnEntregaSemillaLote: function () {
            var oData = this.getModel("viewLoteMdl").getData();

            if (oData.coordPoligono === "" || oData.coordPoligono === null) return;

            if (this._operacion === "crear" && this.byIdFragment("cboLugarEntregaN").getSelectedKey() !== "01") return;

            if (this._operacion === "editar" && this.byIdFragment("cboLugarEntregaE").getSelectedKey() !== "01") return;

            var aCoord = oData.coordPoligono.split("/");

            oData.direccionEntregaSem = aCoord[0];
        },       
        
        //@nueva
        //Copiar las coordenadas del poligono al Lugar de entrega de semilla
        _copiarUbicacionEnEntregaSemillaInsumo: function () {
            var oData = this.getModel("viewLoteMdl").getData();

            if (oData.coordPoligono === "" || oData.coordPoligono === null) return;

            if (this._operacion === "crear" && this.byIdFragment("cboLugarEntregaN").getSelectedKey() !== "03") return;

            if (this._operacion === "editar" && this.byIdFragment("cboLugarEntregaE").getSelectedKey() !== "03") return;

            var aCoord = oData.coordPoligono.split("/");

            oData.direccionEntregaSem = oData.direccionEntrega;
        },           

        //Validar formato de fecha
        onChangeFecha: function (oEvent) {
            var sId = oEvent.getSource().getId();

            sap.ui.getCore().byId(sId).setValueState("None");
            /*   sap.ui.getCore().byId("msgEditar").setText("");
              sap.ui.getCore().byId("msgEditar").setVisible(false);       */

            if (oEvent.getParameter("valid") === false && (sId === "dpFechaEntregaE" || sId === "dpFechaEntregaN")) {
                /*                 sap.ui.getCore().byId("msgEditar").setText("Debe indicar una fecha de entrega valida.");
                                sap.ui.getCore().byId("msgEditar").setVisible(true);      */
                sap.ui.getCore().byId(sId).setValueState("Error");
            }
            if (oEvent.getParameter("valid") === false && (sId === "dpFechaSiembraE" || sId === "dpFechaSiembraN")) {
                /*           sap.ui.getCore().byId("msgEditar").setText("Debe indicar una fecha de siembra valida.");
                          sap.ui.getCore().byId("msgEditar").setVisible(true);   */
                sap.ui.getCore().byId(sId).setValueState("Error");
            }
        },

        //validar telefono
        onLiveChangeTel: function (oEvent) {
            //valido que solo ingrese numeros
            var bNotnumber = isNaN(oEvent.getSource().getValue());
            if (bNotnumber === true) oEvent.getSource().setValue("");
        },



        //NUEVO
        onCancelarNuevoLote: function (oEvent) {
            this._DialogNuevoLote.close();
        },

        onGuardarNuevo: function (oEvent) {
            var oData = this.getModel("viewLoteMdl").getData();   //this.getModel("lotesMdl").getData();

            //Validar datos
            if (oData.nombreCampo === "") {
                sap.m.MessageToast.show("Debe indicar un Nombre de lote", { duration: 4000 });
                sap.ui.getCore().byId("iNombreN").focus();
                return;
            }
            else if (sap.ui.getCore().byId("cboCultivoN").getSelectedKey() === "") {
                sap.m.MessageToast.show("Debe indicar Cultivo", { duration: 4000 });
                sap.ui.getCore().byId("cboCultivoN").focus();
                return;
            }
            else if (sap.ui.getCore().byId("cboProvinciaN").getSelectedKey() === "") {
                sap.m.MessageToast.show("Debe indicar Provincia", { duration: 4000 });
                sap.ui.getCore().byId("cboProvinciaN").focus();
                return;
            }
            else if (sap.ui.getCore().byId("cboLocalidadN").getSelectedKey() === "") {
                sap.m.MessageToast.show("Debe indicar Localidad", { duration: 4000 });
                sap.ui.getCore().byId("cboLocalidadN").focus();
                return;
            }
            else if (sap.ui.getCore().byId("cboVariedadN").getSelectedKey() === "") {
                sap.m.MessageToast.show("Debe indicar Variedad", { duration: 4000 });
                sap.ui.getCore().byId("cboVariedadN").focus();
                return;
            }
            else if (parseInt(oData.rindeEsperado) <= 0 || oData.rindeEsperado === NaN || oData.rindeEsperado === "") {
                sap.m.MessageToast.show("Debe indicar un Rinde", { duration: 4000 });
                sap.ui.getCore().byId("iRindeN").focus();
                return;
            }
            else if (parseInt(oData.hectareas) <= 0 || oData.hectareas === NaN || oData.hectareas === "") {
                sap.m.MessageToast.show("Debe indicar cantidad de Hectareas", { duration: 4000 });
                sap.ui.getCore().byId("iHectareasN").focus();
                return;
            }
            //else if(parseFloat(oData.hectareas) < 50){   //@prd
            else if (parseFloat(oData.hectareas) < this._MinimoHectareas) {  //@prd

                sap.m.MessageToast.show("El minimo de hectáreas es " + this._MinimoHectareas);
                return;
            }
            else if (oData.fechaSiembra === "") {
                sap.m.MessageToast.show("Debe indicar una Fecha de siembra", { duration: 4000 });
                sap.ui.getCore().byId("dpFechaSiembraN").focus();
                return;
            }
            else if (oData.coordPoligono === "") {
                sap.m.MessageToast.show("Debe indicar la Ubicación del lote (poligono)", { duration: 4000 });
                if (this._operacion === "editar") sap.ui.getCore().byId("btnMapaE").focus();
                if (this._operacion === "crear") sap.ui.getCore().byId("btnMapaN").focus();
                return;
            }
            else if (oData.fechaEntrega === "") {
                sap.m.MessageToast.show("Debe indicar una Fecha de entrega", { duration: 4000 });
                sap.ui.getCore().byId("dpFechaEntregaN").focus();
                return;
            }
            else if (oData.contactoNombre === "") {
                sap.m.MessageToast.show("Debe indicar Nombre de contacto", { duration: 4000 });
                sap.ui.getCore().byId("iContactoN").focus();
                return;
            }
            else if (oData.contactoTel === "" || oData.contactoTel.length < 10) {
                sap.m.MessageToast.show("Debe indicar un Telefono  de contacto", { duration: 4000 });
                sap.ui.getCore().byId("iTelContactoN").focus();
                return;
            }       
            else if(oData.coordEntrega === "" && oData.direccionEntrega === ""){
                sap.m.MessageToast.show("Debe indicar Lugar de entrega", {duration: 4000});
                sap.ui.getCore().byId("cboLugarEntregaN").focus();                     
                return;                    
            }     
            //@nueva
            else if (oData.coordEntregaSem === "" && oData.direccionEntregaSem === "") {
                sap.m.MessageToast.show("Debe indicar Lugar de entrega para semillas", { duration: 4000 });
                this.byIdFragment("cboLugarEntregaNSem").focus();
                return;
            }
            else if (parseInt(oData.hectareasTotales) <= 0 || oData.hectareasTotales === NaN || oData.hectareasTotales === "") {
                sap.m.MessageToast.show("Debe indicar hectáreas totales del campo", { duration: 4000 });
                this.byIdFragment("iHectareasTotalesN").focus();
                return;
            }         
            
            else if (parseInt(oData.hectareasTotales) <= 0 || oData.hectareasTotales === NaN || oData.hectareasTotales === "") {
                sap.m.MessageToast.show("Debe indicar hectáreas totales del campo", { duration: 4000 });
                this.byIdFragment("iHectareasTotalesN").focus();
                return;
            }               
            //                  
            
            
            this.getModel("viewLoteMdl").setProperty("/highlight", "Success");
            this.getModel("viewLoteMdl").setProperty("/map", this.map);
            this.getModel("viewLoteMdl").setProperty("/map2", this.map2);

            var oDataLotes = this.getModel("lotesMdl").getData();
            oDataLotes.lotes = [];
            oDataLotes.lotes.push(this.getModel("viewLoteMdl").getData());
            this.getModel("lotesMdl").refresh();

            this.getModel("dataMdl").setProperty("agregar", true);
            this.getModel("dataMdl").setProperty("confirmar", true);

            this.firmarEnmiendaNuevoLote();
            //this.navBack();                                 
        },

        //MAPAS --------------------------------------------------------------------------------------------------------------

        onVerMapaCampo: function (oEvent) {
            if (!this._oDialogMapa1) {
                Fragment.load({
                    name: "hb4.zhb4_mispedidos.view.Poligono",
                    controller: this
                }).then(function (oDialog) {
                    this._oDialogMapa1 = oDialog;
                    //this._oDialogMapa1.setModel(this.getView().getModel());
                    // this.getView().addDependent(this._oDialog);
                    //this._configDialog(oButton);
                    this.initMap();
                    this._oDialogMapa1.open();
                }.bind(this));
            } else {
                //this._configDialog(oButton);
                //this.initMap();
                this._oDialogMapa1.open();
            }
        },

        onCerrarMapa: function (oEvent) {
            this._copiarUbicacionEnEntrega();
            this._copiarUbicacionEnEntregaSemillaLote();  //@nueva
            this._oDialogMapa1.close();
        },

        onBorrarPoligono: function (oEvent) {
            var oPoligonoAnterior = sap.ui.getCore().overlaypolygon;  //obtengo el poligono anteriormente dibujado

            if (oPoligonoAnterior !== undefined) oPoligonoAnterior.setMap(null);
        },

        onVerMapaEntrega: function (oEvent) {
            if (!this._oDialogMapa2) {
                Fragment.load({
                    name: "hb4.zhb4_mispedidos.view.Entrega",
                    controller: this
                }).then(function (oDialog) {
                    this._oDialogMapa2 = oDialog;
                    //this._oDialogMapa1.setModel(this.getView().getModel());
                    // this.getView().addDependent(this._oDialog);
                    //this._configDialog(oButton);
                    this.initMap2();
                    this._oDialogMapa2.open();
                }.bind(this));
            } else {
                //this._configDialog(oButton);
                this._oDialogMapa2.open();
            }
        },

        onCerrarMapa2: function (oEvent) {
            if (this._maker2 !== undefined && this._maker2 !== null) {
                //var sCoord = this._maker2.getPosition().lat() + "@" + this._maker2.getPosition().lng();
                var sCoord = this._maker2.internalPosition.lat() + "@" + this._maker2.internalPosition.lng();

                if (this._operacion === "crear") sap.ui.getCore().byId("lblCoordEntregaN").setVisible(true);
                if (this._operacion === "crear") sap.ui.getCore().byId("iCoordEntregaN").setValue(sCoord);
                if (this._operacion === "crear") sap.ui.getCore().byId("iCoordEntregaN").setVisible(true);
            }

            this._oDialogMapa2.close();
        },

        //@nueva
        onCerrarMapa3: function (oEvent) {
            if (this.marker3 !== undefined && this.marker3 !== null) {
                //var sCoord = this._maker2.getPosition().lat() + "@" + this._maker2.getPosition().lng();
                var sCoord = this.marker3.internalPosition.lat() + "@" + this.marker3.internalPosition.lng();

                if (this._operacion === "crear") this.byIdFragment("lblCoordEntregaNSem").setVisible(true);
                if (this._operacion === "crear") this.byIdFragment("iCoordEntregaNSem").setValue(sCoord);
                if (this._operacion === "crear") this.byIdFragment("iCoordEntregaNSem").setVisible(true);

                //@persistencia
                var oDataEntrega = { lat: this.marker3.internalPosition.lat(), lng: this.marker3.internalPosition.lng() };
                this.getModel("viewLoteMdl").setProperty("/coordEntregaSemilla", oDataEntrega);
            }

            this._oDialogMapa3.close();
        },         
        
        //@nueva
        onSeleccionarLugarSemilla: function (oEvent) {
            if (oEvent.getSource().getSelectedKey() === "01") {  //misma coord que lote
                if (this._operacion === "crear") this.byIdFragment("btnMapaEntregaNSem").setVisible(false);
                if (this._operacion === "crear") this.byIdFragment("lblCoordEntregaNSem").setVisible(false);
                if (this._operacion === "crear") this.byIdFragment("iCoordEntregaNSem").setVisible(false);

                this._copiarUbicacionEnEntregaSemillaLote();
            }
            else if ((oEvent.getSource().getSelectedKey() === "02")) { //nueva coord de mapa
                if (this._operacion === "crear") this.byIdFragment("btnMapaEntregaNSem").setVisible(true);
            }
            else if ((oEvent.getSource().getSelectedKey() === "03")) { //misma coordenadas que insumos
                if (this._operacion === "crear") this.byIdFragment("btnMapaEntregaNSem").setVisible(false);                

                this._copiarUbicacionEnEntregaSemillaInsumo();
            }             
        },        

        //@nueva
        onVerMapaEntregaSemilla: function(){
            if (!this._oDialogMapa3) {
                Fragment.load({
                    name: "hb4.zhb4_mispedidos.view.EntregaSemilla",
                    controller: this
                }).then(function (oDialog) {
                    this._oDialogMapa3 = oDialog;
                    this.initMap3();
                    this._oDialogMapa3.open();
                }.bind(this));
            } else {
                this.editarMap3();    //@nuevamap
                this._oDialogMapa3.open();
            }
        },                    

        //MAPAS---------------------------------------------------------------------------
        cargarMapas: function () {
            var me = this;
            //PARA EL BAS
            //var sUrl = "ht" + "tps://maps.googleapis.com/maps/api/js?key=AIzaSyDdOmHmyYzA9OJYP_oNMVGRmW0aJxPgpWM&libraries=drawing,places&v=weekly";

            //var sUrl = "ht" + "tps://maps.googleapis.com/maps/api/js?key=AIzaSyA130U1tW8bKQxSPx_lPYiZQpW_X5KCyJQ&callback=iniciarMap&libraries=drawing&v=weekly";

            var sUrl = "ht" + "tps://maps.googleapis.com/maps/api/js?key=AIzaSyAjQU1p7l6-AtR9FRwwAkhutE4fObWoy_c&libraries=drawing,places&v=weekly";

            //var sUrl = "https://maps.googleapis.com/maps/api/js?key=AIzaSyBIwzALxUPNbatRBj3Xi1Uhp0fFzwWNBkE&callback=initMap&libraries=drawing&v=weekly"
            this.loadGoogleMaps(sUrl, this.initMap.bind(this));

        },

        //creo y cargo un nuevo script en el document
        loadGoogleMaps: function (scriptUrl, callbackFn) {
            var script = document.createElement("script");

            //en caso de querer llamar el mapa apenas se hace la peticion a la url de google, agregar este 
            //parametro a la url de google: &callback=initMap
            //y descomentar este callback
            //script.onload = function() {
            //    callbackFn();
            //}
            script.src = scriptUrl;
            document.body.appendChild(script);
        },

        //inicializo y creo los mapa con la herramientas de dibujo de poligonos, geocodificacion y marcadores
        initMap: function () {
            var oData = this.getModel("viewLoteMdl").getData();
            var that = this;

            //creo un nuevo mapa sobre el div de la vista poligono.view.html
            this.map = new google.maps.Map(document.getElementById("map"), {
                zoom: 10, //zoom por default
                center: { lat: -36.6192291, lng: -64.371276 },  //coordenadas por default
                mapTypeId: 'hybrid',  //tipo de mapa hibrido (satelite + ciudades y rutas)

                mapTypeControl: false, //deshabilitar la selección de tipo de mapa
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                    position: google.maps.ControlPosition.BOTTOM_CENTER,
                },
                zoomControl: true, //mostrar control de zoom
                zoomControlOptions: {   //ubicacion del control de zoom en pantalla
                    position: google.maps.ControlPosition.RIGHT_CENTER,
                },
                streetViewControl: false,  //deshabilitar street view
                fullscreenControl: false,  //deshabilitar pantalla completa             
            }); // fin map

            //creo una instancia del geocodificador
            this.geocoder = new google.maps.Geocoder();

            //agrego el evento click al boton Buscar que aparece en el mapa
            document.getElementById("submit").addEventListener("click", () => {
                this.geocodeAddress(this.geocoder, this.map);
            });

            //posiciono el mapa inicialmente en la localidad y provincia seleccionada para el lote
            var sDireccion = oData.localidad + ", " + oData.provincia;
            this.setAddressInitial(this.geocoder, this.map, sDireccion);

            //AUTOCOMPLETE PLACES, autocompletar direcciones en la busqueda
            var oInput = document.getElementById("address");
            var oOptions = {
                types: [],
                componentRestrictions: { country: 'ar' }
            };

            var autocomplete = new google.maps.places.Autocomplete(oInput, oOptions);

            //document.getElementById("dibujar").addEventListener("click", () => {
            //    sap.ui.getCore().drawingManager.setOptions({drawingControl: true});
            //    sap.m.MessageToast.show("Se ha habilitado la herramienta de dibujo de poligono");
            //})                

            //creo la herramienta de dibujo
            this.drawingManager = new google.maps.drawing.DrawingManager({
                drawingMode: google.maps.drawing.OverlayType.POLYGON, //modo de dibujo para poligonos
                drawingControl: true,  //mostrar control de dibujo
                drawingControlOptions: {  //opciones del control de dibujo
                    position: google.maps.ControlPosition.LEFT_CENTER,  //posicion en el mapa de la herramienta de dibujo
                    drawingModes: [ //tipos de diujos sobre el mapa que estarán habilitados
                        //google.maps.drawing.OverlayType.MARKER,
                        //google.maps.drawing.OverlayType.CIRCLE,
                        google.maps.drawing.OverlayType.POLYGON,
                        //google.maps.drawing.OverlayType.POLYLINE,
                        //google.maps.drawing.OverlayType.RECTANGLE
                    ],
                },
                markerOptions: {
                    icon:
                        "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
                },
                circleOptions: {
                    fillColor: "#F90808",
                    fillOpacity: 1,
                    strokeWeight: 5,
                    clickable: false,
                    editable: true,
                    zIndex: 1,
                },
                //estilo del poligono
                polygonOptions: {
                    fillColor: "#F90808",
                    fillOpacity: 0.2,
                    strokeColor: "#F90808",
                    draggable: true,
                    //strokeWeight: 5,
                    //clickable: true,
                    //editable: true,
                    zIndex: 1,
                },
            });

            //agrego la herramienta de dibujo al mapa creado
            this.drawingManager.setMap(this.map);

            //guardo globalmente la instancia para poder acceder a ella 
            sap.ui.getCore().drawingManager = this.drawingManager;

            //google.maps.event.addListener(this.drawingManager, 'circlecomplete', function(circle) {
            //    var radius = circle.getRadius();
            //});


            //oData.map = this.map;
            //oData.drawingManager = this.drawingManager;

            //agrego el evento overlaycomplete a la herramienta de dibujo para que cuando se complete el dibujo del poligo obtener los dato del mismo
            google.maps.event.addListener(this.drawingManager, 'overlaycomplete', function (event) {
                if (event.type == 'polygon') { //si el dibjo en el mapa es un poligo

                    let aCoordEdit = [];  //@map

                    var oPoligonoAnterior = sap.ui.getCore().overlaypolygon;  //obtengo el poligono anteriormente dibujado
                    //var oPoligonoAnterior = this.overlaypolygon;

                    if (oPoligonoAnterior !== undefined) oPoligonoAnterior.setMap(null);  //borro el poligono anterior para que solo haya un solo poligono dibujado en pantalla

                    //sap.ui.getCore().drawingManager.setOptions({drawingControl: false});   //oculto herramienta de dibujo
                    sap.ui.getCore().overlaypolygon = event.overlay;     //guardo el poligono a nivel global                
                    //this.overlaypolygon = event.overlay;

                    var aCoordenadas = event.overlay.getPath(); //obtengo todas las coordenadas del poligono
                    var sCoord = "";

                    //guardo las coordenadas del poligono y las muestro en pantalla
                    for (let i = 0; i < aCoordenadas.length; i++) {
                        sCoord = sCoord + aCoordenadas.getAt(i).lat() + "@" + aCoordenadas.getAt(i).lng() + "/";

                        let oLatLng = {}; //@map
                        oLatLng.lat = aCoordenadas.getAt(i).lat();//@map
                        oLatLng.lng = aCoordenadas.getAt(i).lng();//@map
                        aCoordEdit.push(oLatLng);//@map
                    }

                    //@nueva
                    /*
                    if(that._operacion === "crear"){
                        sap.ui.getCore().byId("iCoordLoteN").setVisible(true);
                    }
                    else {
                        sap.ui.getCore().byId("iCoordLoteE").setVisible(true);
                    }
                    */
                    //
                    
                    that.getModel("viewLoteMdl").setProperty("/coordPoligono", sCoord);
                    that.getModel("viewLoteMdl").setProperty("/coordEdit", aCoordEdit);
                    that.getModel("viewLoteMdl").refresh();
                }
            });

            if (oData.map !== null && oData.map !== undefined) {
                // Define the LatLng coordinates for the polygon's path.
                /*const triangleCoords = [
                    { lat: 25.774, lng: -80.19 },
                    { lat: 18.466, lng: -66.118 },
                    { lat: 32.321, lng: -64.757 },
                    { lat: 25.774, lng: -80.19 },
                ];*/
                // Construct the polygon.
                const oPoligono = new google.maps.Polygon({
                    paths: oData.coordEdit,    //triangleCoords,  //@map
                    //strokeColor: "#FF0000",
                    //strokeOpacity: 0.8,
                    //strokeWeight: 2,
                    //fillColor: "#FF0000",
                    //fillOpacity: 0.35,
                    fillColor: "#F90808",
                    fillOpacity: 0.2,
                    strokeColor: "#F90808",
                    draggable: true,
                    zIndex: 1
                });

                oPoligono.setMap(this.map);

                return;

            }


        },   //fin initMap


        //inicializo el mapa para la ubicacion del punto de entrega
        initMap2: function () {
            var oData = this.getModel("viewLoteMdl").getData();
            var that = this;

            if (oData.map2 !== null && oData.map2 !== undefined) {
                this.map2 = oData.map2;
                return;
            }

            this.map2 = new google.maps.Map(document.getElementById("map2"), {
                zoom: 6,
                center: { lat: -36.6192291, lng: -64.371276 },
                mapTypeId: 'hybrid',

                mapTypeControl: false,
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                    position: google.maps.ControlPosition.BOTTOM_CENTER,
                },
                zoomControl: true,
                zoomControlOptions: {
                    position: google.maps.ControlPosition.RIGHT_CENTER,
                },
                streetViewControl: false,
                fullscreenControl: false,
            }); // fin map

            this.geocoder2 = new google.maps.Geocoder();

            document.getElementById("submit2").addEventListener("click", () => {
                this.geocodeAddress2(this.geocoder2, this.map2);
            });

            //document.getElementById("dibujar").addEventListener("click", () => {
            //    sap.ui.getCore().drawingManager.setOptions({drawingControl: true});
            //    sap.m.MessageToast.show("Se ha habilitado la herramienta de dibujo de poligono");
            //})     
            
            //@nuevamap
            /*
            //posiciono el mapa inicialmente en la localidad y provincia seleccionada para el lote
            var sDireccion = oData.localidad + ", " + oData.provincia;
            document.getElementById("address2").value = sDireccion;
            this.geocodeAddress2(this.geocoder2, this.map2, sDireccion)
            */
            //

            //AUTOCOMPLETE PLACES
            /*var oInput = document.getElementById("address2");
            var oOptions = {
                types: [],
                componentRestrictions: {country: 'ar'}
            };           
            
            var autocomplete = new google.maps.places.Autocomplete(oInput, oOptions);*/
            
        },   //fin initMap2

        //@nueva
        //inicializo el mapa para la ubicacion del punto de entrega de semilla
        initMap3: function () {
            var oData = this.getModel("viewLoteMdl").getData();
            var that = this;

            var oCoordDefault = this.getCoordDefaultEntregas();

            if(oCoordDefault === "" || oCoordDefault === null || oCoordDefault === undefined){
                oCoordDefault = { lat: -36.6192291, lng: -64.371276 };
            }                

            this.map3 = new google.maps.Map(document.getElementById("map3"), {
                zoom: 10,
                center: oCoordDefault,
                mapTypeId: 'hybrid',

                mapTypeControl: false,
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                    position: google.maps.ControlPosition.BOTTOM_CENTER,
                },
                zoomControl: true,
                zoomControlOptions: {
                    position: google.maps.ControlPosition.RIGHT_CENTER,
                },
                streetViewControl: false,
                fullscreenControl: false,
            }); // fin map

            this.geocoder3 = new google.maps.Geocoder();

            document.getElementById("submit3").addEventListener("click", () => {
                this.geocodeAddress2(this.geocoder3, this.map3);
            });

            //@nuevamap
            /*
            //posiciono el mapa inicialmente en la localidad y provincia seleccionada para el lote
            if (this._operacion !== "editar") {  //@persistencia
                var sDireccion = oData.localidad + ", " + oData.provincia;
                document.getElementById("address3").value = sDireccion;
                this.geocodeAddress3(this.geocoder3, this.map3, sDireccion)
            }  //@persistencia
            */
            //

            //AUTOCOMPLETE PLACES
            var oInput = document.getElementById("address3");
            var oOptions = {
                types: [],
                componentRestrictions: {country: 'ar'}
            };           
            
            this.autocomplete3 = new google.maps.places.Autocomplete(oInput, oOptions);      

            //marcador por defecto sobre el mapa stw
            var myLatLng = oCoordDefault;

            this.marker3 = new google.maps.Marker({
                position: myLatLng,
                draggable: true                
            });

            this.marker3.setMap(this.map3);
        },   //fin initMap3        

        //buscador de direcciones para el mapa del poligono
        geocodeAddress: function (geocoder, resultsMap) {
            const address = document.getElementById("address").value;

            geocoder.geocode({ address: address, componentRestrictions: { country: "AR" } }, (results, status) => {
                if (status === "OK") {
                    resultsMap.setCenter(results[0].geometry.location);

                    if (typeof (this._maker) !== "undefined") this._maker.setMap(null);

                    this._maker = new google.maps.Marker({
                        map: resultsMap,
                        position: results[0].geometry.location,
                    });
                } else {
                    alert(
                        "Geocode was not successful for the following reason: " + status
                    );
                }
            });
        },

        //buscador de direcciones para el mapa de punto de entrega
        geocodeAddress2: function (geocoder, resultsMap) {
            const address2 = document.getElementById("address2").value;

            geocoder.geocode({ address: address2, componentRestrictions: { country: "AR" } }, (results, status) => {
                if (status === "OK") {
                    resultsMap.setCenter(results[0].geometry.location);

                    if (typeof (this._maker2) !== "undefined") this._maker2.setMap(null);

                    this._maker2 = new google.maps.Marker({
                        map: resultsMap,
                        position: results[0].geometry.location,
                        draggable: true
                    });
                } else {
                    alert(
                        "Geocode was not successful for the following reason: " + status
                    );
                }
            });
        },

        setAddressInitial: function (geocoder, resultsMap, sDireccion) {
            const address = sDireccion;

            geocoder.geocode({ address: address, componentRestrictions: { country: "AR" } }, (results, status) => {
                if (status === "OK") {
                    resultsMap.setCenter(results[0].geometry.location);

                    if (typeof (this._maker) !== "undefined") this._maker.setMap(null);

                    this._maker = new google.maps.Marker({
                        map: resultsMap,
                        position: results[0].geometry.location,
                    });
                } else {
                    alert(
                        "Geocode was not successful for the following reason: " + status
                    );
                }
            });
        },

        //@nueva
        //buscador de direcciones para el mapa de punto de entrega de semilla
        geocodeAddress3: function (geocoder, resultsMap) {
            const address3 = document.getElementById("address3").value;

            geocoder.geocode({ address: address3, componentRestrictions: { country: "AR" } }, (results, status) => {
                if (status === "OK") {
                    resultsMap.setCenter(results[0].geometry.location);

                    if (typeof (this.marker3) !== "undefined") this.marker3.setMap(null);

                    this.marker3 = new google.maps.Marker({
                        map: resultsMap,
                        position: results[0].geometry.location,
                        draggable: true
                    });
                } else {
                    alert(
                        "Geocode was not successful for the following reason: " + status
                    );
                }
            });
        },       
        
        //@nueva
        getCoordDefaultEntregas: function(sPath){
            //para las entregas por default el punto de entrega es el lote dibujado en el mapa
            var oData = this.getModel("viewLoteMdl").getData();

            var oCoordenadas = {
                lat: oData.coordEdit[0].lat,
                lng: oData.coordEdit[0].lng
            }                

            return oCoordenadas;
        },         
        
// FIRMA NUEVO LOTE -----------------------------------------------------------------------------------------------
		firmarEnmiendaNuevoLote: function (oEvent) {
            if (!this.oLoteDialog) {
                this.oLoteDialog = new Dialog({
                    type: DialogType.Message,
                    title: "Confirmación Alta Lote",
                    content: new Text({
                        text: "¿Confirma el Alta de un nuevo Lote? Deberá firmar el cambio en su contrato."
                    }),
                    beginButton: new Button({
                        type: ButtonType.Emphasized,
                        text: "Confirmar",
                        icon: "sap-icon//signature",
                        press: function () {
                            oController.confirmarLoteNuevo();
                            this.oLoteDialog.close();
                        }.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cancelar",
                        press: function () {
                            this.oLoteDialog.close();
                        }.bind(this)
                    })
                });
            }

            this.oLoteDialog.open();
        },

        confirmarLoteNuevo: function (oEvent) {
            /* Requiere la libreria signaturePad.js cargada en onInit */
            //jQuery.sap.require("firma");
            /* Obtener la refrencia al objeto de la vista */
            this.imagen = sap.ui.getCore().byId("imagenFirmaEnmiendaLote");
            var url = "";
            /* Se crea el elemento SignaturePad asociado al elemento SignatureImage de la vista */
            var oSignaturePad = new firma({
                width: 380,  //300
                height: 280, //200
                imageUrl: url
            });
            /* Crea un popup cuyo contenido es el canvas de dibujo definido en SignaturePad.js */
            // @ts-ignore
            var dialog = new sap.m.Dialog({
                title: "Firma Enmienda Nuevo Lote",
                horizontalScrolling: false,
                verticalScrolling: false,
                contentWidth: "25rem",
                contentHeight: "19rem",
                resizable: false,
                draggable: true,
                showHeader: true,
                content: [oSignaturePad],
                /* Botones del popup */
                buttons: [
                    /* Boton de aceptar */
                    // @ts-ignore
                    new sap.m.Button({
                        icon: "sap-icon://accept",
                        type: sap.m.ButtonType.Accept,
                        text: !sap.ui.Device.system.phone ? "Aceptar" : "",
                        // pone texto si no es telefono
                        press: function (evt) {
                            /* Pone la imagen en el elemento SignatureImage de la vista,
                                    lo hace visible y cierra el popup*/
                            //this.imagen.setSrc(oSignaturePad.getSignature());
                            // imagen.setVisible(!imagen._isEmpty);
                            //oController.enviarFirma();
                            this.enviarFirma(oSignaturePad.getSignature());
                            dialog.close();
                        }.bind(this)
                    }),
                    /* Boton de borrar */
                    // @ts-ignore
                    new sap.m.Button({
                        icon: "sap-icon://eraser",
                        text: !sap.ui.Device.system.phone ? "Borrar" : "",
                        press: function (evt) {
                            /* Limpia el contenido del canvas y oculta la imagen */
                            oSignaturePad.clear();
                            // imagen.setVisible(false);
                        }.bind(this)
                    }),
                    /* Boton de cancelar */
                    // @ts-ignore
                    new sap.m.Button({
                        icon: "sap-icon://decline",
                        text: !sap.ui.Device.system.phone ? "Cancelar" : "",
                        press: function (evt) {
                            /* Cierra el popup de dibujo */
                            dialog.close();
                        }
                    })
                ]
            });
            dialog.open();
        },

        enviarFirma: function (vContenido) {

            var aLotesOn = this.getModel("lotesMdl").getProperty("/lotes");
            var aLotes = [], aComponentes = [], oData = {};

            sap.ui.core.BusyIndicator.show(1);

            //datos de lote y componente
            aLotesOn.forEach((oLote) => {
                let aResult = [];
                let fPrecio = 0;
                let fTotalAporte = 0;
                let sDirEntrega = "";
                let fCantidadDensidad = 0;
                let dFecha = new Date(oLote.fechaEntrega);
                let dFechaEntrega;

                if (dFecha.getMonth() < 9) {
                    dFechaEntrega = dFecha.getFullYear().toString() + "0" + (dFecha.getMonth() + 1).toString() + dFecha.getDate().toString();
                }
                else {
                    dFechaEntrega = dFecha.getFullYear().toString() + (dFecha.getMonth() + 1).toString() + dFecha.getDate().toString();
                }

                //@cambio
                ////precio
                fPrecio = parseFloat(oLote.precioMaterialLote);
                fCantidadDensidad = (parseFloat(oLote.rindeEsperado) * parseFloat(oLote.hectareas)) / oLote.conversor;

                //datos de lote
                let oDatos = {
                    pedido: oController.Pedido,
                    posicion: "0",
                    materialLote: oLote.materialLote,
                    nombre: oLote.nombreCampo,
                    cultivo: oLote.cultivo,    //oLote.cultivoCode,
                    variedad: oLote.variedad,  //oLote.variedadCode,
                    fechaCosecha: dFechaEntrega,  //oLote.fechaEntrega,
                    fechaEntrega: dFechaEntrega,  //oLote.fechaEntrega,
                    estado: "",
                    aporteActual: "",
                    credito: "",
                    rindeEsperado: oLote.rindeEsperado.toString(),
                    potencialRinde: oLote.potencialRinde.toString(),
                    zona: oLote.zona,
                    total: "",
                    provincia: oLote.provincia,  // oLote.provinciaCode,
                    localidad: oLote.localidad,  // oLote.localidadCode,
                    ha: oLote.hectareas.toString(),
                    operacion: "",
                    motivo: "",
                    nuevoAporte: oLote.aporte,
                    cantidad: fCantidadDensidad.toFixed(2),   //se determina mas abajo con los componentes
                    precio: fPrecio.toFixed(2),  //se determina mas abajo con los componentes
                    direccionEntrega: oLote.direccionEntrega,
                    coordenadasPolig: oLote.coordPoligono,
                    contactoEntrega: oLote.contactoNombre,
                    telefonoEntrega: oLote.contactoTel,
                    variedadCode: oLote.variedadCode,
                    cultivoCode: oLote.cultivoCode,
                    observaciones: oLote.observaciones

                };

                //si la direccion es una coordenada separada por @ lo reemplazo por coma
                oDatos.direccionEntrega = oDatos.direccionEntrega.replace("@", ",");

                let fPrecioFuturo = 0;
                if (oLote.cultivoCode === "SO") fPrecioFuturo = parseFloat(this._precioFuturoSoja) / 1000;
                if (oLote.cultivoCode === "TR") fPrecioFuturo = parseFloat(this._precioFuturoTrigo) / 1000;

                //@cambio
                //fTotalAporte = fTotalAporte / fPrecioFuturo;
                fTotalAporte = oLote.aporte;

                oDatos.aporteActual = fTotalAporte;   //(fTotalAporte.toFixed(2)).toString();
                aLotes.push(oDatos);

                /* @nico Mantengo la logica anterior para comparar */
                var aComponentesDani = [];
                //insumos-componentes del lote
                oLote.insumos.forEach((oInsumo) => {
                    if (oInsumo.mostrarEnPantalla === true) {
                        let fCantidad = this.conversorDeCantidad(oInsumo.material, oInsumo.tipoMaterial, oInsumo.conversor, oLote.rindeEsperado, oLote.hectareas, oInsumo.cantidad, oInsumo.mostrarEnPantalla, oInsumo.esGlufo, oInsumo.agregarGlufo);
                        if (fCantidad >= 0) {
                            let oDatosC = {
                                pedido: oController.Pedido,
                                posicion: "0",
                                materialLote: oLote.materialLote,
                                material: oInsumo.material,
                                fechaEntrega: dFechaEntrega,   //oLote.fechaEntrega,                            
                                cantidadPedir: fCantidad.toFixed(2),
                                um: "",
                                nuevoAporte: "",
                                descripcion: "",
                                densidad: parseFloat(oInsumo.cantidad).toFixed(2) // @nico guardar densidad de insumo
                            };
                            aComponentesDani.push(oDatosC);
                        }
                    }
                });  //fin foreach insumos 

                oLote.insumos.forEach((oInsumo) => {
                    if (oInsumo.mostrarEnPantalla === false) {
                        let fCantidad = this.conversorDeCantidad(oInsumo.material, oInsumo.tipoMaterial, oInsumo.conversor, oLote.rindeEsperado, oLote.hectareas, oInsumo.cantidad, oInsumo.mostrarEnPantalla, oInsumo.esGlufo, oInsumo.agregarGlufo);

                        if (fCantidad >= 0) {
                            let oDatosC = {
                                pedido: oController.Pedido,
                                posicion: "0",
                                materialLote: oLote.materialLote,
                                material: oInsumo.material,
                                fechaEntrega: dFechaEntrega,   //oLote.fechaEntrega,                            
                                cantidadPedir: fCantidad.toFixed(2),
                                um: "",
                                nuevoAporte: "",
                                descripcion: "",
                                densidad: parseFloat(oInsumo.cantidad).toFixed(2) // @nico guardar densidad de insumo
                            };

                            aComponentesDani.push(oDatosC);
                        }
                    }
                });  //fin foreach insumos      

                oLote.insumos.forEach((oInsumo) => {

                    let oCantidades = this.conversorDeCantidadNico(oInsumo, oLote);

                    // material principal
                    if (oCantidades.fCantidad >= 0) {
                        let oDatos = {
                            pedido: oController.Pedido,
                            posicion: "0",
                            materialLote: oLote.materialLote,
                            material: oInsumo.material,
                            fechaEntrega: dFechaEntrega,   //oLote.fechaEntrega,                            
                            cantidadPedir: oCantidades.fCantidad.toFixed(2),
                            um: "",
                            nuevoAporte: "",
                            descripcion: "",
                            densidad: parseFloat(oInsumo.cantidad).toFixed(2) // @nico guardar densidad de insumo
                        };

                        aComponentes.push(oDatos);
                    }
                    if (oCantidades.fCantidadMaterialChico >= 0 && oInsumo.materialChico_ID) {
                        let oDatosChico = {

                            pedido: oController.Pedido,
                            posicion: "0",
                            materialLote: oLote.materialLote,
                            material: oInsumo.materialChico_ID,
                            fechaEntrega: dFechaEntrega,   //oLote.fechaEntrega,                           
                            cantidadPedir: oCantidades.fCantidadMaterialChico.toFixed(2),
                            um: "",
                            nuevoAporte: "",
                            descripcion: "",
                            densidad: parseFloat(oInsumo.cantidad).toFixed(2) // @nico guardar densidad de insumo
                        };

                        aComponentes.push(oDatosChico);
                    }
                });

            }); //fin foreach lotes

            //datos de pedido nuevo
            oData.nuevoAporte = "";
            oData.pedido = oController.Pedido;
            oData.operacion = "L";
            oData.To_Lotes = aLotes;
            oData.To_Componentes = aComponentes;

            oController.getView().getModel().create("/agregarSet", oData, {
                success: function (resultado) {
                    if (resultado.operacion === "ERROR") {
                        sap.m.MessageToast.show("Error al registrar el Nuevo Lote");
                    } else {

                        var oRootPath = jQuery.sap.getModulePath("hb4.zhb4_mispedidos");
                        var vURI = oRootPath + "/sap/opu/odata/sap/ZOS_HB4_MODIFICACION_PEDIDO_SRV/" + "enmiendaSet";
                        var vContenidoSend = vContenido.replace("data:image/jpeg;base64,", "");
                        var lv_slug = oController.Pedido + '&' + resultado.operacion + '&' + "LOTE"; //resultado.operacion es la posicion de pedido que generó
                        $.ajax({
                            type: "POST",
                            url: vURI,
                            data: vContenidoSend,
                            success: this.enviarImagenSuccess,
                            error: this.enviarImagenError,
                            beforeSend: function (XMLHttpRequest) {
                                XMLHttpRequest.setRequestHeader("x-csrf-token", this.getModel().getSecurityToken());
                                XMLHttpRequest.setRequestHeader("Content-Type", "image/jpeg");
                                XMLHttpRequest.setRequestHeader("Slug", lv_slug);
                            }.bind(this)
                        });
                    }
                    sap.ui.core.BusyIndicator.hide(1);
                }.bind(this),
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide(1);
                    sap.m.MessageToast.show("Error conexión a SAP");
                }
            });

        },

        enviarImagenSuccess: function (oDataReturn, oResponse) {
            sap.ui.core.BusyIndicator.hide(1);
            sap.m.MessageToast.show("Se ha creado y firmado exitosamente el nuevo Lote");
            oController.onCancelarNuevoLote();
            oController.onSelection();
        },

        enviarImagenError: function (oError) {
            sap.m.MessageToast.show("Error en el firmado del Lote");
        },

        //calcular las cantidades de materiales/insumos para el pedido
        conversorDeCantidad: function (sMaterial, sTipoMaterial, fConversor, fRinde, fHa, fCantidadDensidad, bVisible, bEsGlufo, bAgregarGlufo) {
            var fCantidad;

            fConversor = parseFloat(fConversor);
            fRinde = parseFloat(fRinde);
            fHa = parseFloat(fHa);
            var fCantidadDensidadAux = parseFloat(fCantidadDensidad);

            //Cosecha, material de posicion del pedido
            if (sTipoMaterial === "C") {
                fCantidad = fHa * fRinde;
                fCantidad = fCantidad / fConversor;
            }
            //Semilla, componente BBG (grande 700kg)
            else if (sTipoMaterial === "S" && bVisible === true) {
                if (fHa >= 100) { //redondeo hacia arriba
                    fCantidad = fHa * fCantidadDensidadAux;
                    fCantidad = fCantidad / fConversor;
                    fCantidad = Math.ceil(fCantidad);
                }
                else { //redondeo hacia abajo
                    fCantidad = fHa * fCantidadDensidadAux;
                    fCantidad = fCantidad / fConversor;
                    fCantidad = Math.floor(fCantidad);
                }

                this._haS = fHa;
                this._fRindeS = fRinde;
                this._fConversorS = fConversor;
                this._fCantidadDensidad = fCantidadDensidadAux;
                this._fCantidad = fCantidad;
            }
            //Semilla, componente BLS (chica 40kg)
            else if (sTipoMaterial === "S" && bVisible === false) {
                if (fConversor > 0) {
                    fCantidad = ((this._fCantidadDensidad * this._haS) - (this._fCantidad * this._fConversorS));
                    //fCantidad = fCantidad / fCantidadDensidadAux;
                    fCantidad = fCantidad / fConversor;
                    fCantidad = Math.ceil(fCantidad);
                }
                else {
                    fCantidad = 0;
                }
            }
            //Purga, componente de valor fijo
            else if (sTipoMaterial === "P") {
                //fCantidad = 5;
                fCantidad = fCantidadDensidadAux;

                if (fCantidad === 0) fCantidad = 5;
            }
            //Insumo, componente - Microstar trigo
            else if (sTipoMaterial === "I" && sMaterial === this.microstarTrigo) {
                fCantidad = fHa * fCantidadDensidadAux;
                fCantidad = Math.ceil(fCantidad);
            }
            //Insumo, componente - Microstar soja
            else if (sTipoMaterial === "I" && sMaterial === this.microstarSoja) {
                fCantidad = fHa * fCantidadDensidadAux;
                fCantidad = Math.ceil(fCantidad);
            }
            //Insumo, componente - otros
            else if (sTipoMaterial === "I") {
                fCantidad = fHa * fCantidadDensidadAux;
                fCantidad = fCantidad / fConversor;
                fCantidad = Math.ceil(fCantidad);
            }

            //glufo
            if (bEsGlufo === true && bAgregarGlufo === false) fCantidad = 0;

            return fCantidad;
        },

        conversorDeCantidadNico: function (oInsumo, oLote) {
            var fCantidad = 0;
            var fCantidadMaterialChico = 0;
            //(oInsumo.material, oInsumo.tipoMaterial, oInsumo.conversor, oLote.rindeEsperado, oLote.hectareas, oInsumo.cantidad, oInsumo.mostrarEnPantalla, oInsumo.esGlufo, oInsumo.agregarGlufo)
            var fConversor = parseFloat(oInsumo.conversor);
            var fRinde = parseFloat(oLote.rindeEsperado);
            var fHa = parseFloat(oLote.hectareas);
            var fCantidadDensidadAux = parseFloat(oInsumo.cantidad);
            var fResto = 0;

            var fHectareasPurga = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/HECTAREAS_PURGA")) || 3; // hectareas de purga a restar para calculo de semillas
            var fMinHectareasParaBigbag = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/MIN_HECTAREAS_PARA_SOLO_BIGBAG")) || 150; // minimo hectareas para enviar bigbag de semillas
            var fMargenRedondeoBigbag = parseFloat(this.getModel("landingMdl").getProperty("/Configuraciones/MARGEN_REDONDEO_BIGBAG")) || 0.4; // menor a este valor redondea bigbag para abajo, si no para arriba

            // dejar calculadas las hectareas que se toman para semilla
            var fHaSemillas = fHa - fHectareasPurga;
            var fConversorMaterialChico = oInsumo.materialChico ? parseFloat(oInsumo.materialChico.conversor) : 1;

            switch (oInsumo.tipoMaterial) {
                //Cosecha, material de posicion del pedido
                case "C":
                    fCantidad = fHa * fRinde;
                    fCantidad = fCantidad / fConversor;
                    break;
                //Semilla, componente BBG (grande 700kg)
                case "S":

                    if (oInsumo.mostrarEnPantalla) {
                        // es un material grande (tiene versión chica cargada)
                        fCantidad = (fHaSemillas * fCantidadDensidadAux) / fConversor;
                        fResto = fCantidad % 1;
                        fResto = parseFloat(fResto.toFixed(14));
                        if (fHaSemillas >= fMinHectareasParaBigbag) {
                            // pedidos con más de minHectareasParaBigbag se mandan solo bigbag redondeados segun margenRedondeoBigbag
                            if (fResto >= fMargenRedondeoBigbag) {
                                // redondear para arriba
                                fCantidad = Math.ceil(fCantidad);
                            } else {
                                // redondear para abajo
                                fCantidad = Math.floor(fCantidad);
                            }
                        }
                        else {
                            //  pedidos con menos de minHectareasParaBigbag se mandan bigbag redondeado para abajo y se completa con bolsas del material chico
                            fCantidad = Math.floor(fCantidad);

                            // calcular cantidad de bolsas chicas si está cargado el materialChico redondeado para arriba
                            if (oInsumo.materialChico) {
                                fCantidadMaterialChico = fResto * fConversor / fConversorMaterialChico;
                                fCantidadMaterialChico = Math.ceil(fCantidadMaterialChico);
                            }

                        }

                    }

                    break; // fin Semilla

                //Purga, componente de valor fijo
                case "P":
                    fCantidad = fCantidadDensidadAux;
                    if (fCantidad === 0) {
                        fCantidad = 5;
                    }
                    break; // fin Purga

                // Insumos
                case "I":

                    switch (oInsumo.tipoDeInsumo_ID) {
                        case "M":
                            // Microstar


                            if (oInsumo.mostrarEnPantalla) {
                                // es un material grande (tiene versión chica cargada)
                                fCantidad = (fHa * fCantidadDensidadAux) / fConversor;
                                fResto = fCantidad % 1;
                                fResto = parseFloat(fResto.toFixed(14));
                                //  microstar siempre se redondea para abajo y se completa con material chico
                                fCantidad = Math.floor(fCantidad);

                                // volver a multiplicar por el conversor para dejar en kilos
                                fCantidad = fCantidad * fConversor;

                                // calcular cantidad de bolsas chicas si está cargado el materialChico y multiplicarlo nuevamente por el conversor
                                if (oInsumo.materialChico) {
                                    fCantidadMaterialChico = fResto * fConversor / fConversorMaterialChico;
                                    fCantidadMaterialChico = Math.ceil(fCantidadMaterialChico) * fConversorMaterialChico;
                                }

                            }
                            break; // fin Insumos Microstar

                        case "G":
                            // Glufo
                            if (oInsumo.agregarGlufo) {
                                fCantidad = fHa * fCantidadDensidadAux;
                                fCantidad = fCantidad / fConversor;
                                fCantidad = Math.ceil(fCantidad);
                            }

                            break; //fin Insumos Glufo
                        default:
                            // otro insumo
                            fCantidad = fHa * fCantidadDensidadAux;
                            fCantidad = fCantidad / fConversor;
                            fCantidad = Math.ceil(fCantidad);
                            break;
                    }

                    break; // fin Insumos
            }

            return {
                fCantidad: fCantidad,
                fCantidadMaterialChico: fCantidadMaterialChico
            };


        }
    });
});