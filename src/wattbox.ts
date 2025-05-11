import { Logger } from 'homebridge';
import { WattBoxClient } from 'wattbox-api';

import PubSub from 'pubsub-js';

export class WattBoxDeviceApi {
    private readonly client: WattBoxClient;
    private readonly pollInterval: number;
    private readonly log: Logger;
    private readonly logDebug: boolean;
    private readonly logPrefix: string;

    constructor(host: string, username: string, password: string, pollInterval: number, log: Logger, logDebug: boolean, logPrefix: string) {
        this.pollInterval = pollInterval;
        this.log = log;
        this.logDebug = logDebug;
        this.logPrefix = logPrefix;

        this.client = new WattBoxClient({
            host: host,
            username: username,
            password: password
        });

        // if (this.logDebug) {
        this.client.on('debugmsg', (message: string) => {
            this.log.info(`${this.logPrefix} [data]: ${message}`);
        });

        this.client.on('debugsock', (event: string, payload?: string) => {
            this.log.info(`${this.logPrefix} [sock]: [${event}] ${payload ? payload.replace(/\n/g, '\\n') : ''}`);
        });
        // }
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

    public subscribeDeviceStatus(serviceTag: string, func: (deviceStatus: WattBoxDeviceStatus) => void): PubSubJS.Token {
        const topic = `homebridge:wattbox:${serviceTag}`;
        const token = PubSub.subscribe(topic, (_, data) => {
            if (data) {
                func(data);
            }
        });

        if (PubSub.countSubscriptions(topic) === 1) {
            const poll = async () => {
                if (PubSub.countSubscriptions(topic) === 0) {
                    return;
                }

                try {
                    PubSub.publish(topic, await this.getDeviceStatus());
                }
                catch (err) {
                    if (err instanceof Error) {
                        this.log.error(`${this.logPrefix} ${err.message}`);
                    }
                }

                setTimeout(poll, this.pollInterval * 1000);
            };

            setTimeout(poll, 0);
        }

        return token;
    }

    public unsubscribeDeviceStatus(token: PubSubJS.Token): void {
        PubSub.unsubscribe(token);
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
