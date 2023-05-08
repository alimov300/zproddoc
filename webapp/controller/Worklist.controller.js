sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/ResponsivePopover",
    "sap/m/Button",
    "sap/ui/model/BindingMode",
    "sap/m/MessageToast",
    "../model/formatter",
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */

  /* oDataModel: { globals:{ specialActivity:85 }, dispOptions:{ internalOnly:false, isExtendedDelivery:false },  SalesOrder:{}, SalesItems:[] fixedVals:{ ITPProcedure:[]... }, ActivityScope:[], itp:[tree] }
   */

  (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    Popover,
    Button,
    BindingMode,
    MessageToast,
    formatter
  ) =>
    Controller.extend("zproddoc.controller.Worklist", {
      formatter,
      onInit() {
        const oCtrl = this;
        const oDataModel = new JSONModel({});
        oDataModel.setProperty("/SalesOrder", {
          SalesOrderID: "",
          SalesOrderItem: "",
          Plant: "",
          ItpScope: "",
        });
        oDataModel.setProperty("/ActivityScope", []);
        oDataModel.setProperty("/SalesItems", []);

        oDataModel.setProperty("dispOptions", {
          selectedOnly: false,
          isExtendedDelivery: false,
        });
        oCtrl.getView().setModel(oDataModel, "data");
      },

      onAfterRendering() {
        const oCtrl = this;
        oCtrl.readFixedValues();
        // oCtrl.onReadPos();
      },

      readFixedValues() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oServiceModel = oCtrl.getView().getModel();
        oServiceModel.read("/DomainValuesSet", {
          urlParameters: { $top: "9999" },
          success(data) {
            const { results } = data;
            const fixedVals = {
              InspItem: oCtrl._getFixedVal(results, "ZITP_BAUTEILE"),
              ItpProcedure: oCtrl._getFixedVal(results, "ZITP_PROZEDUR"),
              AcceptCrit: oCtrl._getFixedVal(results, "ZITP_AKZEPTANZ"),
              Frequency: oCtrl._getFixedVal(results, "ZITP_FREQUENZ"),
              PCode: oCtrl._getFixedVal(results, "ZITP_TEILNAHEMCODE"),
              Location: oCtrl._getFixedVal(results, "ZITP_LOCATION"),
              DocContent: oCtrl._getFixedVal(results, "Z_DOCUMENT_CONTENT"),
            };
            oDataModel.setProperty("/fixedVals", fixedVals);
            const aGlobals = oCtrl._getFixedVal(results, "globals");
            const aGlbFlat = aGlobals.map((el) => ({ [el.value]: el.text }));
            const globals = Object.assign({}, ...aGlbFlat);
            oDataModel.setProperty("/globals", globals);
          },
        });
      },

      onReadOrder() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();
        oServiceModel.read("/SalesOrderInfoSet", {
          method: "GET",
          filters: [
            new sap.ui.model.Filter(
              "SalesOrderID",
              sap.ui.model.FilterOperator.EQ,
              oSalesOrder.SalesOrderID
            ),
          ],

          success(data) {
            const { results } = data;
            const aSalesItems = results.map((e) => ({
              SalesOrderItem: +e.SalesOrderItem,
              ItpState: e.ItpState,
            }));
            oDataModel.setProperty("/SalesItems", aSalesItems);
          },
        });
      },

      onReadPos() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();
        oServiceModel.read(
          `/SalesOrderInfoSet(SalesOrderID='${oSalesOrder.SalesOrderID}',SalesOrderItem='${oSalesOrder.SalesOrderItem}')`,
          {
            method: "GET",
            success(data) {
              oDataModel.setProperty("/SalesOrder", data);
              const aActivityScope = oDataModel.getProperty("/ActivityScope");
              if (!aActivityScope.some((el) => el.Plant === data.Plant)) {
                oCtrl.loadActivityScope(data);
              }
            },
          }
        );
      },

      onSaveITP() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();
        const aITPStruc = oDataModel.getProperty("/itp");
        const oITP = {
          SalesOrderID: oSalesOrder.SalesOrderID,
          SalesOrderItem: oSalesOrder.SalesOrderItem,
          OrderToITPStruc: oCtrl._flatten(aITPStruc),
        };
        oServiceModel.create("/SalesOrderInfoSet", oITP, {
          method: "POST",
          success() {
            MessageToast.show(this.getResourceBundle().getText("msgITPSaved"));
          },
          error() {},
        });
      },

      onDownload() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const temp = `ITP_${oSalesOrder.SalesOrderID}_${oSalesOrder.SalesOrderItem}.pdf`;
        const oServiceModel = oCtrl.getView().getModel();
        oServiceModel.read(`/ITPFormSet('${temp}')/$value`, {
          method: "GET",
          success(data) {
            const fName = data.Filename;
            const fType = data.Filetype;
            const fContent = data.Filecontent;

            File.save(fContent, fName, "pdf", fType);
          },
        });
      },

      onLoadITP() {
        const oCtrl = this;
        const oServiceModel = oCtrl.getView().getModel();
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        oServiceModel.read("/ITPStrucSet", {
          urlParameters: { $top: "9999" },
          filters: [
            new sap.ui.model.Filter(
              "SalesOrderID",
              sap.ui.model.FilterOperator.EQ,
              oSalesOrder.SalesOrderID
            ),
            new sap.ui.model.Filter(
              "SalesOrderItem",
              sap.ui.model.FilterOperator.EQ,
              oSalesOrder.SalesOrderItem
            ),
          ],
          success(data) {
            const { results } = data;
            oCtrl._enrichWithActScope(results);
            const itpTree = oCtrl._unflatten(results);
            oDataModel.setProperty("/itp", itpTree);
            oCtrl.applyFilters();
          },
        });
      },

      applyFilters() {
        //switchSelectedOnly switchExtendedDelivery
        const aFilter = [];
        const oCntrl = this;

        if (oCntrl.getView().byId("switchSelectedOnly").getState()) {
          aFilter.push(new Filter("Selected", FilterOperator.EQ, true));
        }

        if (!oCntrl.getView().byId("switchExtendedDelivery").getState()) {
          aFilter.push(
            new Filter("IsExtendedDelivery", FilterOperator.EQ, false)
          );
        }

        this.byId("treeInspPlan")
          .getBinding()
          .filter(new Filter(aFilter, true));
      },

      onSelectOnlyToggle(evt) {
        if (evt.getParameter("state")) {
          this.byId("treeInspPlan")
            .getBinding()
            .filter(new Filter("Selected", FilterOperator.EQ, true));
        } else {
          this.byId("treeInspPlan").getBinding().filter(null);
        }
      },

      onExtendedDeliveryToggle(evt) {
        if (evt.getParameter("state")) {
          this.byId("treeInspPlan")
            .getBinding()
            .filter(new Filter("IsExtendedDelivery", FilterOperator.EQ, true));
        } else {
          this.byId("treeInspPlan").getBinding().filter(null);
        }
      },

      loadActivityScope(salesOrder) {
        const oCtrl = this;
        const oSalesOrder = salesOrder;
        const oServiceModel = oCtrl.getView().getModel();
        const oDataModel = oCtrl.getView().getModel("data");
        oServiceModel.read("/ITPActScopeSet", {
          urlParameters: { $top: "9999" },
          filters: [
            new sap.ui.model.Filter(
              "SalesOrderID",
              sap.ui.model.FilterOperator.EQ,
              oSalesOrder.SalesOrderID
            ),
            new sap.ui.model.Filter(
              "SalesOrderItem",
              sap.ui.model.FilterOperator.EQ,
              oSalesOrder.SalesOrderItem
            ),
          ],
          success(data) {
            const { results } = data;
            const aActivityScope = oDataModel.getProperty("/ActivityScope");
            aActivityScope.push({
              Plant: oSalesOrder.Plant,
              Activities: results,
            });
            oDataModel.setProperty("/ActivityScope", aActivityScope);
          },
        });
      },

      onActivityChange(par1) {
        const sKey = par1.getParameter("selectedItem").getProperty("key");
        const sPath = par1
          .getSource()
          .getBindingInfo("items")
          .binding.getContext()
          .getPath();
        const oObject = this.getView().getModel("data").getObject(sPath);

        const oActScope = oObject.ActivityScope.find(
          (el) => el.Activity === sKey
        );

        if (oActScope.IsSpecial) {
          this.getView()
            .getModel("data")
            .setProperty(`${sPath}/ItpProcedureDescr`, "");
          this.getView()
            .getModel("data")
            .setProperty(`${sPath}/AcceptCritDescr`, "");
          this.getView()
            .getModel("data")
            .setProperty(`${sPath}/SpecialMode`, true);
          this.getView()
            .getModel("data")
            .setProperty(`${sPath}/IsSpecial`, true);
        } else {
          this.getView()
            .getModel("data")
            .setProperty(
              `${sPath}/ItpProcedureDescr`,
              oActScope.ItpProcedureDescr
            );
          this.getView()
            .getModel("data")
            .setProperty(`${sPath}/AcceptCritDescr`, oActScope.AcceptCritDescr);
          this.getView()
            .getModel("data")
            .setProperty(`${sPath}/SpecialMode`, false);
          this.getView()
            .getModel("data")
            .setProperty(`${sPath}/IsSpecial`, false);
        }
        // const sKey = par1.getParameter("selectedItem").getProperty("key");
        // const sPath = par1
        //   .getSource()
        //   .getBindingInfo("items")
        //   .binding.getContext()
        //   .getPath();
        // const oObject = this.getView().getModel("data").getObject(sPath);

        // const oActScope = oObject.ActivityScope.find(
        //   (el) => el.Activity === sKey
        // );

        // this.getView()
        //   .getModel("data")
        //   .setProperty(
        //     `${sPath}/ItpProcedureDescr`,
        //     oActScope.ItpProcedureDescr
        //   );
        // this.getView()
        //   .getModel("data")
        //   .setProperty(`${sPath}/AcceptCritDescr`, oActScope.AcceptCritDescr);
      },

      popoverActionPress(oEvent) {
        let oCtx = oEvent.getSource().getBindingContext();
        let oControl = oEvent.getSource();

        let oButton = oControl.getParent().getParent().getParent()
          ._oControl._oOpenBy;
        let sValue = oControl
          .getParent()
          .getParent()
          .getContent()[0]
          .getValue();
        let sPath = oControl
          .getParent()
          .getParent()
          .getParent()
          ._oControl._oOpenBy.getBindingInfo("visible")
          .binding.getBindings(0)[0]
          .getContext()
          .getPath();
        let oModel = oControl
          .getParent()
          .getParent()
          .getParent()
          ._oControl._oOpenBy.getModel("data");

        oModel.setProperty(`${sPath}/ItpProcedureDescr`, sValue);
      },

      onProcedurePress(oEvent) {
        debugger;

        let oCtx = oEvent.getSource().getBindingContext();
        let oControl = oEvent.getSource();

        const sPath = oEvent
          .getSource()
          .getBindingInfo("visible")
          .binding.getBindings()[0]
          .getContext()
          .getPath();
        //oView = this.getView();

        //const sKey = oEvent.getParameter("selectedItem").getProperty("key");
        //const sPath = oEvent.getSource().getBindingInfo("items").binding.getContext().getPath();
        //const oObject = this.getView().getModel("data").getObject(sPath);

        const oTextArea = new sap.m.TextArea({
          value: oEvent
            .getSource()
            .getModel("data")
            .getProperty(`${sPath}/ItpProcedureDescr`),
        });
        // oTextArea.bindProperty("value",{
        //   path: `${sPath}/ItpProcedureDescr`,
        //   mode: BindingMode.TwoWay,
        //   model: "data"
        // });

        if (true) {
          this.mPopover = new Popover({
            content: [oTextArea],
            beginButton: [
              new Button({ text: "save", press: this.popoverActionPress }),
            ],
            showHeader: false,
          });
        }
        this.mPopover.openBy(oEvent.getSource());

            this.mPopover = new Popover({
              content: [
                oTextArea
              ],
              beginButton: [ new Button({ icon: "sap-icon://accept", press: this.popoverActionPress}) ],
              showHeader: false
            });

          }
          this.mPopover.openBy(oEvent.getSource());
 

      },

      _enrichWithActScope(array) {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const aActScope = oDataModel
          .getProperty("/ActivityScope")
          .find((el) => el.Plant === oSalesOrder.Plant).Activities;

        array
          .filter((el) => el.Selectable)
          .forEach((el) => {
            const oLine = el;
            oLine.ActivityScope = aActScope.filter(
              (scope) =>
                scope.NodeKey === oLine.NodeKey &&
                scope.ParentNodeKey === oLine.ParentNodeKey
            );
          });
      },

      _unflatten(array, parent) {
        let tree = [];
        parent = typeof parent !== "undefined" ? parent : { NodeKey: "" };

        const children = array.filter(
          (child) => child.ParentNodeKey === parent.NodeKey
        );

        if (children.length > 0) {
          if (parent.NodeKey === "") {
            tree = children;
          } else {
            parent.children = children;
          }
          children.forEach((child) => {
            this._unflatten(array, child);
          });
        }
        return tree;
      },

      _flatten(tree) {
        const array = [];
        // parent = typeof parent !== "undefined" ? parent : { NodeKey: "" };

        tree.forEach((el) => {
          if (el.Selected) {
            array.push({
              NodeKey: el.NodeKey,
              ParentNodeKey: el.ParentNodeKey,
              InspItem: el.InspItem,
              Activity: el.Activity,
              ActivityPlnGr: el.Activity,
              IsSpecial: el.IsSpecial,
              ItpProcedure: el.ItpProcedure,
              ItpProcedureDescr: el.ItpProcedureDescr,
              AcceptCrit: el.AcceptCrit,
              AcceptCritDescr: el.AcceptCritDescr,
              DocContent: el.DocContent,
              Frequency: el.Frequency,
              PCodeInternal: el.PCodeInternal,
              PCodeCustomer: el.PCodeCustomer,
              PCodeThirdParty: el.PCodeThirdParty,
              PCodeSubVendor: el.PCodeSubVendor,
              Location: el.Location,
              isExtendedDelivery: el.isExtendedDelivery,
            });
          } else if (el.children) {
            array.push(...this._flatten(el.children));
          }
        });
        /* if (children.length > 0) {
          if (parent.NodeKey === "") {
            tree = children;
          } else {
            parent.children = children;
          }
          children.forEach((child) => {
            array.push(...this._flatten(array, child));
          });
        }  */
        return array;
      },

      _getFixedVal(array, field) {
        return array
          .filter((el) => el.Fieldname === field)
          .map((el) => ({ value: el.Value, text: el.Text }));
      },
    })
);
