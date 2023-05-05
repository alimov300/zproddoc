sap.ui.define([], () => {
  "use strict";
  return {
    statusText(sStatus) {
      const resourceBundle = this.getOwnerComponent()
        .getModel("i18n")
        .getResourceBundle();
      switch (sStatus) {
        case "A":
          return resourceBundle.getText("invoiceStatusA");
        case "B":
          return resourceBundle.getText("invoiceStatusB");
        case "C":
          return resourceBundle.getText("invoiceStatusC");
        default:
          return sStatus;
      }
    },

    SDItemIcon(sState) {
      if (!sState) return "";
      // eslint-disable-next-line default-case
      switch (sState) {
        case "C":
          return "sap-icon://instance";
        case "R":
          return "sap-icon://locked";
      }
      return "";
    },

    left20(sText) {
      if (!sText) {
        return "";
      }

      return sText.substr(0, 20);
    },
  };
});
