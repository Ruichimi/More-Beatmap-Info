import ExtensionManager from "@services/ExtensionManager";
let MBI = new ExtensionManager();

import config from '/config';
import devTools from "@/js/devTools";
if (config.enable_devToolPanel) devTools();

MBI.start();

function reloadExtension() {
    MBI.reloadExtension();
}

window.addEventListener('reloadExtensionRequested', () => reloadExtension());
