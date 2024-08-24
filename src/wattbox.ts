import { Mutex, MutexInterface } from "async-mutex";
import { Logger } from "homebridge";
import { Socket } from "net";
import { PromiseSocket } from "promise-socket";

import PubSub from "pubsub-js";

export class WattBoxDeviceApi {
    private readonly host: string;
    private readonly username: string;
    private readonly password: string;
    private readonly log: Logger;
    private readonly logDebug: boolean;
    private readonly logPrefix: string;
    private readonly mutex: Mutex;

    constructor(host: string, username: string, password: string, log: Logger, logDebug: boolean, logPrefix: string) {
        this.host = host;
        this.username = username;
        this.password = password;
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
            await client.write("?Model\n");
            const modelResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${modelResponse.trim()}`);
            }
            const modelMatch = modelResponse.match(/\?Model=(.*)\n/);
            const model = modelMatch ? modelMatch[1] : "Unknown";

            // ?ServiceTag
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?ServiceTag`);
            }
            await client.write("?ServiceTag\n");
            const serviceTagResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${serviceTagResponse.trim()}`);
            }
            const serviceTagMatch = serviceTagResponse.match(/\?ServiceTag=(.*)\n/);
            const serviceTag = serviceTagMatch ? serviceTagMatch[1] : "Unknown";

            // ?Firmware
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?Firmware`);
            }
            await client.write("?Firmware\n");
            const firmwareResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${firmwareResponse.trim()}`);
            }
            const firmwareMatch = firmwareResponse.match(/\?Firmware=(.*)\n/);
            const firmware = firmwareMatch ? firmwareMatch[1] : "Unknown";

            // ?OutletName
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?OutletName`);
            }
            await client.write("?OutletName\n");
            const outletNameResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${outletNameResponse.trim()}`);
            }
            const outletNameMatch = outletNameResponse.match(/\?OutletName=(.*)\n/);
            const outletNames = outletNameMatch ? outletNameMatch[1] : "";

            // ?UPSConnection
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?UPSConnection`);
            }
            await client.write("?UPSConnection\n");
            const upsConnectionResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${upsConnectionResponse.trim()}`);
            }
            const upsConnectionMatch = upsConnectionResponse.toString().match(/\?UPSConnection=(.*)\n/);
            const upsConnection = upsConnectionMatch ? Boolean(parseInt(upsConnectionMatch[1])) : false;

            return <WattBoxDeviceInfo>{
                model: model,
                serviceTag: serviceTag,
                firmware: firmware,
                outletNames: outletNames.split(",").map(x => x.substring(1, x.length - 1)),
                upsConnection: upsConnection
            };
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
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?OutletStatus`);
            }
            await client.write("?OutletStatus\n");
            const outletStatusResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${outletStatusResponse.trim()}`);
            }
            const outletStatusMatch = outletStatusResponse.match(/\?OutletStatus=(.*)\n/);
            const outletStatus = outletStatusMatch ? outletStatusMatch[1] : "";

            // ?UPSStatus
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ?UPSStatus`);
            }
            await client.write("?UPSStatus\n");
            const upsStatusResponse = (await client.read()) as string;
            if (this.logDebug) {
                this.log.debug(`${this.logPrefix} ${upsStatusResponse.trim()}`);
            }
            const upsStatusMatch = upsStatusResponse.match(/\?UPSStatus=(.*)\n/);
            const upsStatus = upsStatusMatch ? upsStatusMatch[1] : undefined;

            return <WattBoxDeviceStatus>{
                outletStatus: outletStatus.split(",").map(x => parseInt(x) ? WattBoxOutletStatus.ON : WattBoxOutletStatus.OFF),
                batteryLevel: upsStatus ? parseInt(upsStatus.split(",")[0]) : undefined,
                powerLost: upsStatus ? upsStatus.split(",")[3] == "True" : undefined
            };
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
                        this.log.error(`${this.logPrefix} ${err.message}`)
                    }
                }

                setTimeout(poll, 10000);
            }

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
            if (outletSetResponse.includes("#Error")) {
                throw new Error("Outlet Set Action Error!");
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

        client.setEncoding("utf8");
        client.setTimeout(10000);

        await client.connect(23, this.host);

        // Please Login to Continue
        // Username:
        const pleaseLoginResponse = (await client.read()) as string;
        if (!pleaseLoginResponse.includes("Username:")) {
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
        if (loginResponse.includes("Invalid")) {
            throw new Error("Invalid Login!");
        }
    }

    private async logout(client: PromiseSocket<Socket>, mutexRelease: MutexInterface.Releaser) {
        if (this.logDebug) {
            this.log.debug(`${this.logPrefix} !Exit`);
        }

        try {
            // !Exit
            await client.write("!Exit\n");
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
