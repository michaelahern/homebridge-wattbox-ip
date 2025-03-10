import { Mutex, MutexInterface } from 'async-mutex';
import { Logger } from 'homebridge';
import { Socket } from 'net';
import { PromiseSocket } from 'promise-socket';

import PubSub from 'pubsub-js';

export class WattBoxDeviceApi {
    private readonly host: string;
    private readonly username: string;
    private readonly password: string;
    private readonly pollInterval: number;
    private readonly log: Logger;
    private readonly logDebug: boolean;
    private readonly logPrefix: string;
    private readonly mutex: Mutex;

    constructor(host: string, username: string, password: string, pollInterval: number, log: Logger, logDebug: boolean, logPrefix: string) {
        this.host = host;
        this.username = username;
        this.password = password;
        this.pollInterval = pollInterval;
        this.log = log;
        this.logDebug = logDebug;
        this.logPrefix = logPrefix;
        this.mutex = new Mutex();
    }

    public async getDeviceInfo() {
        const client = new PromiseSocket();
        const mutexRelease = await this.mutex.acquire();

        try {
            await this.login(client);

            // ?Model
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?Model`);
            }
            await client.write('?Model\n');
            const modelResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${modelResponse.trim()}`);
            }
            const modelMatch = /\?Model=(.*)\n/.exec(modelResponse);
            const model = modelMatch ? modelMatch[1] : 'Unknown';

            // ?ServiceTag
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?ServiceTag`);
            }
            await client.write('?ServiceTag\n');
            const serviceTagResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${serviceTagResponse.trim()}`);
            }
            const serviceTagMatch = /\?ServiceTag=(.*)\n/.exec(serviceTagResponse);
            const serviceTag = serviceTagMatch ? serviceTagMatch[1] : 'Unknown';

            // ?Firmware
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?Firmware`);
            }
            await client.write('?Firmware\n');
            const firmwareResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${firmwareResponse.trim()}`);
            }
            const firmwareMatch = /\?Firmware=(.*)\n/.exec(firmwareResponse);
            const firmware = firmwareMatch ? firmwareMatch[1] : 'Unknown';

            // ?OutletName
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?OutletName`);
            }
            await client.write('?OutletName\n');
            const outletNameResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${outletNameResponse.trim()}`);
            }
            const outletNameMatch = /\?OutletName=(.*)\n/.exec(outletNameResponse);
            const outletNames = outletNameMatch ? outletNameMatch[1] : '';

            // ?UPSConnection
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?UPSConnection`);
            }
            await client.write('?UPSConnection\n');
            const upsConnectionResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${upsConnectionResponse.trim()}`);
            }
            const upsConnectionMatch = /\?UPSConnection=(.*)\n/.exec(upsConnectionResponse.toString());
            const upsConnection = upsConnectionMatch ? Boolean(parseInt(upsConnectionMatch[1])) : false;

            return {
                model: model,
                serviceTag: serviceTag,
                firmware: firmware,
                outletNames: outletNames.split(',').map(x => x.substring(1, x.length - 1)),
                upsConnection: upsConnection
            } as WattBoxDeviceInfo;
        }
        finally {
            await this.logout(client, mutexRelease);
        }
    }

    public async getDeviceStatus() {
        const client = new PromiseSocket();
        const mutexRelease = await this.mutex.acquire();

        try {
            await this.login(client);

            // ?OutletStatus
            // ?OutletStatus=0,1,0,1,0,1,0,1,...
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?OutletStatus`);
            }
            await client.write('?OutletStatus\n');
            const outletStatusResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${outletStatusResponse.trim()}`);
            }
            const outletStatusMatch = /\?OutletStatus=(.*)\n/.exec(outletStatusResponse);
            const outletStatusMatchResult = outletStatusMatch && outletStatusMatch.length == 2 ? outletStatusMatch[1] : '';
            const outletStatus = outletStatusMatchResult.split(',').map(x => parseInt(x) ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF);

            // ?OutletPowerStatus
            // ?OutletPowerStatus=Outlet,Watts,Amps,Volts
            const outletPowerStatus: WattBoxOutletPowerStatus[] = [];
            for (let i = 1; i <= outletStatus.length; i++) {
                if (this.logDebug) {
                    this.log.debug(`${this.logPrefix} ?OutletPowerStatus=${i}`);
                }
                await client.write(`?OutletPowerStatus=${i}\n`);
                const outletPowerStatusResponse = (await client.read()) as string;
                if (this.logDebug) {
                    this.log.debug(`${this.logPrefix} ${outletPowerStatusResponse.trim()}`);
                }
                const outletPowerStatusMatch = /\?OutletPowerStatus=(.*)\n/.exec(outletPowerStatusResponse);
                const outletPowerStatusMatchResult = outletPowerStatusMatch && outletPowerStatusMatch.length == 2 ? outletPowerStatusMatch[1] : undefined;
                const outletPowerStatusMatchResultArray = outletPowerStatusMatchResult ? outletPowerStatusMatchResult.split(',') : undefined;
                if (outletPowerStatusMatchResultArray && outletPowerStatusMatchResultArray.length == 4) {
                    outletPowerStatus[i - 1] = {
                        amps: parseFloat(outletPowerStatusMatchResultArray[2]),
                        watts: parseFloat(outletPowerStatusMatchResultArray[1]),
                        volts: parseFloat(outletPowerStatusMatchResultArray[3])
                    };
                }
            }

            // ?UPSStatus
            // ?UPSStatus=BatteryLevel(0-100%),BatteryLoad(0-100%),BatteryHealth(Good/Bad),PowerLost(True/False),BatteryRuntime(Mins),AlarmEnabled(True/False),AlamMuted(True/False)
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?UPSStatus`);
            }
            await client.write('?UPSStatus\n');
            const upsStatusResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${upsStatusResponse.trim()}`);
            }
            const upsStatusMatch = /\?UPSStatus=(.*)\n/.exec(upsStatusResponse);
            const upsStatusMatchResult = upsStatusMatch && upsStatusMatch.length == 2 ? upsStatusMatch[1] : undefined;
            const upsStatusMatchResultArray = upsStatusMatchResult ? upsStatusMatchResult.split(',') : undefined;
            const upsStatusBatteryLevel = upsStatusMatchResultArray && upsStatusMatchResultArray.length == 7 ? parseInt(upsStatusMatchResultArray[0]) : undefined;
            const upsStatusPowerLost = upsStatusMatchResultArray && upsStatusMatchResultArray.length == 7 ? upsStatusMatchResultArray[3] == 'True' : undefined;

            return {
                outletStatus: outletStatus,
                outletPowerStatus: outletPowerStatus,
                batteryLevel: upsStatusBatteryLevel,
                powerLost: upsStatusPowerLost
            } as WattBoxDeviceStatus;
        }
        finally {
            await this.logout(client, mutexRelease);
        }
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
        const client = new PromiseSocket();
        const mutexRelease = await this.mutex.acquire();

        try {
            await this.login(client);

            // !OutletSet=Outlet,Action[,Delay]
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} !OutletSet=${id},${WattBoxOutletAction[action]}`);
            }
            await client.write(`!OutletSet=${id},${WattBoxOutletAction[action]}\n`);
            const outletSetResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${outletSetResponse.trim()}`);
            }
            if (outletSetResponse.includes('#Error')) {
                throw new Error('Outlet Set Action Error!');
            }
        }
        finally {
            await this.logout(client, mutexRelease);
        }
    }

    private async login(client: PromiseSocket<Socket>) {
        if (this.logDebug) {
            this.log.debug(`${this.logPrefix} Connecting to ${this.host}:23`);
        }

        client.setEncoding('utf8');
        client.setTimeout(10000);

        await client.connect(23, this.host);

        // Please Login to Continue
        // Username:
        const pleaseLoginResponse = (await client.read()) as string;
        if (!pleaseLoginResponse.includes('Username:')) {
            await client.read();
        }
        await client.write(`${this.username}\n`);

        // Password:
        await client.read();
        await client.write(`${this.password}\n`);

        // Successfully Logged In! or Invalid Login
        const loginResponse = (await client.read()) as string;
        if (this.logDebug) {
            this.log.debug(`${this.logPrefix} ${loginResponse.trim()}`);
        }
        if (loginResponse.includes('Invalid')) {
            throw new Error('Invalid Login!');
        }
    }

    private async logout(client: PromiseSocket<Socket>, mutexRelease: MutexInterface.Releaser) {
        if (this.logDebug) {
            this.log.debug(`${this.logPrefix} !Exit`);
        }

        try {
            // !Exit
            await client.write('!Exit\n');
            await client.end();
        }
        catch {
            // continue, client may have already closed..
        }
        finally {
            mutexRelease();
        }
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
