import { API } from 'homebridge';

import { WattboxAccessory } from './accessory';
import { ACCESSORY_NAME } from './settings';

export = (api: API) => {
    api.registerAccessory(ACCESSORY_NAME, WattboxAccessory);
}
