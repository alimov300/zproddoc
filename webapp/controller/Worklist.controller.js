sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel"],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  (Controller, JSONModel) =>
    Controller.extend("zproddoc.controller.Worklist", {
      onInit() {
        const oCtrl = this;
        const oDataModel = new JSONModel({});
        oDataModel.setProperty("/SalesOrderKey", {
          SalesOrderID: "30000634",
          SalesOrderItem: "10",
        });
        oCtrl.getView().setModel(oDataModel, "data");
      },

      onDownload() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oKey = oDataModel.getProperty("/SalesOrderKey");
        const temp = `ITP_${oKey.SalesOrderID}_${oKey.SalesOrderItem}.pdf`;
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
        const oKey = oDataModel.getProperty("/SalesOrderKey");
        oServiceModel.read("/ITPStrucSet", {
          urlParameters: { $top: "9999" },
          filters: [
            new sap.ui.model.Filter(
              "SalesOrderID",
              sap.ui.model.FilterOperator.EQ,
              oKey.SalesOrderID
            ),
            new sap.ui.model.Filter(
              "SalesOrderItem",
              sap.ui.model.FilterOperator.EQ,
              oKey.SalesOrderItem
            ),
          ],
          success(data) {
            const { results } = data;
            const itpTree = oCtrl._unflatten(results);
            oDataModel.setProperty("/itp", itpTree);
          },
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
    })
);
