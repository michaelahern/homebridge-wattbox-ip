import { EventEmitter } from 'events';
import { Logger } from 'homebridge';
import { WattBoxClient, WattBoxError, WattBoxOutletAction, WattBoxOutletPowerMetrics, WattBoxUPSMetrics } from 'wattbox-api';

export class WattBoxDeviceApi extends EventEmitter<WattBoxEvents> {
    readonly #client: WattBoxClient;
    readonly #log: Logger;
    readonly #logDebug: boolean;
    readonly #logPrefix: string;

    #emitOutletMetrics = false;
    #emitUPSMetrics = false;

    constructor(host: string, username: string, password: string, log: Logger, logDebug: boolean, logPrefix: string) {
        super();
        this.setMaxListeners(128);

        this.#client = new WattBoxClient({
            host: host,
            username: username,
            password: password
        });

        this.#log = log;
        this.#logDebug = logDebug;
        this.#logPrefix = logPrefix;

        this.#client.on('ready', () => {
            this.#log.success(`${this.#logPrefix} Connected!`);
        });

        this.#client.on('outletStatus', (outletStatus: boolean[]) => {
            this.emit('outletStatus', outletStatus.map(x => x ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF));
        });

        if (this.#logDebug) {
            this.#client.on('debugmsg', (message: string) => {
                this.#log.debug(`${this.#logPrefix} [data]: ${message}`);
            });

            this.#client.on('debugsock', (event: string, payload?: string) => {
                this.#log.debug(`${this.#logPrefix} [sock]: [${event}] ${payload ? payload.replace(/\n/g, '\\n') : ''}`);
            });
        }
    }

    public async connect() {
        await this.#client.connect();
    }

    public async getDeviceInfo() {
        const model = await this.#client.getModel();
        const serviceTag = await this.#client.getServiceTag();
        const firmware = await this.#client.getFirmware();
        const outletNames = await this.#client.getOutletNames();
        const upsConnected = await this.#client.getUPSConnected();

        if (model.startsWith('WB-8')) {
            this.#emitOutletMetrics = true;
        }

        if (upsConnected) {
            this.#emitUPSMetrics = true;
        }

        return {
            model: model,
            serviceTag: serviceTag,
            firmware: firmware,
            outletNames: outletNames,
            upsConnected: upsConnected
        } as WattBoxDeviceInfo;
    }

    public async setOutletAction(id: number, action: WattBoxOutletAction) {
        this.#client.setOutletAction(id, action);
    }

    public async startPolling(pollInterval: number) {
        const poll = async () => {
            try {
                const outletStatus = await this.#client.getOutletStatus();
                if (outletStatus) {
                    this.emit('outletStatus', outletStatus.map(x => x ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF));
                }

                if (this.#emitOutletMetrics) {
                    const outletPowerMetrics: WattBoxOutletPowerMetrics[] = [];
                    for (let i = 1; i <= outletStatus.length; i++) {
                        const outletPowerMetric = await this.#client.getOutletPowerMetrics(i);
                        if (outletPowerMetric) {
                            outletPowerMetrics[i - 1] = outletPowerMetric;
                        }
                    }
                    if (outletPowerMetrics) {
                        this.emit('outletMetrics', outletPowerMetrics);
                    }
                }

                if (this.#emitUPSMetrics) {
                    const upsMetrics = await this.#client.getUPSMetrics();
                    if (upsMetrics) {
                        this.emit('upsMetrics', upsMetrics);
                    }
                }
            }
            catch (err) {
                if (err instanceof WattBoxError) {
                    this.#log.error(`${this.#logPrefix} WattBoxError ${err.message}`);
                }
            }
        };

        poll();
        setInterval(poll, pollInterval * 1000);
    }
}

export interface WattBoxDeviceInfo {
    model: string;
    serviceTag: string;
    firmware: string;
    outletNames: string[];
    upsConnected: boolean;
}

export interface WattBoxEvents {
    outletStatus: [outletStatus: WattBoxOutletStatus[]];
    outletMetrics: [outletMetrics: WattBoxOutletPowerMetrics[]];
    upsMetrics: [upsMetrics: WattBoxUPSMetrics];
}

export enum WattBoxOutletStatus {
    UNKNOWN = -1,
    OFF = 0,
    ON = 1
}
