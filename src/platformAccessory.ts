import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';

import { WattBoxDeviceConfig } from './config.js';
import { WattBoxPlatform } from './platform.js';
import { WattBoxDeviceApi, WattBoxDeviceInfo, WattBoxOutletStatus } from './wattbox.js';
import { WattBoxOutletAction } from 'wattbox-api';

export class WattBoxPlatformAccessory {
    private readonly context: WattBoxPlatformAccessoryContext;
    private readonly log: Logger;
    private readonly logPrefix: string;

    private outletStatus = WattBoxOutletStatus.UNKNOWN;
    private outletPowerAmps = 0;
    private outletPowerWatts = 0;
    private outletPowerVolts = 0;

    constructor(private readonly platform: WattBoxPlatform, private readonly accessory: PlatformAccessory, private readonly deviceApi: WattBoxDeviceApi, private readonly outletId: number, private readonly outletServiceId: string, private readonly outletName: string, private readonly outletIsReadOnly: boolean, private readonly outletIsResetOnly: boolean) {
        this.context = this.accessory.context as WattBoxPlatformAccessoryContext;
        this.log = this.platform.log;
        this.logPrefix = `[${this.accessory.displayName}] [${this.outletId.toString().padStart(2)}]`;

        const outletDisplayName = `${this.outletId} ${this.outletName}`;
        const outletService = (this.accessory.getServiceById(this.platform.api.hap.Service.Outlet, this.outletServiceId) ?? this.accessory.addService(this.platform.api.hap.Service.Outlet, outletDisplayName, this.outletServiceId))
            .setCharacteristic(this.platform.api.hap.Characteristic.Name, outletDisplayName)
            .setCharacteristic(this.platform.api.hap.Characteristic.ConfiguredName, outletDisplayName);

        outletService.getCharacteristic(this.platform.api.hap.Characteristic.On)
            .onGet(this.getOutletStatus.bind(this))
            .onSet(this.setOutletStatus.bind(this));

        // Outlet Power Status on WB-800, not WB-150/250...
        if (this.context.deviceInfo.model.startsWith('WB-8')) {
            outletService.addOptionalCharacteristic(this.platform.homebridgeExtensions.Characteristic.Amps);
            outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Amps)
                .onGet(this.getOutletPowerAmps.bind(this));

            outletService.addOptionalCharacteristic(this.platform.homebridgeExtensions.Characteristic.Volts);
            outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Volts)
                .onGet(this.getOutletPowerVolts.bind(this));

            outletService.addOptionalCharacteristic(this.platform.homebridgeExtensions.Characteristic.Watts);
            outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Watts)
                .onGet(this.getOutletPowerWatts.bind(this));
        }

        const batteryService = this.accessory.getService(this.platform.api.hap.Service.Battery);

        this.deviceApi.on('deviceStatus', (deviceStatus) => {
            if (WattBoxOutletStatus[this.outletStatus] != WattBoxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]) {
                this.log.info(`${this.logPrefix} pollOutletStatus ${WattBoxOutletStatus[this.outletStatus]}->${WattBoxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]}`);
            }
            else if (this.platform.config.debug) {
                this.log.debug(`${this.logPrefix} pollOutletStatus ${WattBoxOutletStatus[this.outletStatus]}->${WattBoxOutletStatus[deviceStatus.outletStatus[this.outletId - 1]]}`);
            }

            this.outletStatus = deviceStatus.outletStatus[this.outletId - 1];
            outletService.getCharacteristic(this.platform.api.hap.Characteristic.On).updateValue(!!deviceStatus.outletStatus[this.outletId - 1]);

            // Outlet Power Status on WB-800, not WB-150/250...
            if (this.context.deviceInfo.model.startsWith('WB-8')) {
                if (deviceStatus.outletPowerStatus[this.outletId - 1] && outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Amps)) {
                    this.outletPowerAmps = deviceStatus.outletPowerStatus[this.outletId - 1].amps;
                    outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Amps).updateValue(this.outletPowerAmps);
                }

                if (deviceStatus.outletPowerStatus[this.outletId - 1] && outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Volts)) {
                    this.outletPowerVolts = deviceStatus.outletPowerStatus[this.outletId - 1].volts;
                    outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Volts).updateValue(this.outletPowerVolts);
                }

                if (deviceStatus.outletPowerStatus[this.outletId - 1] && outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Watts)) {
                    this.outletPowerWatts = deviceStatus.outletPowerStatus[this.outletId - 1].watts;
                    outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Watts).updateValue(this.outletPowerWatts);
                }
            }

            if (batteryService && deviceStatus.batteryLevel !== undefined && deviceStatus.powerLost !== undefined) {
                batteryService
                    .updateCharacteristic(this.platform.api.hap.Characteristic.BatteryLevel, deviceStatus.batteryLevel)
                    .updateCharacteristic(this.platform.api.hap.Characteristic.ChargingState, deviceStatus.powerLost ? this.platform.api.hap.Characteristic.ChargingState.NOT_CHARGING : this.platform.api.hap.Characteristic.ChargingState.CHARGING)
                    .updateCharacteristic(this.platform.api.hap.Characteristic.StatusLowBattery, deviceStatus.powerLost ? this.platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
            }
        });
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

    private getOutletPowerAmps(): CharacteristicValue {
        if (this.platform.config.debug) {
            this.log.debug(`${this.logPrefix} getOutletPowerAmps ${this.outletPowerAmps}`);
        }

        return this.outletPowerAmps;
    }

    private getOutletPowerVolts(): CharacteristicValue {
        if (this.platform.config.debug) {
            this.log.debug(`${this.logPrefix} getOutletPowerVolts ${this.outletPowerVolts}`);
        }

        return this.outletPowerVolts;
    }

    private getOutletPowerWatts(): CharacteristicValue {
        if (this.platform.config.debug) {
            this.log.debug(`${this.logPrefix} getOutletPowerWatts ${this.outletPowerWatts}`);
        }

        return this.outletPowerWatts;
    }

    private async setOutletStatus(value: CharacteristicValue) {
        if (this.outletIsReadOnly) {
            this.log.info(`${this.logPrefix} setOutletStatus NOOP`);
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        }

        const action = this.outletIsResetOnly ? WattBoxOutletAction.RESET : (value ? WattBoxOutletAction.ON : WattBoxOutletAction.OFF);
        this.log.info(`${this.logPrefix} setOutletStatus ${WattBoxOutletAction[action]}`);

        try {
            await this.deviceApi.setOutletAction(this.outletId, action);
            this.outletStatus = value ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF;
        }
        catch (err) {
            if (err instanceof Error) {
                this.log.error(`${this.logPrefix} setOutletStatus ${WattBoxOutletAction[action]} -> ${err.message}`);
            }

            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
    }
}

export interface WattBoxPlatformAccessoryContext {
    deviceConfig: WattBoxDeviceConfig;
    deviceInfo: WattBoxDeviceInfo;
}
