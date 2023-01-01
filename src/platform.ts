import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from "homebridge";

import { WattBoxConfig } from "./config";
import { WattBoxPlatformAccessory, WattBoxPlatformAccessoryContext } from "./platformAccessory";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import { WattBoxDeviceApi } from "./wattbox";

type WattBoxHomebridgePlatformConfig = PlatformConfig & WattBoxConfig;

export class WattBoxPlatform implements DynamicPlatformPlugin {
  public readonly accessories: PlatformAccessory[] = [];
  public readonly config: WattBoxHomebridgePlatformConfig;

  constructor(public readonly log: Logger, public readonly platformConfig: PlatformConfig, public readonly api: API) {
    this.log.info('Finished initializing platform:', this.platformConfig.name);

    this.config = <WattBoxHomebridgePlatformConfig>this.platformConfig;

    this.api.on('didFinishLaunching', async () => {
      this.discoverDevices();
    });
  }

  public configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading Accessory from Cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  private async discoverDevices() {
    const uuids: Set<string> = new Set();
    for (const deviceConfig of this.config.devices) {
      const uuid = this.api.hap.uuid.generate(deviceConfig.serviceTag);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      const accessory = existingAccessory ?? new this.api.platformAccessory(deviceConfig.name, uuid);

      const deviceApi = new WattBoxDeviceApi(deviceConfig.host, deviceConfig.username, deviceConfig.password);

      try {
        const deviceInfo = await deviceApi.getDeviceInfo();
        accessory.context = <WattBoxPlatformAccessoryContext>{
          deviceInfo: deviceInfo,
          serialNumber: deviceConfig.serviceTag
        };
      }
      catch (error: unknown) {
        this.log.error(`[${accessory.displayName}] ${(<Error>error).message}`);

        if (existingAccessory) {
          this.log.error(`[${accessory.displayName}] existing Accessory, Loading from Cache...`);
        }
        else {
          this.log.error(`[${accessory.displayName}] New Accessory, Cannot Configure Now!!!`);
          continue;
        }
      }

      accessory.getService(this.api.hap.Service.AccessoryInformation)!
        .setCharacteristic(this.api.hap.Characteristic.Name, deviceConfig.name)
        .setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'WattBox')
        .setCharacteristic(this.api.hap.Characteristic.Model, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.model)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.serviceTag)
        .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.firmware);

      for (let i = 0; i < (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames.length; i++) {
        this.log.info(`[${accessory.displayName}] [${(i + 1).toString().padStart(2)}] Creating accessory handler with default name "${(<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i]}"`);
        new WattBoxPlatformAccessory(this, accessory, deviceApi, i + 1, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i]);
      }

      if (existingAccessory) {
        this.api.updatePlatformAccessories([accessory]);
        uuids.add(uuid);
      }
      else {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        uuids.add(uuid);
      }
    }

    const orphanedAccessories = this.accessories.filter((accessory) => !uuids.has(accessory.UUID));
    if (orphanedAccessories.length > 0) {
      this.log.info('Removing orphaned accessories from cache: ', orphanedAccessories.map(({ displayName }) => displayName).join(', '));
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, orphanedAccessories);
    }
  }
}
