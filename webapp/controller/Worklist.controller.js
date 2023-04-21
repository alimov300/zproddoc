sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/ResponsivePopover",
    "sap/m/Button",
    "sap/ui/model/BindingMode"
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */

  /* oDataModel: { globals:{ specialActivity:85 }, dispOptions:{ internalOnly:false, isExtendedDelivery:false },  SalesOrder:{}, fixedVals:{ ITPProcedure:[]... }, ActivityScope:[], itp:[tree] }
   */

  (Controller, JSONModel, Filter, FilterOperator, Popover, Button, BindingMode) =>
    Controller.extend("zproddoc.controller.Worklist", {
      onInit() {
        const oCtrl = this;
        const oDataModel = new JSONModel({});
        oDataModel.setProperty("/SalesOrder", {
          SalesOrderID: "0000079672",
          SalesOrderItem: "001040",
        });
        oDataModel.setProperty("/ActivityScope", []);

        oDataModel.setProperty("dispOptions", {
          selectedOnly: false,
          isExtendedDelivery: false,
        });
        oCtrl.getView().setModel(oDataModel, "data");
      },

      onAfterRendering() {
        const oCtrl = this;
        oCtrl.readFixedValues();
        oCtrl.onReadPos(); //temp
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

      onReadPos() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();
        oServiceModel.read(
          `/SalesOrderInfo(SalesOrderID='${oSalesOrder.SalesOrderID}',SalesOrderItem='${oSalesOrder.SalesOrderItem}')`,
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
        let aFilter = [];
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
        const sPath = par1.getSource().getBindingInfo("items").binding.getContext().getPath();
        const oObject = this.getView().getModel("data").getObject(sPath);

        const oActScope = oObject.ActivityScope
          .find((el) => el.Activity === sKey);

        if(oActScope.IsSpecial){
          debugger;

          this.getView().getModel("data").setProperty( `${sPath}/ItpProcedureDescr` ,""  );
          this.getView().getModel("data").setProperty( `${sPath}/AcceptCritDescr` ,""  );
          this.getView().getModel("data").setProperty( `${sPath}/SpecialMode` , true  );

        }else{
          this.getView().getModel("data").setProperty( `${sPath}/ItpProcedureDescr` ,oActScope.ItpProcedureDescr  );
          this.getView().getModel("data").setProperty( `${sPath}/AcceptCritDescr` ,oActScope.AcceptCritDescr  );
          this.getView().getModel("data").setProperty( `${sPath}/SpecialMode` , false  );

        }


      },

      onProcedurePress(oEvent){
        debugger;

        var oCtx = oEvent.getSource().getBindingContext(),
				oControl = oEvent.getSource();

        const sPath = oEvent.getSource().getBindingInfo("visible").binding.getBindings()[0].getContext().getPath();

        const oTextArea = new sap.m.TextArea({
          value: oEvent.getSource().getModel("data").getProperty(`${sPath}/ItpProcedureDescr`)
        } );

        this.mPopover = new Popover({
              content: [
                oTextArea
              ],
              beginButton: [ new Button({text: "save", press: this.popoverActionPress}) ],
              showHeader: false
        });

        this.mPopover.openBy(oEvent.getSource());
 
      },

      onAccCriteriaPress(oEvent){
        debugger;

        var oCtx = oEvent.getSource().getBindingContext(),
				oControl = oEvent.getSource();

        const sPath = oEvent.getSource().getBindingInfo("visible").binding.getBindings()[0].getContext().getPath();

        const oTextArea = new sap.m.TextArea({
          value: oEvent.getSource().getModel("data").getProperty(`${sPath}/AcceptCritDescr`)
        } );

        this.mPopover = new Popover({
              content: [
                oTextArea
              ],
              beginButton: [ new Button({text: "save", press: this.popoverAccCriteriaPress}) ],
              showHeader: false
        });

        this.mPopover.openBy(oEvent.getSource());

      },

      popoverActionPress(oEvent){       
        var oCtx = oEvent.getSource().getBindingContext();
				var oControl = oEvent.getSource();
				//oView = this.getView();

        let oButton = oControl.getParent().getParent().getParent()._oControl._oOpenBy;
        let sValue = oControl.getParent().getParent().getContent()[0].getValue();
        let sPath = oControl.getParent().getParent().getParent()._oControl._oOpenBy.getBindingInfo("visible").binding.getBindings(0)[0].getContext().getPath();
        let oModel = oControl.getParent().getParent().getParent()._oControl._oOpenBy.getModel("data");

        debugger;

        oModel.setProperty(`${sPath}/ItpProcedureDescr`, sValue);


        // this.getParent().getParent().getParent()._oControl._oOpenBy.getModel("data").getObject()

        oControl.getParent().getParent().getParent().close()

      },

      popoverAccCriteriaPress(oEvent){       
        var oCtx = oEvent.getSource().getBindingContext();
				var oControl = oEvent.getSource();
				//oView = this.getView();

        let oButton = oControl.getParent().getParent().getParent()._oControl._oOpenBy;
        let sValue = oControl.getParent().getParent().getContent()[0].getValue();
        let sPath = oControl.getParent().getParent().getParent()._oControl._oOpenBy.getBindingInfo("visible").binding.getBindings(0)[0].getContext().getPath();
        let oModel = oControl.getParent().getParent().getParent()._oControl._oOpenBy.getModel("data");

        debugger;

        oModel.setProperty(`${sPath}/AcceptCritDescr`, sValue);

        oControl.getParent().getParent().getParent().close()

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

      _getFixedVal(array, field) {
        return array
          .filter((el) => el.Fieldname === field)
          .map((el) => ({ value: el.Value, text: el.Text }));
      },
    })
);
