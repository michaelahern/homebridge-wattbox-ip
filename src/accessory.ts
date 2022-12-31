import { AccessoryConfig, AccessoryPlugin, API, CharacteristicValue, HAP, Logging, Service } from "homebridge";
import { WattboxDevice } from "./wattbox";

export class WattboxAccessory implements AccessoryPlugin {
    private readonly hap: HAP;
    private readonly log: Logging;
    private readonly timer: NodeJS.Timer;

    private readonly wattbox: WattboxDevice;
    private readonly wattboxAccessoryInformation: WattboxAccessoryInformation;
    private readonly wattboxOutletNumber: number;
    private readonly wattboxOutletResetOnly: boolean;
    private wattboxOutletState: boolean;

    private readonly informationService: Service;
    private readonly outletService: Service;

    constructor(log: Logging, config: WattboxAccessoryConfig, api: API) {
        this.hap = api.hap;
        this.log = log;

        if (config.host == undefined) {
            config.host = "127.0.0.1"
            this.log.error("Missing required config value: host");
        }

        if (config.username == undefined) {
            config.username = "wattbox";
            this.log.error("Missing required config value: username");
        }

        if (config.password == undefined) {
            config.password = "wattbox";
            this.log.error("Missing required config value: password");
        }

        if (config.outletNumber == undefined) {
            config.outletNumber = 1;
            this.log.error("Missing required config value: outletNumber");
        }

        this.wattbox = new WattboxDevice(config.host, config.username, config.password);
        this.wattboxOutletNumber = config.outletNumber;
        this.wattboxOutletResetOnly = config.outletResetOnly ?? false;
        this.wattboxOutletState = false;

        this.wattboxAccessoryInformation = {
            model: "Unknown",
            serialNumber: "Unknown",
            firmwareRevision: "Unknown"
        }

        this.informationService = new this.hap.Service.AccessoryInformation()
        this.informationService.setCharacteristic(this.hap.Characteristic.Manufacturer, "WattBox");
        this.informationService.getCharacteristic(this.hap.Characteristic.Model)
            .onGet(() => { return this.wattboxAccessoryInformation.model });
        this.informationService.getCharacteristic(this.hap.Characteristic.SerialNumber)
            .onGet(() => { return this.wattboxAccessoryInformation.serialNumber });
        this.informationService.getCharacteristic(this.hap.Characteristic.FirmwareRevision)
            .onGet(() => { return this.wattboxAccessoryInformation.firmwareRevision });

        this.outletService = new this.hap.Service.Outlet();
        this.outletService.getCharacteristic(api.hap.Characteristic.On)
            .onGet(this.getOn.bind(this))
            .onSet(this.setOn.bind(this));

        this.refreshCharacteristics();
        this.timer = setInterval(async () => { await this.refreshCharacteristics() }, 30000);
    }

    getServices(): Service[] {
        return [this.informationService, this.outletService];
    }

    private async refreshCharacteristics() {
        this.log.debug("refresh");

        try {
            if (this.wattboxAccessoryInformation.model == "Unknown") {
                const deviceInfo = await this.wattbox.getDeviceInfo();
                this.log.debug("refresh", deviceInfo);
                this.wattboxAccessoryInformation.model = deviceInfo.model;
                this.wattboxAccessoryInformation.serialNumber = deviceInfo.serviceTag;
                this.wattboxAccessoryInformation.firmwareRevision = deviceInfo.firmware;
            }

            this.wattboxOutletState = await this.wattbox.getOutletState(this.wattboxOutletNumber);
            this.log.debug(`refresh: ${this.wattboxOutletState}`);
        }
        catch (err) {
            if (err instanceof Error) {
                this.log.error(err.message);
            }
        }
    }

    private getOn(): CharacteristicValue {
        this.log.debug(`get: ${this.wattboxOutletState}`);

        return this.wattboxOutletState;
    }

    private async setOn(value: CharacteristicValue): Promise<void> {
        this.log.debug(`set: pre ${value}`);

        try {
            const action = this.wattboxOutletResetOnly ? "RESET" : (value ? "ON" : "OFF");
            await this.wattbox.setOutletState(this.wattboxOutletNumber, action);
            this.wattboxOutletState = this.wattboxOutletResetOnly || await this.wattbox.getOutletState(this.wattboxOutletNumber);
            this.log.debug(`set: post ${this.wattboxOutletState}`);
        }
        catch (err) {
            if (err instanceof Error) {
                this.log.error(err.message);
            }
        }
    }
}

interface WattboxAccessoryConfig extends AccessoryConfig {
    host?: string;
    username?: string;
    password?: string;
    outletNumber?: number;
    outletResetOnly?: boolean;
}

interface WattboxAccessoryInformation {
    model: string;
    serialNumber: string;
    firmwareRevision: string
}
