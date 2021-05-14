sap.ui.define([], function () {
	"use strict";

	return {

		/**
		 * Rounds the number unit value to 2 digits
		 * @public
		 * @param {string} sValue the number string to be rounded
		 * @returns {string} sValue with 2 digits rounded
		 */
		numberUnit: function (sValue) {
			if (!sValue) {
				return "";
			}
			return parseFloat(sValue).toFixed(2);
		},

		highlightStatus: function (sStatus) {

			switch (sStatus) {
			case "A":
				return "Error";
			case "PA" || "EP":
				return "Warning";
			case "E":
				return "Success";
			default:
				return "Information";
			}
        },

        colorTipoCultivo: function (cultivo) {
            switch (cultivo) {
                case "Trigo" || "TR": return 1;
                case "Soja" || "SO": return 7;
                default: return 1;
            }

        },

        agregarGlufo: function(sText){
            if(sText.slice(0,5) === "Glufo"){
                return true;
            }
            else{
                return false;
            }
        },

		textoStatus: function (sStatus) {
			switch (sStatus) {
			case "A":
				return "Anulado";
			case "PA":
				return "Pend. Anulacion";
			case "E":
				return "Finalizado";
			case "EP":
				return "Entrega Pendiente";
			case "P":
				return "En tratamiento";
			}
		},

        colorEstadoPedido: function (estado) {
            switch (estado) {
                case "A":
                    return sap.ui.core.ValueState.Error;
                case "PA":
                    return sap.ui.core.ValueState.Warning;
                case "E":
                    return sap.ui.core.ValueState.Success;
                case "EP":
                    return sap.ui.core.ValueState.Warning;
                case "P":
                    return sap.ui.core.ValueState.Information;
			}
        },

		stateStatus: function (sStatus) {
			var int = 0; //Success
			switch (sStatus) {
			case "A":
				int = 3;
			case "PA":
				int = 8;
			case "E":
				int = 7;
			case "EP":
				int = 6;
			case "P":
				int = 1;
			}
			return int;
		},

		visibleBotonera: function (sStatus) {

			switch (sStatus) {
			case "A":
				return false;
			case "PA":
				return false;
			case "E":
				return false;
			case "EP":
				return true;
			case "P":
				return true;
			}
		},

		visibleFechaCosecha: function (sStatus) {

			switch (sStatus) {
			case "A":
				return false;
			case "PA":
				return false;
			case "E":
				return true;
			case "EP":
				return false;
			case "P":
				return false;
			}
		},

		visibleBotoneraComp: function (sStatus) {
			var retorno = true;
			if (sStatus) {
				if (sStatus === 'A' || sStatus === 'PA' || sStatus === 'E' ) {
					retorno = false;
				} else {
					retorno = true;
				}
			}
			return retorno;
		},
		
		visibleBotonAgregar: function (sStatus) {
			var retorno = false;
			if (sStatus) {
				if (sStatus === 'X') {
					retorno = true;
				} else {
					retorno = false;
				}
			}
			return retorno;
		},

		visibleBotonSacar: function (sStatus) {
			var retorno = false;
			if (sStatus) {
				if (sStatus === 'X') {
					retorno = true;
				} else {
					retorno = false;
				}
			}
			return retorno;
		},

		visibleBotonBorrar: function (sStatus) {
			var retorno = false;
			if (sStatus) {
				if (sStatus === 'X') {
					retorno = true;
				} else {
					retorno = false;
				}
			}
			return retorno;
        },
        
		setMinDateAgregarInsumo: function (fecha) {
            var today = new Date();
            var vSetDate = new Date();
            vSetDate.setDate(today.getDate()+7);
            return vSetDate;
        },
        
        formatearMonto: function (sValue, sMoneda) {
			if (!sValue) {
				return "0";
			}
			var iValue = parseFloat(sValue);
			// La API de UI5 presenta problemas , se remplaza por codigo estandar JS
			// var oFormatter = new sap.ui.model.type.Currency();
			// return oFormatter.formatValue(["USD",iValue]);
			// var oFormatter = sap.ui.core.format.NumberFormat.getCurrencyInstance({
			// 	decimals: 2
			// });
			// return oFormatter.format(iValue);
			// Se utiliza la localización de chile
			if (sMoneda === "CLP") {
				// iValue = iValue * 100;
				var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
					minFractionDigits: 0,
					maxFractionDigits: 0,
					groupingEnabled: true,
					groupingSeparator: ".",
					decimalSeparator: ","
				});
				var temp = oNumberFormat.format(iValue);
				return temp.toLocaleString("es-CL", {
					style: 'decimal',
					maximumFractionDigits: '2'
				});

				// return iValue.toLocaleString("es-CL", {
				// 	style: 'decimal',
				// 	maximumFractionDigits: '0'
				// });
			} else {
				var oNumberFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
					minFractionDigits: 2,
					maxFractionDigits: 2,
					groupingEnabled: true,
					groupingSeparator: ".",
					decimalSeparator: ","
				});
				var temp = oNumberFormat.format(sValue);
				return temp.toLocaleString("es-CL", {
					style: 'decimal',
					maximumFractionDigits: '2'
				});
				// return iValue.toLocaleString("es-CL", {
				// 	style: 'decimal',
				// 	maximumFractionDigits: '2'
				// });
            }
        }
	};

});