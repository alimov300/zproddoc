sap.ui.define([
    "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, JSONModel) {
        "use strict";

        return Controller.extend("zproddoc.controller.Worklist",  {
            onInit: function () {
              var oModel = new JSONModel();
              var str = `{
                "catalog": {
                    "clothing": {
                        "categories": [{
                            "id": "1 Fabrication Supervision",
                            "categories": [{
                                "id": "1.1 Raw Material",
                                "categories": [{
                                        "id": "1.1.1 General",
                                        "activity": "PMI - Positive Material Identification",
                                        "procedure": "EKATO Quality Assurance 20182858",
                                        "acceptCriteria": "acc. DIN EN 10204 and EKATO quality system",
                                        "record": "Test record",
                                        "frequency": "1 per lot",
                                        "code": "SW/W/H/R",
                                        "signature": ""
                                    },
                                    {
                                        "id": "1.1.2 General",
                                        "activity": "PMI - Positive Material Identification",
                                        "procedure": "EKATO Quality Assurance 20182858",
                                        "acceptCriteria": "acc. EKATO quality system",
                                        "record": "Test record",
                                        "frequency": "100%",
                                        "code": "",
                                        "signature": ""
                                    },
                                    {
                                        "id": "1.1.3 Agitator Shaft",
                                        "activity": "UT - Ultrasonic Testing",
                                        "procedure": "",
                                        "acceptCriteria": "",
                                        "record": "",
                                        "frequency": "100%",
                                        "code": "H/R",
                                        "signature": ""
                                    }
                                ]
                            },
                            {
                                "id": "1.2 Fabrication Machining",
                                "categories": [{
                                        "id": "1.2.1 General",
                                        "activity": "PMI - Positive Material Identification",
                                        "procedure": "EKATO Quality Assurance 10068393",
                                        "acceptCriteria": "acc. DIN EN 10204 and EKATO quality system",
                                        "record": "Test record",
                                        "frequency": "1 per lot",
                                        "code": "SW/W/H/R",
                                        "signature": ""
                                    },
                                    {
                                        "id": "1.2.2 General",
                                        "activity": "VT",
                                        "procedure": "KB - 57001225",
                                        "acceptCriteria": "acc. EKATO quality system",
                                        "record": "spezielle Kundenanforderungen sind vor ab mit der Prüfaufsicht abzustimmen und hier zu beschreiben",
                                        "frequency": "100%",
                                        "code": "",
                                        "signature": ""
                                    },
                                    {
                                        "id": "1.2.5 Impeller",
                                        "activity": "VI",
                                        "procedure": "",
                                        "acceptCriteria": "",
                                        "record": "",
                                        "frequency": "100%",
                                        "code": "H/R",
                                        "signature": ""
                                    }
                                ]
                            }]
                        },
                        { "id": "2 Material Certficates", "categories": [] }
                        ],
                        "sizes": [{
                                "key": "XS",
                                "value": "Extra Small"
                            },
                            {
                                "key": "S",
                                "value": "Small"
                            },
                            {
                                "key": "M",
                                "value": "Medium"
                            },
                            {
                                "key": "L",
                                "value": "Large"
                            }
                        ]
                    }
                }
            }`;
              oModel.setData(JSON.parse(str));
              this.getView().setModel(oModel);
            }
        });
    });
