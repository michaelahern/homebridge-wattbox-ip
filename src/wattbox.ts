import { Mutex } from "async-mutex";
import { Socket } from "net";
import { PromiseSocket } from "promise-socket"

export class WattboxDevice {
  private host: string;
  private username: string;
  private password: string;
  private mutex: Mutex;

  constructor(host: string, username: string, password: string) {
    this.host = host;
    this.username = username;
    this.password = password;
    this.mutex = new Mutex();
  }

  public async getDeviceInfo() {
    const client = new PromiseSocket();
    const mutexRelease = await this.mutex.acquire();

    try {
      await this.login(client);

      // ?Model
      await client.write("?Model\n");
      const modelResponse = (await client.read()) as String;
      const modelMatch = modelResponse.match(/\?Model=(.*)\n/);
      const model = modelMatch ? modelMatch[1] : "Unknown";

      // ?ServiceTag
      await client.write("?ServiceTag\n");
      const serviceTagResponse = (await client.read()) as String;
      const serviceTagMatch = serviceTagResponse.match(/\?ServiceTag=(.*)\n/);
      const serviceTag = serviceTagMatch ? serviceTagMatch[1] : "Unknown";

      // ?Firmware
      await client.write("?Firmware\n");
      const firmwareResponse = (await client.read()) as String;
      const firmwareMatch = firmwareResponse.match(/\?Firmware=(.*)\n/);
      const firmware = firmwareMatch ? firmwareMatch[1] : "Unknown";

      // ?OutletCount
      await client.write("?OutletCount\n");
      const outletCountResponse = (await client.read()) as String;
      const outletCountMatch = outletCountResponse.toString().match(/\?OutletCount=(.*)\n/);
      const outletCount = outletCountMatch ? parseInt(outletCountMatch[1]) : 0;

      // ?OutletName
      await client.write("?OutletName\n");
      const outletNameResponse = (await client.read()) as String;
      const outletNameMatch = outletNameResponse.match(/\?OutletName=(.*)\n/);
      const outletNames = outletNameMatch ? outletNameMatch[1] : "";

      // ?UPSConnection
      await client.write("?UPSConnection\n");
      const upsConnectionResponse = (await client.read()) as String;
      const upsConnectionMatch = upsConnectionResponse.toString().match(/\?UPSConnection=(.*)\n/);
      const upsConnection = upsConnectionMatch ? Boolean(parseInt(upsConnectionMatch[1])).valueOf() : false;

      return <WattboxDeviceInfo>{
        model: model,
        serviceTag: serviceTag,
        firmware: firmware,
        outletCount: outletCount,
        outletNames: outletNames.split(",").map(x => x.substring(1, x.length - 1)),
        upsConnection: upsConnection
      };
    }
    finally {
      try {
        // !Exit
        await client.write("!Exit\n");
        await client.end();
      }
      finally {
        mutexRelease();
      }
    }
  }

  public async getDeviceState() {
    const client = new PromiseSocket();
    const mutexRelease = await this.mutex.acquire();

    try {
      await this.login(client);

      // ?OutletStatus
      await client.write("?OutletStatus\n");
      const outletStatusResponse = (await client.read()) as String;
      const outletStatusMatch = outletStatusResponse.match(/\?OutletStatus=(.*)\n/);
      const outletStatuses = outletStatusMatch ? outletStatusMatch[1] : "";

      // ?UPSStatus
      await client.write("?UPSStatus\n");
      const upsStatusResponse = (await client.read()) as String;
      const upsStatusMatch = upsStatusResponse.match(/\?UPSStatus=(.*)\n/);
      const upsStatus = upsStatusMatch ? upsStatusMatch[1] : "0,0,Unknown,False";

      return <WattboxDeviceState>{
        outletStates: outletStatuses.split(",").map(x => Boolean(parseInt(x)).valueOf()),
        batteryLevel: parseInt(upsStatus.split(",")[0]),
        powerLost: upsStatus.split(",")[3] === "True"
      };
    }
    finally {
      try {
        // !Exit
        await client.write("!Exit\n");
        await client.end();
      }
      finally {
        mutexRelease();
      }
    }
  }

  public async getOutletState(outlet: number) {
    const client = new PromiseSocket();
    const mutexRelease = await this.mutex.acquire();

    try {
      await this.login(client);

      // ?OutletStatus
      await client.write("?OutletStatus\n");
      const outletStatusResponse = (await client.read()) as String;
      const outletStatusMatch = outletStatusResponse.match(/\?OutletStatus=(.*)\n/);
      const outletStatuses = outletStatusMatch ? outletStatusMatch[1] : "";

      return outletStatuses.split(",").map(x => Boolean(parseInt(x)).valueOf())[outlet - 1];
    }
    finally {
      try {
        // !Exit
        await client.write("!Exit\n");
        await client.end();
      }
      finally {
        mutexRelease();
      }
    }
  }

  public async setOutletState(outlet: number, action: string) {
    const client = new PromiseSocket();
    const mutexRelease = await this.mutex.acquire();

    try {
      await this.login(client);

      // !OutletSet=<OutLet,Action
      await client.write(`!OutletSet=${outlet},${action}\n`);
    }
    finally {
      try {
        // !Exit
        await client.write("!Exit\n");
        await client.end();
      }
      finally {
        mutexRelease();
      }
    }
  }

  private async login(client: PromiseSocket<Socket>) {
    client.setEncoding("utf8");
    client.setTimeout(10000);

    await client.connect(23, this.host);

    // Please Login to Continue
    // Username:
    await client.read();
    await client.read();
    await client.write(`${this.username}\n`);

    // Password:
    await client.read();
    await client.write(`${this.password}\n`);

    // Successfully Logged In! or Invalid Login
    const loginResponse = (await client.read()) as Buffer;
    if (loginResponse.toString().includes("Invalid")) throw "Invalid Login";
  }
}

export interface WattboxDeviceInfo {
  model: string;
  serviceTag: string;
  firmware: string;
  outletCount: number;
  outletNames: string[];
  upsConnection: boolean;
}

export interface WattboxDeviceState {
  outletStates: boolean[];
  batteryLevel: number;
  powerLost: boolean;
}
