import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';

import { WattBoxConfig } from './config.js';
import { HomebridgeExtensions } from './homebridge.js';
import { WattBoxPlatformAccessory, WattBoxPlatformAccessoryContext } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { WattBoxDevice } from './wattbox.js';

type WattBoxHomebridgePlatformConfig = PlatformConfig & WattBoxConfig;

export class WattBoxPlatform implements DynamicPlatformPlugin {
    public readonly accessories: PlatformAccessory[] = [];
    public readonly config: WattBoxHomebridgePlatformConfig;
    public readonly homebridgeExtensions: HomebridgeExtensions;

    constructor(readonly log: Logger, platformConfig: PlatformConfig, readonly api: API) {
        this.config = platformConfig as WattBoxHomebridgePlatformConfig;
        this.homebridgeExtensions = new HomebridgeExtensions(this.api);

        this.api.on('didFinishLaunching', async () => {
            await this.#discoverDevices();
        });
    }

    public configureAccessory(accessory: PlatformAccessory) {
        this.log.info(`[${accessory.displayName}] Loading accessory from cache...`);
        this.accessories.push(accessory);
    }

    async #discoverDevices() {
        const discoveredAccessoryUUIDs = new Set<string>();

        for (const deviceConfig of this.config.devices) {
            const uuid = this.api.hap.uuid.generate(deviceConfig.serviceTag);
            const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
            const accessory = existingAccessory ?? new this.api.platformAccessory(deviceConfig.name, uuid);

            const device = new WattBoxDevice(deviceConfig.host, deviceConfig.username, deviceConfig.password, this.log, this.config.debug ?? false, `[${accessory.displayName}]`);

            try {
                await device.connect();
                const deviceInfo = await device.getDeviceInfo();

                if (deviceConfig.serviceTag != deviceInfo.serviceTag) {
                    this.log.warn(`[${accessory.displayName}] Service tag mismatch detected!`);
                }

                accessory.context = {
                    deviceConfig: deviceConfig,
                    deviceInfo: deviceInfo
                } as WattBoxPlatformAccessoryContext;
            }
            catch (error: unknown) {
                this.log.error(`[${accessory.displayName}] ${(error as Error).message}`);

                if (existingAccessory) {
                    this.log.error(`[${accessory.displayName}] Using cache to initialize accessory, check configuration!`);
                }
                else {
                    this.log.error(`[${accessory.displayName}] Cannot initialize new device/accessory, check configuration!`);
                    continue;
                }
            }

            (accessory.getService(this.api.hap.Service.AccessoryInformation) ?? accessory.addService(this.api.hap.Service.AccessoryInformation))
                .setCharacteristic(this.api.hap.Characteristic.Name, deviceConfig.name)
                .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'WattBox')
                .setCharacteristic(this.api.hap.Characteristic.Model, (accessory.context as WattBoxPlatformAccessoryContext).deviceInfo.model)
                .setCharacteristic(this.api.hap.Characteristic.SerialNumber, (accessory.context as WattBoxPlatformAccessoryContext).deviceInfo.serviceTag)
                .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, (accessory.context as WattBoxPlatformAccessoryContext).deviceInfo.firmware);

            if ((accessory.context as WattBoxPlatformAccessoryContext).deviceInfo.upsConnected) {
                if (!accessory.getService(this.api.hap.Service.Battery)) {
                    accessory.addService(this.api.hap.Service.Battery, 'UPS Battery Backup');
                }
            }

            for (let i = 0; i < (accessory.context as WattBoxPlatformAccessoryContext).deviceInfo.outletNames.length; i++) {
                const outletId = i + 1;
                const outletName = (accessory.context as WattBoxPlatformAccessoryContext).deviceInfo.outletNames[i] ?? 'Unknown';
                const outletServiceId = `${(accessory.context as WattBoxPlatformAccessoryContext).deviceInfo.serviceTag}:${outletId}`;
                const outletIsExcluded = (deviceConfig.excludedOutlets?.includes(outletName)) ?? false;
                const outletIsReadOnly = (deviceConfig.readOnlyOutlets?.includes(outletName)) ?? false;
                const outletIsResetOnly = (deviceConfig.resetOnlyOutlets?.includes(outletName)) ?? false;

                this.log.info(`[${accessory.displayName}] [${outletId.toString().padStart(2)}] Excluded=${+outletIsExcluded} ReadOnly=${+outletIsReadOnly} ResetOnly=${+outletIsResetOnly} Name=${outletName}`);

                if (outletIsExcluded) {
                    const outletService = accessory.getServiceById(this.api.hap.Service.Outlet, outletServiceId);
                    if (outletService) {
                        accessory.removeService(outletService);
                    }
                    continue;
                }

                new WattBoxPlatformAccessory(this, accessory, device, outletId, outletServiceId, outletName, outletIsReadOnly, outletIsResetOnly);
            }

            if (existingAccessory) {
                this.api.updatePlatformAccessories([accessory]);
            }
            else {
                this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }

            discoveredAccessoryUUIDs.add(uuid);

            device.startPolling(this.config.pollInterval ?? 20);
        }

        const orphanedAccessories = this.accessories.filter(accessory => !discoveredAccessoryUUIDs.has(accessory.UUID));
        for (const orphanedAccessory of orphanedAccessories) {
            this.log.info(`[${orphanedAccessory.displayName}] Removing orphaned accessory from cache...`);
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [orphanedAccessory]);
        }
    }
}
