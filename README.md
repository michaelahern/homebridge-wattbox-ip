# Homebridge WattBox IP Power

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm](https://badgen.net/npm/v/homebridge-wattbox-ip)](https://www.npmjs.com/package/homebridge-wattbox-ip)
[![node](https://badgen.net/npm/node/homebridge-wattbox-ip)](https://www.npmjs.com/package/homebridge-wattbox-ip)
[![downloads](https://badgen.net/npm/dt/homebridge-wattbox-ip)](https://www.npmjs.com/package/homebridge-wattbox-ip)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/michaelahern/homebridge-wattbox-ip)

A [Homebridge](https://homebridge.io) plugin for [WattBox IP Power](https://www.snapav.com/shop/en/snapav/wattbox-ip-power) devices.

## Requirements

- [Homebridge](https://homebridge.io/)
- One or more supported [WattBox IP Power](https://www.snapav.com/shop/en/snapav/wattbox-ip-power) devices

### Supported Devices

- WB-800 Series
- WB-250 Series
- WB-150 Series

_Note: This plugin implements the more recent WattBox Integration Protocol used by the above series devices. For WB-700 and WB-300 series devices, take a look at [homebridge-wattbox](https://github.com/homebridge-plugins/homebridge-wattbox)._

## Configuration

Example platform config in the Homebridge config.json:

```json
"platforms": [
  {
    "platform": "WattBox IP",
    "devices": [
      {
        "name": "My WattBox",
        "host": "10.0.0.10",
        "username": "wattbox",
        "password": "wattbox",
        "serviceTag": "ST1234567890ABCD",
        "excludedOutlets": ["Unused"],
        "readOnlyOutlets": ["Life Support"],
        "resetOnlyOutlets": ["Modem", "Router"]
      }
    ],
    "debug": false,
    "pollInterval": 20
  }
]
```

### Configuration Details

Field           	             | Description
-------------------------------|------------
**platform**   	               | (required) Must be "WattBox IP"
**devices[].name**	           | (required) Name for the device in HomeKit
**devices[].host**			       | (required) WattBox Device Hostname or IP Address
**devices[].username**	       | (required) WattBox Device Username
**devices[].password**	       | (required) WattBox Device Password
**devices[].serviceTag**	     | (required) WattBox Device Service Tag
**devices[].excludedOutlets**  | (optional) Array of outlet names to exclude from HomeKit
**devices[].readOnlyOutlets**  | (optional) Array of outlet names to disable changing outlet state, useful for outlets you want to view the state of but not control via HomeKit
**devices[].resetOnlyOutlets** | (optional) Array of outlet names to send reset (off+on) outlet state change actions instead of power off, useful for outlets that should never be powered off like critical network equipment
**debug**                      | (optional) Enable debug logging, disabled by default
**pollInterval**	             | (optional) Interval in seconds for polling the outlet data, default is 20s

## Notes

 * Outlet power metrics (e.g. Amps/Current, Voltage, Watts/Consumption) are not visible in the Apple Home app, but are visible within some third-party HomeKit apps, including [Eve](https://www.evehome.com/en-us/eve-app) and [Home+](https://hochgatterer.me/home+/).
