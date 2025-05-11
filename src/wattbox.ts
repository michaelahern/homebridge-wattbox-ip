import { EventEmitter } from 'events';
import { Logger } from 'homebridge';
import { WattBoxClient } from 'wattbox-api';

export class WattBoxDeviceApi extends EventEmitter<WattBoxEvents> {
    private readonly client: WattBoxClient;
    private readonly pollInterval: number;
    private readonly log: Logger;
    private readonly logDebug: boolean;
    private readonly logPrefix: string;

    constructor(host: string, username: string, password: string, pollInterval: number, log: Logger, logDebug: boolean, logPrefix: string) {
        super();
        this.setMaxListeners(128);

        this.pollInterval = pollInterval;
        this.log = log;
        this.logDebug = logDebug;
        this.logPrefix = logPrefix;

        this.client = new WattBoxClient({
            host: host,
            username: username,
            password: password
        });

        this.client.on('ready', () => {
            const poll = async () => {
                try {
                    const status = await this.getDeviceStatus();
                    this.emit('deviceStatus', status);
                }
                catch (err) {
                    // TODO: Handle error
                    if (err instanceof Error) {
                        this.log.error(`${this.logPrefix} Error polling device status: ${err.message}`);
                    }
                }
            };

            setInterval(poll, this.pollInterval * 1000);
        });

        if (this.logDebug) {
            this.client.on('debugmsg', (message: string) => {
                this.log.debug(`${this.logPrefix} [data]: ${message}`);
            });

            this.client.on('debugsock', (event: string, payload?: string) => {
                this.log.debug(`${this.logPrefix} [sock]: [${event}] ${payload ? payload.replace(/\n/g, '\\n') : ''}`);
            });
        }
    }

    public async connect() {
        await this.client.connect();
    }

    public async getDeviceInfo() {
        const model = await this.client.getModel();
        const serviceTag = await this.client.getServiceTag();
        const firmware = await this.client.getFirmware();
        const outletNames = await this.client.getOutletNames();
        const upsConnection = await this.client.getUPSConnected();

        return {
            model: model,
            serviceTag: serviceTag,
            firmware: firmware,
            outletNames: outletNames,
            upsConnection: upsConnection
        } as WattBoxDeviceInfo;
    }

    public async getDeviceStatus() {
        const outletStatus = await this.client.getOutletStatus();

        // TODO: Ignore on WB-150/250
        const outletPowerStatus: WattBoxOutletPowerStatus[] = [];
        for (let i = 1; i <= outletStatus.length; i++) {
            const outletPowerMetrics = await this.client.getOutletPowerMetrics(i);
            if (outletPowerMetrics) {
                outletPowerStatus[i - 1] = {
                    amps: outletPowerMetrics.amps,
                    watts: outletPowerMetrics.watts,
                    volts: outletPowerMetrics.volts
                };
            }
        }

        const upsMetrics = await this.client.getUPSMetrics();

        return {
            outletStatus: outletStatus.map(x => x ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF),
            outletPowerStatus: outletPowerStatus,
            batteryLevel: upsMetrics?.batteryLoad,
            powerLost: upsMetrics?.powerLost
        } as WattBoxDeviceStatus;
    }

    public async setOutletAction(id: number, action: WattBoxOutletAction) {
        this.client.setOutletAction(id, action);
    }
}

export interface WattBoxDeviceInfo {
    model: string;
    serviceTag: string;
    firmware: string;
    outletNames: string[];
    upsConnection: boolean;
}

export interface WattBoxDeviceStatus {
    outletStatus: WattBoxOutletStatus[];
    outletPowerStatus: WattBoxOutletPowerStatus[];
    batteryLevel?: number;
    powerLost?: boolean;
}

export interface WattBoxEvents {
    deviceStatus: [deviceStatus: WattBoxDeviceStatus];
}

export enum WattBoxOutletAction {
    OFF = 0,
    ON = 1,
    TOGGLE = 2,
    RESET = 3
}

export enum WattBoxOutletStatus {
    UNKNOWN = -1,
    OFF = 0,
    ON = 1
}

export interface WattBoxOutletPowerStatus {
    amps: number;
    watts: number;
    volts: number;
}
