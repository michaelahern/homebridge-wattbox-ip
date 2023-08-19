import { CharacteristicValue, Logger, PlatformAccessory } from "homebridge";

import { WattBoxPlatform } from "./platform";
import { WattBoxDeviceApi, WattBoxDeviceInfo, WattBoxOutletAction, WattBoxOutletStatus } from "./wattbox";
import { WattBoxDeviceConfig } from "./config";

export class WattBoxPlatformAccessory {
  private readonly context: WattBoxPlatformAccessoryContext;
  private readonly log: Logger;
  private readonly logPrefix: string;

  private outletStatus = WattBoxOutletStatus.UNKNOWN;

  constructor(private readonly platform: WattBoxPlatform, private readonly accessory: PlatformAccessory, private readonly deviceApi: WattBoxDeviceApi, private readonly outletId: number, private readonly outletName: string) {
    this.context = <WattBoxPlatformAccessoryContext>this.accessory.context;
    this.log = this.platform.log;
    this.logPrefix = `[${this.accessory.displayName}] [${this.outletId.toString().padStart(2)}]`;

    const outletServiceId = `${this.context.deviceInfo.serviceTag}:${this.outletId}`;
    const outletService = (this.accessory.getServiceById(this.platform.api.hap.Service.Outlet, outletServiceId) || this.accessory.addService(this.platform.api.hap.Service.Outlet, `${this.outletId}: ${this.outletName}`, outletServiceId))
      .setCharacteristic(this.platform.api.hap.Characteristic.Name, `${this.outletId} ${this.outletName}`);

    const outletServiceOnCharacteristic = outletService.getCharacteristic(this.platform.api.hap.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));

    const batteryService = this.accessory.getService(this.platform.api.hap.Service.Battery);

    this.deviceApi.subscribeDeviceStatus(
      this.context.deviceInfo.serviceTag,
      (deviceStatus) => {
        this.log.debug(`${this.logPrefix} status -> ${WattBoxOutletStatus[this.outletStatus]}:${WattBoxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]}`);

        if (this.outletStatus !== deviceStatus.outletStatus[this.outletId - 1]) {
          this.outletStatus = deviceStatus.outletStatus[this.outletId - 1];
          outletServiceOnCharacteristic.updateValue(!!deviceStatus.outletStatus[this.outletId - 1]);
        }

        if (batteryService && deviceStatus.batteryLevel !== undefined && deviceStatus.powerLost !== undefined) {
          batteryService
            .updateCharacteristic(this.platform.api.hap.Characteristic.BatteryLevel, deviceStatus.batteryLevel)
            .updateCharacteristic(this.platform.api.hap.Characteristic.ChargingState, deviceStatus.powerLost ? this.platform.api.hap.Characteristic.ChargingState.NOT_CHARGING : this.platform.api.hap.Characteristic.ChargingState.CHARGING)
            .updateCharacteristic(this.platform.api.hap.Characteristic.StatusLowBattery, deviceStatus.powerLost ? this.platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
        }
      }
    );
  }

  private getOn(): CharacteristicValue {
    this.log.debug(`${this.logPrefix} getOn -> ${WattBoxOutletStatus[this.outletStatus]}`)

    if (this.outletStatus === WattBoxOutletStatus.UNKNOWN) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
    }

    return this.outletStatus === WattBoxOutletStatus.ON;
  }

  private async setOn(value: CharacteristicValue) {
    if (this.context.deviceConfig.outletsReadOnly) {
      this.log.debug(`${this.logPrefix} setOn(NOOP)`)
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
    }

    const action = this.context.deviceConfig.outletsResetOnly ? WattBoxOutletAction.RESET : (value ? WattBoxOutletAction.ON : WattBoxOutletAction.OFF);
    this.log.debug(`${this.logPrefix} setOn(${WattBoxOutletAction[action]})`)

    try {
      await this.deviceApi.setOutletAction(this.outletId, action);
      this.outletStatus = value ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF;
    }
    catch (error: unknown) {
      this.log.error(`${this.logPrefix} setOn(${WattBoxOutletAction[action]}) -> ${(<Error>error).message}`)
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
  }
}

export interface WattBoxPlatformAccessoryContext {
  deviceConfig: WattBoxDeviceConfig
  deviceInfo: WattBoxDeviceInfo;
}
