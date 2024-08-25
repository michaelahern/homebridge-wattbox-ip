import { API } from 'homebridge';

import { WattBoxPlatform } from './platform.js';
import { PLATFORM_NAME } from './settings.js';

export default (api: API) => {
    api.registerPlatform(PLATFORM_NAME, WattBoxPlatform);
};
