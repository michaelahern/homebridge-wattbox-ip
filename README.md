# Homebridge WattBox IP Power

[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![npm](https://badgen.net/npm/v/homebridge-wattbox-ip)](https://www.npmjs.com/package/homebridge-wattbox-ip)
[![npm](https://badgen.net/npm/dt/homebridge-wattbox-ip)](https://www.npmjs.com/package/homebridge-wattbox-ip)
[![License](https://badgen.net/github/license/michaelahern/homebridge-wattbox-ip)](LICENSE)
[![Build](https://github.com/michaelahern/homebridge-wattbox-ip/actions/workflows/build.yml/badge.svg)](https://github.com/michaelahern/homebridge-wattbox-ip/actions/workflows/build.yml)
[![Donate](https://badgen.net/badge/Donate/PayPal/green)](https://paypal.me/michaeljahern)

A [Homebridge](https://homebridge.io) plugin for [WattBox IP Power](https://www.snapav.com/shop/en/snapav/wattbox-ip-power) devices.

## Requirements

- [Homebridge](https://homebridge.io/)
- One or more supported [WattBox IP Power](https://www.snapav.com/shop/en/snapav/wattbox-ip-power) devices

### Supported Devices

- WB-800 Series
- WB-250 Series
- WB-150 Series

_Note: This plugin implements the more recent WattBox Integration Protocol used by the above series devices. For WB-700 and WB-300 series devices, take a look at [homebridge-wattbox](https://github.com/derek-miller/homebridge-wattbox)._

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
        "serviceTag": "ST1234567890ABCD"
      },
      {
        "name": "My WattBox 2",
        ...
      }
    ]
  }
]
```
