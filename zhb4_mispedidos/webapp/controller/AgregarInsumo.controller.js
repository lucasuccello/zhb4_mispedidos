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
    "hb4/zhb4_mispedidos/includes/firma"
], function (BaseController, JSONModel, formatter, Filter, FilterOperator, History, Dialog, DialogType, Button, ButtonType, MessageToast,
    HorizontalLayout,
    VerticalLayout, Text, TextArea, Firma) {
    "use strict";
    var oController;
    return BaseController.extend("hb4.zhb4_mispedidos.controller.AgregarInsumo", {

        formatter: formatter,
		/**
		 * Called when a controller is instantiated and its View controls (if available) are already created.
		 * Can be used to modify the View before it is displayed, to bind event handlers and do other one-time initialization.
		 * @memberOf hb4.zhb4_mispedidos.view.agregarInsumo
		 */
        onInit: function () {
            oController = this;
            oController.aPrecios = [];
            var iOriginalBusyDelay,
                oViewModel = new JSONModel({
                    busy: true,
                    delay: 0,
                    errorInsumo: false
                });

            this.setModel(this.getOwnerComponent().getModel("landingMDL"), "landingMdl");
            this.setModel(this.getOwnerComponent().getModel("preciosMDL"), "preciosMdl");
            this.getRouter().getRoute("agregarInsumo").attachPatternMatched(this._onObjectMatched, this);
            // Store original busy indicator delay, so it can be restored later on
            iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
            this.setModel(oViewModel, "objectView");
            this.getOwnerComponent().getModel().metadataLoaded().then(function () {
                // Restore original busy indicator delay for the object view
                oViewModel.setProperty("/delay", iOriginalBusyDelay);
            });

            this.getPrecios(); //datos de precios de material
            this.getView().setBusy(true);
            this.getPreciosFuturos(); //datos de precios de material

        },

        getPrecios: function () {
            this.getModel("landingMdl").read("/Materiales", {
                success: this._okPreciosCB.bind(this),
                error: this._errorPreciosCB.bind(this)
            });
        },

        _okPreciosCB: function (oDataReturn, oResponse) {
            this.getModel("preciosMdl").setData(oDataReturn.results);
            oController.aPrecios = oDataReturn.results;

            this.validarMaterialesDeshabilitados();
        },

        _errorPreciosCB: function (oError) {
        },

        //Precios futuros
        getPreciosFuturos: function () {
            var oModel = this.getModel("landingMdl");
            // Precio futuro de soja
            oModel.read("/Cultivos('SO')", {
                success: function (oSoja) {
                    var sPath = oModel.createKey("/PreciosFuturosActuales", {
                        simbolo: oSoja.simboloPrecioFuturo
                    });
                    oModel.read(sPath, {
                        success: function (oPrecioSoja) {
                            this._precioFuturoSoja = oPrecioSoja.precio;
                            this.getView().byId("_tileSoja").setValue(this._precioFuturoSoja);
                        }.bind(this),
                        error: function () {
                            this._precioFuturoSoja = oSoja.precioFuturoDefault;
                            this.getView().byId("_tileSoja").setValue(oSoja.precioFuturoDefault);
                        }.bind(this)
                    });

                }.bind(this),
                error: function () {
                    // oViewModel.setProperty("/loadState", sap.m.LoadState.Failed);
                }.bind(this)
            });

            // Precio futuro de trigo
            oModel.read("/Cultivos('TR')", {
                success: function (oTrigo) {
                    var sPath = oModel.createKey("/PreciosFuturosActuales", {
                        simbolo: oTrigo.simboloPrecioFuturo
                    });
                    oModel.read(sPath, {
                        success: function (oPrecioTrigo) {
                            this._precioFuturoTrigo = oPrecioTrigo.precio;
                            this.getView().byId("_tileTrigo").setValue(this._precioFuturoTrigo);
                        }.bind(this),
                        error: function () {
                            this._precioFuturoTrigo = oTrigo.precioFuturoDefault;
                            this.getView().byId("_tileTrigo").setValue(oTrigo.precioFuturoDefault);
                        }.bind(this)
                    });

                }.bind(this),
                error: function () {
                    // oViewModel.setProperty("/loadState", sap.m.LoadState.Failed);
                }.bind(this)
            });

            this.getView().setBusy(false);
        },

        action: function (e) {
            var oRouter = oController.getOwnerComponent().getRouter();
            oController.getView().unbindElement();
            var oHistory = History.getInstance(),
                sPreviousHash = oHistory.getPreviousHash();
            this.getView().byId("__iconNuevoAprote").setVisible(true);
            this.getView().byId("__agregarAporteNuevo").setVisible(true);
            this.getView().byId("tableItemsAgregar").setVisible(true);
            this.getView().byId("tableDispNotificacion").setVisible(false);
            if (sPreviousHash !== undefined) {
                history.go(-1);
            } else {
                var bReplace = true;
                oRouter.navTo("componentes", {}, bReplace);
            }
        },

        _onObjectMatched: function (oEvent) {
            var pedido = oEvent.getParameter("arguments").pedido;
            oController.pedido = pedido;
            var materialLote = oEvent.getParameter("arguments").materialLote;
            oController.materialLote = materialLote;
            var posicion = oEvent.getParameter("arguments").posicion;
            oController.posicion = posicion;
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

        obtenerComponentes: function (pedido, posicion, materialLote) {
            var sPath = this.getModel().createKey("lotesSet", {
                pedido: pedido,
                posicion: posicion,
                materialLote: materialLote
            });
            sPath = "/" + sPath + "/componentesAgregadosSet";
            this.getModel().read(sPath, {
                success: function (oData) {
                    var oModelComponentes = new JSONModel();
                    oModelComponentes.setData(oData.results);
                    oController.getView().byId("tableItemsAgregar").setModel(oModelComponentes, "ComponentesAgregados");

                    this.validarMaterialesDeshabilitados();
                }.bind(this),
                error: function () {
                    sap.m.MessageToast("Error al cargar Componentes");
                }
            });

            this.getModel().callFunction("/ObtenerFecha", {
                urlParameters: {},
                success: function(oDataReturn, oResponse){
                    this.microstarTrigo = oDataReturn.MicrostarTrigo;
                    this.microstarSoja = oDataReturn.MicrostarSoja;
                    this.glufoTrigo = oDataReturn.GlufoTrigo;
                    this.glufoSoja = oDataReturn.GlufoSoja;                                                
                }.bind(this),
                error: function(oError){

                }.bind(this)
            });

        },

        /*------------------------------------------------------------------------------ */
        validarMaterialesDeshabilitados: function(){
            var oModel = oController.getView().byId("tableItemsAgregar").getModel("ComponentesAgregados");
            var oModelPrecios = this.getModel("preciosMdl");
            var aMateriales = [];
            var aComponentes = [];
            var aComponentesOk = [];
            var aResult = [];
            if(oModel === undefined || oModelPrecios === undefined){
                return;
            }


            aComponentes = oModel.getData();
            aMateriales = oModelPrecios.getData();

            if(Array.isArray(aComponentes) === false || Array.isArray(aMateriales) === false){
                return;
            }

            //valido que el material de los insumos este habilitado en el cloud
            aComponentes.forEach( (oComponente)=>{
                var bAgregarMaterial = true;

                for(let i=0; i<aMateriales.length; i++){
                    if(oComponente.material === aMateriales[i].ID){

                        if(aMateriales[i].mostrarEnPantalla === false && aMateriales[i].tipoDeInsumo_ID === "G"){  //si el glufo esta desactivado
                            bAgregarMaterial = false;
                            break;
                        }
                        else if(aMateriales[i].mostrarEnPantalla === false && aMateriales[i].tipoDeInsumo_ID === "V"){  //si el vitagrow esta desactivado
                            bAgregarMaterial = false;
                            break;
                        }
                    }                    
                }

                if(bAgregarMaterial === true){
                    aResult.push(oComponente);
                }                
            });

            oModel.setData(aResult);
            oModel.refresh();
        },
        /*------------------------------------------------------------------------------ */        

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

        onChangeCantidad: function (setteoInicial) {
            var aporteActual = parseFloat(this.getView().getBindingContext().getObject().aporteActual);
            var credito = parseFloat(this.getView().getBindingContext().getObject().credito);
            var potencialRinde = parseFloat(this.getView().getBindingContext().getObject().potencialRinde);
            var cultivo = this.getView().byId("_cultivoCode").getText();
            var fechaCosecha = this.getView().byId("_fechaCosechaMaxima").getText();
            var hectareas = this.getView().byId("_hectareasCode").getText();
            var aporteMaximo = credito * potencialRinde / 100;
            var nuevoAporte = 0.00;
            var cantidad = 0.00;
            var material = "";
            var fechaInsumo = "";
            var componentes = this.getView().byId("tableItemsAgregar").getItems();
            let fPrecioFuturo = 1;
            var errorFecha = "";
                cultivo = cultivo.substring(0, 2);
                cultivo = cultivo.toUpperCase();

            //Begin JOLU1 17.08.2021
            var flagInsumoOk = false;
            var materialesConError = [];
            var materialDesc = "";
            this.getModel("objectView").setProperty("/errorInsumo", false);
            //End JOLU1 17.08.2021

            for (var i = 0; i < componentes.length; i++) {

                //Begin JOLU1 17.08.2021
                flagInsumoOk = false;
                //End JOLU1 17.08.2021
                if (componentes[i].getCells()[3].getValue() && componentes[i].getCells()[2].getValue()) {
                    errorFecha = "";
                    fechaInsumo = componentes[i].getCells()[2].getValue();
                    cantidad = componentes[i].getCells()[3].getValue(); //cantidad del insumo
                    cantidad = parseFloat(cantidad);
                    material = componentes[i].getCells()[5].getText(); //material del insumo
                    if (this.validarFecha(fechaCosecha, fechaInsumo)) {
                        for (let j = 0; j < oController.aPrecios.length; j++) { //recorro los precios
                            if (oController.aPrecios[j].ID === material) {

                                //Begin JOLU1 17.08.2021
                                if (!isNaN(parseFloat(oController.aPrecios[j].precio))){
                                    flagInsumoOk = true;

                                    if (cultivo === "SO"){
                                        if (material === this.microstarSoja){
                                            nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * cantidad) / hectareas);
                                            break;
                                        }else{
                                            nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * oController.aPrecios[j].conversor * cantidad) / hectareas);
                                            break;
                                        }
                                    }

                                    if (cultivo === "TR"){
                                        if (material === this.microstarTrigo){
                                            nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * cantidad) / hectareas);
                                            break;
                                        }else{
                                            nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * oController.aPrecios[j].conversor * cantidad) / hectareas);
                                            break;
                                        }
                                    }
                                }
                                //End JOLU1 17.08.2021

                                // if (cultivo === "SO"){
                                //     if (material === this.microstarSoja){
                                //         nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * cantidad) / hectareas);
                                //         break;
                                //     }else{
                                //         nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * oController.aPrecios[j].conversor * cantidad) / hectareas);
                                //         break;
                                //     }
                                // }

                                // if (cultivo === "TR"){
                                //     if (material === this.microstarTrigo){
                                //         nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * cantidad) / hectareas);
                                //         break;
                                //     }else{
                                //         nuevoAporte = nuevoAporte + ((parseFloat(oController.aPrecios[j].precio) * oController.aPrecios[j].conversor * cantidad) / hectareas);
                                //         break;
                                //     }
                                // }
                            }
                        }
                    } else {
                        errorFecha = "X";
                        break;
                    }

                    //Begin JOLU1 17.08.2021
                    if(!flagInsumoOk){
                        //agrego el insumo que fallo a una lista
                        materialDesc = componentes[i].getCells()[1].getText(); //descripcion del material
                        materialesConError.push(materialDesc);
                    }
                    //End JOLU1 17.08.2021
                }
            }

            //Begin JOLU1 17.08.2021
            if(materialesConError.length > 0){
                //muestro mensaje de que algunos materiales fallaron
                var oResourceBundle = this.getResourceBundle();
                var texto = "";
                for(i = 0; i<materialesConError.length; i++){
                    if(i===0){
                        texto = "\n" + " - " + materialesConError[i];
                    } else {
                        texto = texto + "\n" + " - " + materialesConError[i];
                    }
                }
                this.getModel("objectView").setProperty("/msgErrorInsumo", oResourceBundle.getText("textoErrorInsumos", [texto]));
                this.getModel("objectView").setProperty("/errorInsumo", true);
            }
            //End JOLU1 17.08.2021

            if (errorFecha === "X") {
                MessageToast.show("Las fechas de Entrega no pueden ser mayor a la Fecha de Cosecha");
                this.getView().byId("__buttonAgregar").setEnabled(false);
            } else {
                if (cultivo === "SO") fPrecioFuturo = parseFloat(this._precioFuturoSoja) / 1000;
                if (cultivo === "TR") fPrecioFuturo = parseFloat(this._precioFuturoTrigo) / 1000;
                if (fPrecioFuturo) {
                    nuevoAporte = nuevoAporte / fPrecioFuturo;
                }

                if (nuevoAporte === 0.00) {
                    nuevoAporte = aporteActual;
                } else {
                    nuevoAporte = aporteActual + nuevoAporte;
                }
                var disponible = aporteMaximo - nuevoAporte;
                if (disponible > 0 || (disponible === 0 && setteoInicial === "")) {
                    disponible = formatter.formatearMonto(disponible, "Kg/Ha");

                    if (nuevoAporte === 0.00 || nuevoAporte === aporteActual) {
                        this.getView().byId("__agregarAporteNuevo").setNumber("?");
                        this.getView().byId("__buttonAgregar").setEnabled(false);
                    } else {
                        nuevoAporte = formatter.formatearMonto(nuevoAporte, "Kg/Ha");
                        this.getView().byId("__agregarAporteNuevo").setNumber(nuevoAporte);
                        this.getView().byId("__buttonAgregar").setEnabled(true);
                    }

                    disponible = disponible + " Kg/Ha";
                    this.getView().byId("__agregarDisponible").setText(disponible);
                } else {
                    if (setteoInicial === "X") {
                        this.noDisponible();
                    } else {
                        if (disponible < 0) {
                            MessageToast.show("No puede tener un disponible negativo, cambie sus opciones de insumos");
                        }
                    }
                }
            }
        },

        validarFecha: function (fechaMaxima, fechaIngresada) {

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

        noDisponible: function () {
            this.getView().byId("__agregarDisponible").setText("0 Kg/Ha");
            this.getView().byId("__iconNuevoAprote").setVisible(false);
            this.getView().byId("__agregarAporteNuevo").setVisible(false);
            this.getView().byId("tableItemsAgregar").setVisible(false);
            this.getView().byId("tableDispNotificacion").setVisible(true);
        },

        onUpdateFinish: function () {
            this.onChangeCantidad("X");
        },

        onPedirInsumo: function (oEvent) {

            if (!this._DialogFirmarEnmienda) {
                this._DialogFirmarEnmienda = sap.ui.xmlfragment("hb4.zhb4_mispedidos.view.Enmienda", this);
                var i18nModel = new sap.ui.model.resource.ResourceModel({
                    bundleUrl: "i18n/i18n.properties"
                });
                this._DialogFirmarEnmienda.setModel(i18nModel, "i18n");
            }

            this.obtenerBorradorEnmienda();
            this._DialogFirmarEnmienda.open();

        },

        obtenerBorradorEnmienda: function () {
            var nuevoAporte = this.getView().byId("__agregarAporteNuevo").getNumber();
            var oAgregar = {
                nuevoAporte: nuevoAporte,
                operacion: "1",
                pedido: oController.pedido
            };

            var aComponentes = [];
            var aItems = oController.getView().byId("tableItemsAgregar").getItems();
            if (aItems.length > 0) {

                for (var i = 0; i < aItems.length; i++) {
                    var oItem = aItems[i].getModel("ComponentesAgregados").getProperty(aItems[i].getBindingContextPath());
                    if (oItem.cantidadPedir > 0 && oItem.fechaEntrega) {
                        aComponentes.push({
                            pedido: oItem.pedido,
                            posicion: oItem.posicion,
                            materialLote: oItem.materialLote,
                            material: oItem.material,
                            fechaEntrega: oItem.fechaEntrega,
                            cantidadPedir: oItem.cantidadPedir,
                            um: oItem.um,
                            nuevoAporte: nuevoAporte,
                            descripcion: oItem.descripcion
                        });
                    }
                }

                if (aComponentes.length > 0) {
                    oAgregar.To_Componentes = [];
                    oAgregar.To_Componentes = aComponentes;
                    oAgregar.To_Enmienda = [];
                    oController.getView().getModel().create("/agregarSet", oAgregar, {
                        success: this.settearBorrador.bind(this),
                        error: function (oError) {
                            sap.m.MessageToast.show("Error al obtener la Enmienda");
                        }
                    });
                } else {
                    sap.m.MessageToast.show("Registros a añadir deben tener Fecha de Entrega y Cantidad Completos");
                }
            }
        },

        settearBorrador: function (oDataReturn, oResponse) {
            var sRead = "data:application/pdf;base64," + oDataReturn.To_Enmienda.results[0].Value;
            sap.ui.getCore().byId("framePDFEnmienda").setContent("<iframe title=\"Enmienda\" src=\"" + sRead +
                "\" width=\"92%\" height=\"600\" seamless></iframe>");
        },

        onFirmarEnmienda: function (oEvent) {
            this.enviarFirma("");
        }, 

        onFirmarEnmiendaOld: function (oEvent) { //NO SE USAAAAAAAAAAAAA

            
            
            /* Requiere la libreria signaturePad.js cargada en onInit */
            //jQuery.sap.require("firma");
            /* Obtener la refrencia al objeto de la vista */
            this.imagen = sap.ui.getCore().byId("imagenFirmaEnmienda");
            var url = this.imagen.getSrc();
            /* Se crea el elemento SignaturePad asociado al elemento SignatureImage de la vista */
            var oSignaturePad = new firma({
                width: 380,  //300
                height: 280, //200
                imageUrl: url
            });
            /* Crea un popup cuyo contenido es el canvas de dibujo definido en SignaturePad.js */
            var dialog = new sap.m.Dialog({
                title: "Firma",
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
            oController._DialogFirmarEnmienda.close();
            oController._DialogFirmarEnmienda.destroy();
            oController._DialogFirmarEnmienda = null;
            this.getView().setBusy(true);

            var nuevoAporte = this.getView().byId("__agregarAporteNuevo").getNumber();
            var oAgregar = {
                nuevoAporte: nuevoAporte,
                operacion: "C",
                pedido: oController.pedido
            };

            var aComponentes = [];
            var aItems = oController.getView().byId("tableItemsAgregar").getItems();
            if (aItems.length > 0) {

                for (var i = 0; i < aItems.length; i++) {
                    var oItem = aItems[i].getModel("ComponentesAgregados").getProperty(aItems[i].getBindingContextPath());
                    if (oItem.cantidadPedir > 0) {
                        aComponentes.push({
                            pedido: oItem.pedido,
                            posicion: oItem.posicion,
                            materialLote: oItem.materialLote,
                            material: oItem.material,
                            fechaEntrega: oItem.fechaEntrega,
                            cantidadPedir: oItem.cantidadPedir,
                            um: oItem.um,
                            nuevoAporte: nuevoAporte,
                            descripcion: oItem.descripcion
                        });
                    }
                }


                oAgregar.To_Componentes = [];
                oAgregar.To_Componentes = aComponentes;
                oAgregar.To_Enmienda = [];
                if (aComponentes) {
                    oController.getView().getModel().create("/agregarSet", oAgregar, {
                        success: function (resultado) {
                            if (resultado.operacion === "ERROR") {
                                oController.getView().setBusy(false);
                                sap.m.MessageToast.show("Error al registrar la Enmienda");
                            } else {
                                var oRootPath = jQuery.sap.getModulePath("hb4.zhb4_mispedidos");
                                var vURI = oRootPath + "/sap/opu/odata/sap/ZOS_HB4_MODIFICACION_PEDIDO_SRV/" + "enmiendaSet";
                                var vContenidoSend = vContenido.replace("data:image/jpeg;base64,", "");
                                var lv_slug = oController.pedido + '&' + oController.posicion + '&' + "INSUMO";
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

                        }.bind(this),
                        error: function (oError) {
                            oController.getView().setBusy(false);
                            sap.m.MessageToast.show("Error al obtener la Enmienda");
                        }
                    });
                }
            }
        },

        enviarImagenSuccess: function (oDataReturn, oResponse) {
            oController.getView().setBusy(false);
            sap.m.MessageToast.show("Se ha creado y firmado exitosamente la enmienda");
            oController.action();
        },

        enviarImagenError: function (oError) {
            oController.getView().setBusy(false);
            sap.m.MessageToast.show("Error en el firmado del contrato");
        },

        onCancelarEnmienda: function () {
            oController._DialogFirmarEnmienda.close();
            oController._DialogFirmarEnmienda.destroy();
            oController._DialogFirmarEnmienda = null;
        }

    });

});