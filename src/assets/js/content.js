import MapsCatcher from "./Services/MapsCatcher";
import OsuApi from "./Services/OsuApiHelper";

window.onload = function() {
    OsuApi.getMapInfo(2036433).catch((error) => console.error(error));
    MapsCatcher.initializeObserver();
};

