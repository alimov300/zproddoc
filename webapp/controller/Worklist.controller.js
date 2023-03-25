sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */

  /* oDataModel: { globals:{ specialActivity:85 }, SalesOrder:{}, fixedVals:{ ITPProcedure:[]... }, ActivityScope:[], itp:[tree] }
   */

  (Controller, JSONModel) =>
    Controller.extend("zproddoc.controller.Worklist", {
      onInit() {
        const oCtrl = this;
        const oDataModel = new JSONModel({});
        oDataModel.setProperty("/SalesOrder", {
          //temp
          SalesOrderID: "30000634",
          SalesOrderItem: "10",
        });
        oDataModel.setProperty("/ActivityScope", []);
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
          },
        });
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
            debugger;
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

      _enrichWithActScope(array) {
        debugger;
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
