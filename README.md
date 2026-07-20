# HarpyNet GL

Native GL.iNet UI build of HarpyNet.

This repository is intentionally separate from the LuCI application. It keeps the
HarpyNet backend package and adds a GL.iNet OUI page that appears in the stock
`http://192.168.8.1/#/` interface under `VPN -> HarpyNet`.

## Layout

- `harpynet/` - core OpenWrt package and service backend.
- `harpynet-gl-ui/` - native GL.iNet/OUI menu, page, and rpcd bridge.
- `install.sh` - router-side bootstrap installer for direct testing.

## Current UI Scope

The first GL UI version is a native control panel:

- service status
- autostart status
- HarpyNet version
- subscription configured/empty state
- add/edit subscription URL from the native GL.iNet page
- start, stop, restart
- enable/disable autostart
- subscription update
- recent HarpyNet logs

The LuCI interface is not required for this page.

## Development Install

For local router testing, copy the UI files and restart rpcd/nginx:

```sh
sh /tmp/install-harpynet-gl-dev.sh
```

Release packages should be built as OpenWrt packages from:

- `harpynet`
- `harpynet-gl-ui`

## Notes

This project targets GL.iNet firmware 4.x/5.x with the OUI web interface. The
GL UI module format is:

- menu: `/usr/share/oui/menu.d/harpynet.json`
- view: `/www/views/gl-sdk4-ui-harpynet.common.js`
- OUI RPC bridge: `/usr/lib/oui-httpd/rpc/harpynet_gl`
- OUI argument validator: `/usr/share/gl-validator.d/harpynet_gl.lua`
- optional ubus/rpcd bridge: `/usr/libexec/rpcd/harpynet_gl`
