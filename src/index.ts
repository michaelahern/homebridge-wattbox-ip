import { API } from "homebridge";

import { WattBoxPlatform } from "./platform";
import { PLATFORM_NAME } from "./settings";

export = (api: API) => {
    api.registerPlatform(PLATFORM_NAME, WattBoxPlatform);
}
