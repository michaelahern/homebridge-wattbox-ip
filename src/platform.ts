import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from "homebridge";

import { WattBoxConfig } from "./config.js";
import { WattBoxPlatformAccessory, WattBoxPlatformAccessoryContext } from "./platformAccessory.js";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings.js";
import { WattBoxDeviceApi } from "./wattbox.js";

type WattBoxHomebridgePlatformConfig = PlatformConfig & WattBoxConfig;

export class WattBoxPlatform implements DynamicPlatformPlugin {
    public readonly accessories: PlatformAccessory[] = [];
    public readonly config: WattBoxHomebridgePlatformConfig;

    constructor(public readonly log: Logger, public readonly platformConfig: PlatformConfig, public readonly api: API) {
        this.config = <WattBoxHomebridgePlatformConfig>this.platformConfig;

        this.api.on('didFinishLaunching', async () => {
            await this.discoverDevices();
        });
    }

    public configureAccessory(accessory: PlatformAccessory) {
        this.log.info(`[${accessory.displayName}] Loading accessory from cache...`);
        this.accessories.push(accessory);
    }

    private async discoverDevices() {
        const discoveredAccessoryUUIDs: Set<string> = new Set();

        for (const deviceConfig of this.config.devices) {
            const uuid = this.api.hap.uuid.generate(deviceConfig.serviceTag);
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            const accessory = existingAccessory ?? new this.api.platformAccessory(deviceConfig.name, uuid);

            const deviceApi = new WattBoxDeviceApi(deviceConfig.host, deviceConfig.username, deviceConfig.password, this.log, this.config.debug ?? false, `[${accessory.displayName}]`);

            try {
                const deviceInfo = await deviceApi.getDeviceInfo();

                if (deviceConfig.serviceTag != deviceInfo.serviceTag) {
                    this.log.warn(`[${accessory.displayName}] Service tag mismatch detected!`);
                }

                accessory.context = <WattBoxPlatformAccessoryContext>{
                    deviceConfig: deviceConfig,
                    deviceInfo: deviceInfo
                };
            }
            catch (error: unknown) {
                this.log.error(`[${accessory.displayName}] ${(<Error>error).message}`);

                if (existingAccessory) {
                    this.log.error(`[${accessory.displayName}] Using cache to initialize accessory, check configuration!`);
                }
                else {
                    this.log.error(`[${accessory.displayName}] Cannot initialize new device/accessory, check configuration!`);
                    continue;
                }
            }

            (accessory.getService(this.api.hap.Service.AccessoryInformation) || accessory.addService(this.api.hap.Service.AccessoryInformation))
                .setCharacteristic(this.api.hap.Characteristic.Name, deviceConfig.name)
                .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'WattBox')
                .setCharacteristic(this.api.hap.Characteristic.Model, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.model)
                .setCharacteristic(this.api.hap.Characteristic.SerialNumber, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.serviceTag)
                .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.firmware);

            if ((<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.upsConnection) {
                if (!accessory.getService(this.api.hap.Service.Battery)) {
                    accessory.addService(this.api.hap.Service.Battery, "UPS Battery Backup");
                }
            }

            for (let i = 0; i < (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames.length; i++) {
                if (deviceConfig.excludedOutlets && deviceConfig.excludedOutlets.includes((<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i])) {
                    this.log.info(`[${accessory.displayName}] [${(i + 1).toString().padStart(2)}] Excluding outlet with name "${(<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i]}"`);
                    const outletService = accessory.getServiceById(this.api.hap.Service.Outlet, `${(<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.serviceTag}:${i + 1}`);
                    if (outletService) {
                        accessory.removeService(outletService);
                    }
                    continue;
                }

                this.log.info(`[${accessory.displayName}] [${(i + 1).toString().padStart(2)}] Including outlet with name "${(<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i]}"`);
                new WattBoxPlatformAccessory(this, accessory, deviceApi, i + 1, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i]);
            }

            if (existingAccessory) {
                this.api.updatePlatformAccessories([accessory]);
            }
            else {
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }

            discoveredAccessoryUUIDs.add(uuid);
        }

        const orphanedAccessories = this.accessories.filter(accessory => !discoveredAccessoryUUIDs.has(accessory.UUID));
        for (const orphanedAccessory of orphanedAccessories) {
            this.log.info(`[${orphanedAccessory.displayName}] Removing orphaned accessory from cache...`);
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [orphanedAccessory]);
        }
    }
}
