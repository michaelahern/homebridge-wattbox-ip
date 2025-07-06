# GitHub Codespaces & VPN

## Tailscale

https://tailscale.com/kb/1160/github-codespaces

```shell
$ sudo tailscale up --accept-routes [--auth-key=$TS_AUTH_KEY]
```

## WireGuard

https://www.wireguard.com/quickstart/

```shell
$ sudo ip link add dev wg0 type wireguard
$ sudo ip address add dev wg0 192.168.3.2/24
$ sudo wg set wg0 private-key /path/to/private-key peer ABCDEF... endpoint 1.2.3.4:56789 allowed-ips 192.168.0.0/22
$ sudo ip link set wg0 up
$ sudo route add -net 192.168.1.0/24 gw 192.168.3.1 metric 100
```
