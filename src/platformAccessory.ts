import { CharacteristicValue, Logger, PlatformAccessory } from 'homebridge';
import { WattBoxOutletAction } from 'wattbox-api';

import { WattBoxDeviceConfig } from './config.js';
import { WattBoxPlatform } from './platform.js';
import { WattBoxDevice, WattBoxDeviceInfo, WattBoxOutletStatus } from './wattbox.js';

export class WattBoxPlatformAccessory {
    readonly #context: WattBoxPlatformAccessoryContext;
    readonly #log: Logger;
    readonly #logPrefix: string;

    #outletStatus = WattBoxOutletStatus.UNKNOWN;
    #outletPowerAmps = 0;
    #outletPowerWatts = 0;
    #outletPowerVolts = 0;

    constructor(private readonly platform: WattBoxPlatform, private readonly accessory: PlatformAccessory, private readonly device: WattBoxDevice, private readonly outletId: number, private readonly outletServiceId: string, private readonly outletName: string, private readonly outletIsReadOnly: boolean, private readonly outletIsResetOnly: boolean) {
        this.#context = this.accessory.context as WattBoxPlatformAccessoryContext;
        this.#log = this.platform.log;
        this.#logPrefix = `[${this.accessory.displayName}] [${this.outletId.toString().padStart(2)}]`;

        const outletDisplayName = `${this.outletId} ${this.outletName}`;
        const outletService = (this.accessory.getServiceById(this.platform.api.hap.Service.Outlet, this.outletServiceId) ?? this.accessory.addService(this.platform.api.hap.Service.Outlet, outletDisplayName, this.outletServiceId))
            .setCharacteristic(this.platform.api.hap.Characteristic.Name, outletDisplayName)
            .setCharacteristic(this.platform.api.hap.Characteristic.ConfiguredName, outletDisplayName);

        outletService.getCharacteristic(this.platform.api.hap.Characteristic.On)
            .onGet(this.getOutletStatus.bind(this))
            .onSet(this.setOutletStatus.bind(this));

        // Outlet power metrics on WB-800 series only...
        if (this.#context.deviceInfo.model.startsWith('WB-8')) {
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

        // On outlet status change...
        this.device.on('outletStatus', (outletStatus) => {
            const newOutletStatus = outletStatus[this.outletId - 1];

            if (WattBoxOutletStatus[this.#outletStatus] != WattBoxOutletStatus[newOutletStatus]) {
                this.#log.info(`${this.#logPrefix} ${WattBoxOutletStatus[this.#outletStatus]}->${WattBoxOutletStatus[newOutletStatus]}`);
            }
            else if (this.platform.config.debug) {
                this.#log.debug(`${this.#logPrefix} ${WattBoxOutletStatus[this.#outletStatus]}->${WattBoxOutletStatus[newOutletStatus]}`);
            }

            this.#outletStatus = newOutletStatus;
            outletService.getCharacteristic(this.platform.api.hap.Characteristic.On).updateValue(!!this.#outletStatus);
        });

        // On outlet power metrics change...
        this.device.on('outletMetrics', (outletMetrics) => {
            const newOutletMetric = outletMetrics[this.outletId - 1];

            if (newOutletMetric && outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Amps)) {
                this.#outletPowerAmps = newOutletMetric.amps;
                outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Amps).updateValue(this.#outletPowerAmps);
            }

            if (newOutletMetric && outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Volts)) {
                this.#outletPowerVolts = newOutletMetric.volts;
                outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Volts).updateValue(this.#outletPowerVolts);
            }

            if (newOutletMetric && outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Watts)) {
                this.#outletPowerWatts = newOutletMetric.watts;
                outletService.getCharacteristic(this.platform.homebridgeExtensions.Characteristic.Watts).updateValue(this.#outletPowerWatts);
            }
        });

        // On UPS metrics change...
        this.device.on('upsMetrics', (upsMetrics) => {
            const batteryService = this.accessory.getService(this.platform.api.hap.Service.Battery);

            if (batteryService) {
                batteryService
                    .updateCharacteristic(this.platform.api.hap.Characteristic.BatteryLevel, upsMetrics.batteryCharge)
                    .updateCharacteristic(this.platform.api.hap.Characteristic.ChargingState, upsMetrics.powerLost ? this.platform.api.hap.Characteristic.ChargingState.NOT_CHARGING : this.platform.api.hap.Characteristic.ChargingState.CHARGING)
                    .updateCharacteristic(this.platform.api.hap.Characteristic.StatusLowBattery, upsMetrics.batteryCharge < 20 ? this.platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.platform.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
            }
        });
    }

    private getOutletStatus(): CharacteristicValue {
        if (this.#outletStatus === WattBoxOutletStatus.UNKNOWN) {
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE);
        }

        return this.#outletStatus === WattBoxOutletStatus.ON;
    }

    private getOutletPowerAmps(): CharacteristicValue {
        return this.#outletPowerAmps;
    }

    private getOutletPowerVolts(): CharacteristicValue {
        return this.#outletPowerVolts;
    }

    private getOutletPowerWatts(): CharacteristicValue {
        return this.#outletPowerWatts;
    }

    private async setOutletStatus(value: CharacteristicValue) {
        if (this.outletIsReadOnly) {
            this.#log.info(`${this.#logPrefix} ->NOOP`);
            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        }

        const action = this.outletIsResetOnly ? WattBoxOutletAction.RESET : (value ? WattBoxOutletAction.ON : WattBoxOutletAction.OFF);
        this.#log.info(`${this.#logPrefix} ->${WattBoxOutletAction[action]}`);

        try {
            await this.device.setOutletAction(this.outletId, action);
            this.#outletStatus = value ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF;
        }
        catch (err) {
            if (err instanceof Error) {
                this.#log.error(`${this.#logPrefix} ->${WattBoxOutletAction[action]} (${err.message})`);
            }

            throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        }
    }
}

export interface WattBoxPlatformAccessoryContext {
    deviceConfig: WattBoxDeviceConfig;
    deviceInfo: WattBoxDeviceInfo;
}
