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

  /* oDataModel: { globals:{ specialActivity:85 }, dispOptions:{ internalOnly:false, isExtendedDelivery:false }, HeadInfo:{}, 
  SalesOrder:{}, SalesItems:[],
  RefSalesOrder:{}, RefSalesItems:[],
  selectedProfile:'',
  fixedVals:{ ITPProcedure:[]... }, ActivityScope:[], itp:[tree],
  uiState:{ SalesRelevantOnly: true, SalesRelevantFilter[] } 
}
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
        oDataModel.setProperty("/uiState", {
          SalesRelevantOnly: false,
          SalesRelevantFilter: [],
        });
        oDataModel.setProperty("/HeadInfo", {});
        oDataModel.setProperty("/SalesOrder", {
          SalesOrderID: "",
          SalesOrderItem: "",
          Plant: "",
          ItpState: "",
        });
        oDataModel.setProperty("/RefSalesOrder", {
          SalesOrderID: "",
          SalesOrderItem: "",
        });
        oDataModel.setProperty("/ActivityScope", []);
        oDataModel.setProperty("/SalesItems", []);
        oDataModel.setProperty("/RefSalesItems", []);

        oDataModel.setProperty("dispOptions", {
          selectedOnly: false,
          isExtendedDelivery: false,
        });
        oCtrl.getView().setModel(oDataModel, "data");

        oCtrl.oDialog = sap.ui.xmlfragment(
          this.getView().getId(),
          "zproddoc.view.Profile"
        );
        oCtrl.getView().addDependent(this.oDialog);

        oCtrl.oTemplateDialog = sap.ui.xmlfragment(
          this.getView().getId(),
          "zproddoc.view.Template"
        );
        oCtrl.getView().addDependent(this.oTemplateDialog);

        oCtrl
          .getView()
          .byId("btnTemplateLoad")
          .attachPress(oCtrl.onTemplateLoad, oCtrl);
        oCtrl
          .getView()
          .byId("btnTemplateCancel")
          .attachPress(oCtrl.onTemplateCancel, oCtrl);
        oCtrl
          .getView()
          .byId("inpRefSalesOrder")
          .attachChange(oCtrl.onReadRefOrder, oCtrl);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter.getRoute("worklist").attachMatched((oEvent) => {
          this._selectItemWithId(
            oEvent.getParameter("arguments").SalesOrderID,
            oEvent.getParameter("arguments").SalesOrderItem
          );
        }, this);

        const oBus = sap.ui.getCore().getEventBus();
        oBus.subscribe("release", "itp", this.onToggleRelease, this);
      },

      _selectItemWithId(aId, aItem) {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        oDataModel.setProperty("/SalesOrder", {
          SalesOrderID: aId,
          SalesOrderItem: aItem,
        });
        Promise.all([oCtrl.onReadOrderItems(), oCtrl.onReadOrderHead()]).then(
          () => {
            oDataModel.setProperty("/SalesOrder/SalesOrderItem", aItem);
            oCtrl.onReadPos();
          }
        );
      },

      onAfterRendering() {
        const oCtrl = this;
        oCtrl.readFixedValues();
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
        // eslint-disable-next-line new-cap
        return Promise.all([oCtrl.onReadOrderItems(), oCtrl.onReadOrderHead()]);
      },

      onReadOrderItems() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();

        return new Promise((resolve) => {
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
                SalesRelevantOnly: e.SalesRelevantOnly,
                GeneralRemarks: e.GeneralRemarks,
              }));
              oDataModel.setProperty("/SalesItems", aSalesItems);
              oDataModel.setProperty("/SalesOrder", {
                SalesOrderID: oSalesOrder.SalesOrderID,
                SalesOrderItem: "",
              });
              oDataModel.setProperty("/itp", []);
              resolve();
            },
          });
        });
      },

      onReadOrderHead() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();

        return new Promise((resolve, reject) => {
          oServiceModel.read(
            `/SalesOrderHeadSet(SalesOrderID='${oSalesOrder.SalesOrderID}')`,
            {
              method: "GET",
              success(data) {
                oDataModel.setProperty("/HeadInfo", data);
                resolve();
              },
              error() {
                oDataModel.setProperty("/HeadInfo", {});
                reject();
              },
            }
          );
        });
      },

      _onCommentToggleRelease(oEvent) {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const sComments = oDataModel.getProperty("/SalesOrder/ReleaseComment");

        const oTextArea = new sap.m.Input({
          width: "127rem",
          value: sComments,
        });

        const oBtn = new Button({
          icon: "sap-icon://accept",
          press: this.popoverSaveReleasePress,
        });

        this.mPopover = new Popover({
          content: [oTextArea],
          beginButton: [oBtn],
          showHeader: false,
        });

        this.mPopover.openBy(oEvent.getSource());
      },

      onToggleRelease() {
        const oCtrl = this;
        const oSDItemSelect = this.getView().byId("selSalesOrderItem");
        const oDataModel = oCtrl.getView().getModel("data");
        const oLangModel = oCtrl.getOwnerComponent().getModel("i18n");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();

        const sPreviousState = oSalesOrder.ItpState;
        oSalesOrder.ItpState = oSalesOrder.ItpState === "P" ? "R" : "P";
        oCtrl._updateItpState(oSalesOrder.ItpState);

        oServiceModel.update(
          `/SalesOrderInfoSet(SalesOrderID='${oSalesOrder.SalesOrderID}',SalesOrderItem='${oSalesOrder.SalesOrderItem}',Profile='')`,
          {
            SalesOrderID: oSalesOrder.SalesOrderID,
            SalesOrderItem: oSalesOrder.SalesOrderItem,
            ItpState: oSalesOrder.ItpState,
            ReleaseComment: oSalesOrder.ReleaseComment,
          },
          {
            method: "PUT",
            success() {
              oSDItemSelect.setSelectedKey(+oSalesOrder.SalesOrderItem);
              if (sPreviousState !== "") {
                MessageToast.show(
                  oLangModel
                    .getResourceBundle()
                    .getText(
                      sPreviousState === "P"
                        ? "msgITPReleased"
                        : "msgITPBackToEdit"
                    )
                );
              }
            },
            error() {
              //
            },
          }
        );
      },

      onSaveToDoc() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const oServiceModel = oCtrl.getView().getModel();
        oServiceModel.callFunction("/ITPSaveToDoc", {
          method: "GET",
          urlParameters: {
            SalesOrderID: oSalesOrder.SalesOrderID,
            SalesOrderItem: oSalesOrder.SalesOrderItem,
          },
          success(data) {
            MessageToast.show(data.Message);
          },
        });
      },

      onReadRefOrder() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/RefSalesOrder");
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
            oDataModel.setProperty(
              "/RefSalesItems",
              aSalesItems.filter((el) => el.ItpState === "C")
            );
            oDataModel.setProperty("/RefSalesOrder", {
              SalesOrderID: oSalesOrder.SalesOrderID,
              SalesOrderItem: "",
            });
          },
        });
      },

      onSalesOrderSuggest(evt) {
        const oCtrl = this;
        const sTerm = evt.getParameter("suggestValue");
        const aFilters = [];
        if (sTerm) {
          aFilters.push(
            new sap.ui.model.Filter(
              "SalesOrderID",
              sap.ui.model.FilterOperator.Contains,
              sTerm
            )
          );
        }
        evt.getSource().getBinding("suggestionItems").filter(aFilters);
        evt.getSource().setFilterSuggests(false);
      },

      onReadPos() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const sProfile = oDataModel.getProperty("/selectedProfile") || "";

        const oSelectedItem = oDataModel
          .getProperty("/SalesItems")
          .find((el) => el.SalesOrderItem === +oSalesOrder.SalesOrderItem) || {
          ItpState: "",
        };

        if (oSelectedItem.ItpState === "X") {
          oDataModel.setProperty("/itp", {});
        } else {
          const oServiceModel = oCtrl.getView().getModel();
          oServiceModel.read(
            `/SalesOrderInfoSet(SalesOrderID='${oSalesOrder.SalesOrderID}',SalesOrderItem='${oSalesOrder.SalesOrderItem}',Profile='${sProfile}')`, //,salesRelevantOnly='${oUIState.SalesRelevantOnly}'
            {
              method: "GET",
              success(data) {
                oDataModel.setProperty("/SalesOrder", data);
                const aActivityScope = oDataModel.getProperty("/ActivityScope");
                if (!aActivityScope.some((el) => el.Plant === data.Plant)) {
                  oCtrl.loadActivityScope(data);
                }
                oCtrl.onLoadITP();
              },
            }
          );
        }
      },

      onProfileSave() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oLangModel = oCtrl.getOwnerComponent().getModel("i18n");
        const sProfile = oDataModel.getProperty("/selectedProfile") || "";

        if (sProfile === "") {
          MessageToast.show(
            oLangModel.getResourceBundle().getText("msgProfileMissing")
          );
          return;
        }

        oCtrl._saveITP(sProfile);
      },

      onProfileDelete(el) {
        const oBtn = this;
        const oSrc = el.getSource();

        const oItem = oSrc
          .getModel()
          .getProperty(oSrc.getBindingContext().getPath());
        const oServiceModel = oBtn.getModel();
        oServiceModel.remove(`/ITPProfileSet(Profile='${oItem.Profile}')`);

        const oLangModel = oBtn.getModel("i18n");
        MessageToast.show(
          oLangModel
            .getResourceBundle()
            .getText("msgProfileDeleted")
            .replace("&1", oItem.Profile)
        );
      },

      onProfileLoad() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oLangModel = oCtrl.getOwnerComponent().getModel("i18n");
        const sProfile = oDataModel.getProperty("/selectedProfile") || "";

        if (sProfile === "") {
          MessageToast.show(
            oLangModel.getResourceBundle().getText("msgProfileMissing")
          );
          return;
        }

        switch (sProfile) {
          case "ANTOS":
            oCtrl.onLoadITP(sProfile);
            break;

          case "TEMPLATE":
            oCtrl.onTemplate();
            break;

          default:
            oCtrl.onLoadITP(sProfile);
            break;
        }
        oCtrl.oDialog.close();
      },

      onSaveITP(oEvent) {
        this._saveITP("");
      },

      popoverSaveReleasePress(oEvent) {
        const oControl = oEvent.getSource();
        const sValue = oControl
          .getParent()
          .getParent()
          .getContent()[0]
          .getValue();

        const oDataModel = oControl
          .getParent()
          .getParent()
          .getParent()
          ._oControl._oOpenBy.getModel("data");

        oDataModel.setProperty("/SalesOrder/ReleaseComment", sValue);
        oControl.getParent().getParent().getParent().close();

        const oBus = sap.ui.getCore().getEventBus();
        oBus.publish("release", "itp", {
          id: "onRelease",
          data: {},
        });
      },

      _saveITP(sProfile) {
        const oCtrl = this;
        const oLangModel = oCtrl.getOwnerComponent().getModel("i18n");
        const oDataModel = oCtrl.getView().getModel("data");

        if (sProfile === "ANTOS" || sProfile === "TEMPLATE") {
          MessageToast.show(
            oLangModel
              .getResourceBundle()
              .getText("msgProfileInvalid")
              .replace("&1", sProfile)
          );
          return;
        }

        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const aSalesItems = oDataModel.getProperty("/SalesItems");
        const oServiceModel = oCtrl.getView().getModel();
        const aITPStruc = oDataModel.getProperty("/itp");
        const sGeneralRemarks = aSalesItems.find(
          (x) => x.SalesOrderItem == oSalesOrder.SalesOrderItem
        ).GeneralRemarks;
        const sReleaseComment = aSalesItems.find(
          (x) => x.SalesOrderItem == oSalesOrder.SalesOrderItem
        ).ReleaseComment;
        const oITP = {
          SalesOrderID: oSalesOrder.SalesOrderID,
          SalesOrderItem: oSalesOrder.SalesOrderItem,
          Profile: sProfile || "",
          OrderToITPStruc: oCtrl._flatten(aITPStruc),
          GeneralRemarks: sGeneralRemarks,
          ReleaseComment: sReleaseComment,
        };
        oServiceModel.create("/SalesOrderInfoSet", oITP, {
          method: "POST",
          success() {
            const oSalesItem = aSalesItems.find(
              (el) => el.SalesOrderItem === +oSalesOrder.SalesOrderItem
            ) || { ItpState: "" };
            if (oSalesItem.ItpState === "") oCtrl.onToggleRelease(); //oCtrl._updateItpState("P");??

            MessageToast.show(
              oLangModel
                .getResourceBundle()
                .getText(sProfile === "" ? "msgITPSaved" : "msgProfileSaved")
            );
          },
          error() {},
        });
      },

      onApplyProfile() {
        this._callProfileDialog({ edit: false });
      },

      onSaveAsProfile() {
        this._callProfileDialog({ edit: true });
      },

      onProfileListPress(el) {
        const oSrc = el.getSource();
        const sVal = oSrc.getModel().getProperty(oSrc.getBindingContextPath());
        this.getView().byId("fldProfileName").setValue(sVal.Profile);
      },

      onPrintForm(el) {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const sFile = el.oSource.getId().includes("btnPrintFormCust")
          ? `ITPCust_${oSalesOrder.SalesOrderID}_${oSalesOrder.SalesOrderItem}`
          : `ITP_${oSalesOrder.SalesOrderID}_${oSalesOrder.SalesOrderItem}`;
        const oServiceModel = oCtrl.getView().getModel();
        window.open(
          `${oServiceModel.sServiceUrl}/ITPFormSet('${sFile}.pdf')/$value`,
          "_blank"
        );
      },

      onLoadITP(sProfile) {
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
            new sap.ui.model.Filter(
              "Profile",
              sap.ui.model.FilterOperator.EQ,
              sProfile || ""
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

      onSalesRelevantToggle(evt) {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oUIState = oDataModel.getProperty("/uiState");
        if (oUIState.SalesRelevantOnly) {
          oUIState.SalesRelevantFilter.push(
            new Filter("SalesRelevantOnly", FilterOperator.EQ, true)
          );
        } else {
          oUIState.SalesRelevantFilter = [];
        }
        oDataModel.setProperty("/uiState", oUIState);

        const oSelect = oCtrl.getView().byId("selSalesOrderItem");
        const oBinding = oSelect.getBinding("items");
        oBinding.filter(oUIState.SalesRelevantFilter);
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
      },

      popoverActionPress(oEvent) {
        const oControl = oEvent.getSource();
        const sValue = oControl
          .getParent()
          .getParent()
          .getContent()[0]
          .getValue();
        const sPath = oControl
          .getParent()
          .getParent()
          .getParent()
          ._oControl._oOpenBy.getBindingInfo("visible")
          .binding.getBindings(0)[0]
          .getContext()
          .getPath();
        const oModel = oControl
          .getParent()
          .getParent()
          .getParent()
          ._oControl._oOpenBy.getModel("data");

        if (oControl.data("srcCell").includes("ItpProcedure")) {
          oModel.setProperty(`${sPath}/ItpProcedureDescr`, sValue);
        } else {
          oModel.setProperty(`${sPath}/AcceptCritDescr`, sValue);
        }
        oControl.getParent().getParent().getParent().close();
      },

      onApplyGenRemark(oEvent) {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        //const sGeneralRemarks = oDataModel.getProperty(
        //  "/SalesOrder/GeneralRemarks"
        //);

        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        const aSalesItems = oDataModel.getProperty("/SalesItems");
        const sGeneralRemarks = aSalesItems.find(
          (x) => x.SalesOrderItem == oSalesOrder.SalesOrderItem
        ).GeneralRemarks;

        const oTextArea = new sap.m.TextArea({
          rows: 3,
          cols: 100,
          value: sGeneralRemarks, //oEvent.getSource().getModel("data").getProperty(sSrc),
        });

        const oBtn = new Button({
          icon: "sap-icon://accept",
          press: this.popoverGerRemarkPress,
        });
        //oBtn.data("srcCell", sSrc);

        this.mPopover = new Popover({
          content: [oTextArea],
          beginButton: [oBtn],
          showHeader: false,
        });

        this.mPopover.openBy(oEvent.getSource());
      },

      popoverGerRemarkPress(oEvent) {
        const oControl = oEvent.getSource();

        const sValue = oControl
          .getParent()
          .getParent()
          .getContent()[0]
          .getValue();

        const oCtrl = this;
        //const oDataModel = oCtrl.getView().getModel("data");

        const oDataModel = oControl
          .getParent()
          .getParent()
          .getParent()
          ._oControl._oOpenBy.getModel("data");

        const oSalesOrder = oDataModel.getProperty("/SalesOrder");
        let aSalesItems = oDataModel.getProperty("/SalesItems");

        aSalesItems.find(
          (x) => x.SalesOrderItem == oSalesOrder.SalesOrderItem
        ).GeneralRemarks = sValue;

        oControl.getParent().getParent().getParent().close();
      },

      onExtendedText(oEvent) {
        const oCtrl = this;
        const sSrcID = oEvent.getSource().getId();

        const sPath = oEvent
          .getSource()
          .getBindingInfo("visible")
          .binding.getBindings()[0]
          .getContext()
          .getPath();

        const sSrc = sSrcID.includes("btnProcedureExt")
          ? `${sPath}/ItpProcedureDescr`
          : `${sPath}/AcceptCritDescr`;

        const oDataModel = oCtrl.getView().getModel("data");
        oDataModel.setProperty("/activeControl", sSrc);

        const oTextArea = new sap.m.TextArea({
          value: oEvent.getSource().getModel("data").getProperty(sSrc),
        });

        const oBtn = new Button({
          icon: "sap-icon://accept",
          press: this.popoverActionPress,
        });
        oBtn.data("srcCell", sSrc);

        this.mPopover = new Popover({
          content: [oTextArea],
          beginButton: [oBtn],
          showHeader: false,
        });

        this.mPopover.openBy(oEvent.getSource());
      },

      _callProfileDialog(oParams) {
        const oCtrl = this;

        // eslint-disable-next-line no-undef
        const oButton = new sap.m.Button({
          icon: "sap-icon://delete",
          // eslint-disable-next-line no-template-curly-in-string
          visible: "{= !${Fixed} }",
          type: "Reject",
          press: oCtrl.onProfileDelete,
        });

        const aCells = oParams.edit
          ? [new sap.m.Label({ text: "{Profile}" })]
          : [new sap.m.Label({ text: "{Profile}" }), oButton];

        const oTemplate = new sap.m.ColumnListItem({
          type: "Active",
          cells: aCells,
          press(evt) {
            oCtrl.onProfileListPress(evt);
          },
        });

        oCtrl.getView().byId("listProfiles").columns = [
          new sap.m.Column(),
          new sap.m.Column(),
        ];

        this.getView().byId("listProfiles").bindItems({
          path: "/ITPProfileSet",
          template: oTemplate,
        });

        if (oParams) {
          const fnPressHandler = function (oEvent) {
            const src = oEvent.getSource();

            if (src.getId().indexOf("Cancel") >= 0) {
              //     oCtrl.setProfileValue("");
            }

            switch (oCtrl.getView().byId("fldProfileName").getValue()) {
              case "ANTOS":
                oCtrl.onBeforeShowHandler();

                break;

              case "TEMPLATE":
                oCtrl.onTemplate();

                break;

              default:
            }

            this.oDialog.getAggregation("buttons").forEach((obj) => {
              if (obj.mEventRegistry.press) {
                obj.mEventRegistry.press.length = 0;
              }
            });

            oCtrl.oDialog.close();
          };

          this.getView().byId("btnProfileLoad").setVisible(!oParams.edit);

          if (oParams.initial) {
            this.getView()
              .byId("btnProfileLoad")
              .attachPress(fnPressHandler, this);
          } else {
            this.getView()
              .byId("btnProfileLoad")
              .attachPress(this.onProfileLoad, this);
          }

          this.getView()
            .byId("btnProfileCancel")
            .attachPress(fnPressHandler, this);

          this.getView().byId("btnProfileSave").setVisible(oParams.edit);

          this.getView()
            .byId("btnProfileSave")
            .attachPress(this.onProfileSave, this);
        }

        oCtrl.oDialog.open();
      },

      onTemplate() {
        const oCtrl = this;
        const oView = this.getView();
        oCtrl.oTmplDialog = oView.byId("dlgTemplate");
        if (!oCtrl.oTmplDialog) {
          oCtrl.oTmplDialog = sap.ui.xmlfragment(
            oView.getId(),
            "zproddoc.view.Template",
            oCtrl
          );
          oCtrl.getView().addDependent(oCtrl.oTmplDialog);
        }
        oCtrl.oTmplDialog.open();
      },

      onTemplateLoad() {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oRefSalesOrder = oDataModel.getProperty("/RefSalesOrder");
        oCtrl.onLoadITP(
          `TEMPLATE/${oRefSalesOrder.SalesOrderID}/${oRefSalesOrder.SalesOrderItem}`
        );
        this.oTemplateDialog.close();
      },

      onTemplateCancel() {
        this.oTemplateDialog.close();
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

      _updateItpState(state) {
        const oCtrl = this;
        const oDataModel = oCtrl.getView().getModel("data");
        const oSalesOrder = oDataModel.getProperty("/SalesOrder");

        oSalesOrder.ItpState = state;
        oDataModel.setProperty("/SalesOrder", oSalesOrder);

        const aSalesItems = oDataModel.getProperty("/SalesItems");
        const oSalesItem = aSalesItems.find(
          (el) => el.SalesOrderItem === +oSalesOrder.SalesOrderItem
        );
        if (oSalesItem) {
          oSalesItem.ItpState = state;
          oDataModel.setProperty("/SalesItems", aSalesItems);
        }
      },

      _flatten(tree) {
        const array = [];

        tree.forEach((el) => {
          //if (el.Selected) {
          array.push({
            Selected: el.Selected,
            NodeKey: el.NodeKey,
            ParentNodeKey: el.ParentNodeKey,
            InspItem: el.InspItem,
            Activity: el.Activity,
            ActivityPlnGr: el.ActivityPlnGr,
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
            IsCustomerDoc: el.IsCustomerDoc,
            IsExtendedDelivery: el.isExtendedDelivery,
          });
          // }
          if (el.children) {
            array.push(...this._flatten(el.children));
          }
        });
        return array;
      },

      _getFixedVal(array, field) {
        return array
          .filter((el) => el.Fieldname === field)
          .map((el) => ({ value: el.Value, text: el.Text }));
      },
    })
);
