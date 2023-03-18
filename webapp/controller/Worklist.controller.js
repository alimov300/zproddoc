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
        oCtrl.getView().setModel(oDataModel, "data");
      },

      onDownload() {
        const oCtrl = this;
        const temp = "ITP_30000634_10.pdf";
        const oServiceModel = oCtrl.getView().getModel();
        oServiceModel.read(`/ITPFormSet('${temp}')/$value`, {
          method: "GET",
          success(data) {
            debugger;
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
        oServiceModel.read("/ITPStrucSet", {
          urlParameters: { $top: "9999" },
          success(data) {
            const { results } = data;
            const itpTree = oCtrl._unflatten(results);
            const oDataModel = oCtrl.getView().getModel("data");

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
