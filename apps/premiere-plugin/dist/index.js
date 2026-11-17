require("./_virtual/_rolldown/runtime.js");
const require_index = require("./node_modules/react/index.js");
const require_client$1 = require("./node_modules/react-dom/client.js");
const require_App = require("./src/app/App.js");
;/* empty css                */
const require_jsx_runtime$1 = require("./node_modules/react/jsx-runtime.js");
require_index.default;
var import_client = require_client$1.default;
var import_jsx_runtime = require_jsx_runtime$1.default;
var rootElement = document.getElementById("root");
if (rootElement) (0, import_client.createRoot)(rootElement).render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(require_App.default, {}));

//# sourceMappingURL=index.js.map