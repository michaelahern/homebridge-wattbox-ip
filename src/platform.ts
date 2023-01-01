import { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { WattboxConfig } from './config';
import { WattboxPlatformAccessory, WattBoxPlatformAccessoryContext } from './platformAccessory';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { WattboxDevice } from './wattbox';

type WattBoxHomebridgePlatformConfig = PlatformConfig & WattboxConfig;

export class WattboxPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;


  public readonly config: WattBoxHomebridgePlatformConfig;

  public readonly accessories: PlatformAccessory[] = [];

  constructor(public readonly log: Logger, public readonly platformConfig: PlatformConfig, public readonly api: API) {
    this.log.debug('Finished initializing platform:', this.platformConfig.name);

    this.config = <WattBoxHomebridgePlatformConfig>this.platformConfig;

    this.api.on('didFinishLaunching', async () => {
      this.discoverDevices();
    });
  }

  public configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  private async discoverDevices() {
    const uuids: Set<string> = new Set();
    for (const deviceConfig of this.config.devices) {
      const uuid = this.api.hap.uuid.generate(deviceConfig.serviceTag);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      const accessory = existingAccessory ?? new this.api.platformAccessory(deviceConfig.name, uuid);

      const wattboxDevice = new WattboxDevice(deviceConfig.host, deviceConfig.username, deviceConfig.password);

      try {
        const deviceInfo = await wattboxDevice.getDeviceInfo();
        accessory.context = <WattBoxPlatformAccessoryContext>{
          deviceInfo: deviceInfo,
          serialNumber: deviceConfig.serviceTag
        };
      }
      catch (error: unknown) {
        this.log.error((<Error>error).message);

        if (existingAccessory) {
          this.log.error("existing Accessory, Loading from Cache...");
        }
        else {
          this.log.error("New Accessory, Cannot Configure Now!!!");
          continue;
        }
      }


      accessory.getService(this.Service.AccessoryInformation)!
        .setCharacteristic(this.Characteristic.Name, deviceConfig.name)
        .setCharacteristic(this.Characteristic.Manufacturer, 'WattBox')
        .setCharacteristic(this.Characteristic.Model, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.model)
        .setCharacteristic(this.Characteristic.SerialNumber, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.serviceTag)
        .setCharacteristic(this.Characteristic.FirmwareRevision, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.firmware);

      for (let i = 0; i < (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames.length; i++) {
        this.log.info(`${i + 1}: ${(<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i]}`);
        new WattboxPlatformAccessory(this, accessory, wattboxDevice, i + 1, (<WattBoxPlatformAccessoryContext>accessory.context).deviceInfo.outletNames[i]);
      }

      if (existingAccessory) {
        this.api.updatePlatformAccessories([accessory]);
        uuids.add(uuid);
      }
      else {
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        uuids.add(uuid);
      }

      const orphanedAccessories = this.accessories.filter((accessory) => !uuids.has(accessory.UUID));
      if (orphanedAccessories.length > 0) {
        this.log.info('Removing orphaned accessories from cache: ', orphanedAccessories.map(({ displayName }) => displayName).join(', '));
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, orphanedAccessories);
      }
    }
  }
}
