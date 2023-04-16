sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/ResponsivePopover",
    "sap/m/Button",
    "sap/ui/model/BindingMode",
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */

  /* oDataModel: { globals:{ specialActivity:85 }, dispOptions:{ internalOnly:false, isExtendedDelivery:false },  SalesOrder:{}, fixedVals:{ ITPProcedure:[]... }, ActivityScope:[], itp:[tree] }
   */

  (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    Popover,
    Button,
    BindingMode
  ) =>
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
        oCtrl.onReadPos(); // temp
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
        // switchSelectedOnly switchExtendedDelivery
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

        this.getView()
          .getModel("data")
          .setProperty(
            `${sPath}/ItpProcedureDescr`,
            oActScope.ItpProcedureDescr
          );
        this.getView()
          .getModel("data")
          .setProperty(`${sPath}/AcceptCritDescr`, oActScope.AcceptCritDescr);
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
