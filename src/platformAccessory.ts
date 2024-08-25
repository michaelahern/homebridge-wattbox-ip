import { CharacteristicValue, Logger, PlatformAccessory } from "homebridge";

import { WattBoxDeviceConfig } from "./config.js";
import { WattBoxPlatform } from "./platform.js";
import { WattBoxDeviceApi, WattBoxDeviceInfo, WattBoxOutletAction, WattBoxOutletStatus } from "./wattbox.js";

export class WattBoxPlatformAccessory {
    private readonly context: WattBoxPlatformAccessoryContext;
    private readonly log: Logger;
    private readonly logPrefix: string;

    private outletStatus = WattBoxOutletStatus.UNKNOWN;

    constructor(private readonly platform: WattBoxPlatform, private readonly accessory: PlatformAccessory, private readonly deviceApi: WattBoxDeviceApi, private readonly outletId: number, private readonly outletServiceId: string, private readonly outletName: string, private readonly outletIsReadOnly: boolean, private readonly outletIsResetOnly: boolean) {
        this.context = <WattBoxPlatformAccessoryContext>this.accessory.context;
        this.log = this.platform.log;
        this.logPrefix = `[${this.accessory.displayName}] [${this.outletId.toString().padStart(2)}]`;

        const outletDisplayName = `${this.outletId} ${this.outletName}`;
        const outletService = (this.accessory.getServiceById(this.platform.api.hap.Service.Outlet, this.outletServiceId) || this.accessory.addService(this.platform.api.hap.Service.Outlet, outletDisplayName, this.outletServiceId))
            .setCharacteristic(this.platform.api.hap.Characteristic.Name, outletDisplayName)
            .setCharacteristic(this.platform.api.hap.Characteristic.ConfiguredName, outletDisplayName);

        const outletServiceOnCharacteristic = outletService.getCharacteristic(this.platform.api.hap.Characteristic.On)
            .onGet(this.getOutletStatus.bind(this))
            .onSet(this.setOutletStatus.bind(this));

        const batteryService = this.accessory.getService(this.platform.api.hap.Service.Battery);

        this.deviceApi.subscribeDeviceStatus(
            this.context.deviceInfo.serviceTag,
            (deviceStatus) => {
                if (WattBoxOutletStatus[this.outletStatus] != WattBoxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]) {
                    this.log.info(`${this.logPrefix} pollOutletStatus ${WattBoxOutletStatus[this.outletStatus]}->${WattBoxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]}`);
                }
                else if (this.platform.config.debug) {
                    this.log.debug(`${this.logPrefix} pollOutletStatus ${WattBoxOutletStatus[this.outletStatus]}->${WattBoxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]}`);
                }

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

    private getOutletStatus(): CharacteristicValue {
        if (this.platform.config.debug) {
            this.log.debug(`${this.logPrefix} getOutletStatus ${WattBoxOutletStatus[this.outletStatus]}`);
        }

        if (this.outletStatus === WattBoxOutletStatus.UNKNOWN) {
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
        }

        return this.outletStatus === WattBoxOutletStatus.ON;
    }

    private async setOutletStatus(value: CharacteristicValue) {
        if (this.outletIsReadOnly) {
            this.log.info(`${this.logPrefix} setOutletStatus NOOP`);
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        }

        const action = this.outletIsResetOnly ? WattBoxOutletAction.RESET : (value ? WattBoxOutletAction.ON : WattBoxOutletAction.OFF);
        this.log.info(`${this.logPrefix} setOutletStatus ${WattBoxOutletAction[action]}`)

        try {
            await this.deviceApi.setOutletAction(this.outletId, action);
            this.outletStatus = value ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF;
        }
        catch (err) {
            if (err instanceof Error) {
                this.log.error(`${this.logPrefix} setOutletStatus ${WattBoxOutletAction[action]} -> ${err.message}`)
            }

            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
    }
}

export interface WattBoxPlatformAccessoryContext {
    deviceConfig: WattBoxDeviceConfig
    deviceInfo: WattBoxDeviceInfo;
}
