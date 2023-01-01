import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';

import { WattboxPlatform } from './platform';
import { WattboxDevice, WattboxDeviceInfo, WattboxOutletAction, WattboxOutletStatus } from './wattbox';

export class WattboxPlatformAccessory {
  private readonly context: WattBoxPlatformAccessoryContext;
  private readonly log: Logger;

  private outletStatus = WattboxOutletStatus.UNKNOWN;

  constructor(private readonly platform: WattboxPlatform, private readonly accessory: PlatformAccessory, private readonly wattboxDevice: WattboxDevice, private readonly outletId: number, private readonly outletName: string) {
    this.context = <WattBoxPlatformAccessoryContext>this.accessory.context;
    this.log = this.platform.log;

    const outletServiceId = `${this.context.serialNumber}:${this.outletId}`;
    this.log.info(`[${this.outletId}] constructor: outletServiceId -> ${outletServiceId}`);

    const outletService = (this.accessory.getServiceById(this.platform.Service.Outlet, outletServiceId) || this.accessory.addService(this.platform.Service.Outlet, `${this.outletId}: ${this.outletName}`, outletServiceId))
      .setCharacteristic(this.platform.Characteristic.Name, `${this.outletId}: ${this.outletName}`);

    const outletServiceOnCharacteristic = outletService.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    this.wattboxDevice.subscribeDeviceStatus(
      this.context.serialNumber,
      (deviceStatus) => {
        this.log.info(`[${this.outletId}] deviceStatus: ${WattboxOutletStatus[this.outletStatus]} -> ${WattboxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]}`);

        if (this.outletStatus !== deviceStatus.outletStatus[this.outletId - 1]) {
          this.outletStatus = deviceStatus.outletStatus[this.outletId - 1];
          outletServiceOnCharacteristic.updateValue(!!deviceStatus.outletStatus[this.outletId - 1]);
        }
      }
    );
  }

  private getOn(): CharacteristicValue {
    this.log.info(`[${this.outletId}] getOn -> ${WattboxOutletStatus[this.outletStatus]}`)

    if (this.outletStatus === WattboxOutletStatus.UNKNOWN) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    }

    return this.outletStatus === WattboxOutletStatus.ON;
  }

  private async setOn(value: CharacteristicValue) {
    this.log.info(`[${this.outletId}] setOn(${value})`)

    try {
      const action = value ? WattboxOutletAction.ON : WattboxOutletAction.OFF;
      await this.wattboxDevice.setOutletAction(this.outletId, action);
      this.outletStatus = value ? WattboxOutletStatus.ON : WattboxOutletStatus.OFF;
    }
    catch (error: unknown) {
      this.log.error(`[${this.outletId}] setOn(${value}) -> ${(<Error>error).message}`)
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }
}

export interface WattBoxPlatformAccessoryContext {
  deviceInfo: WattboxDeviceInfo;
  serialNumber: string;
}
