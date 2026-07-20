#!/bin/sh
set -eu

info() {
	printf '\033[32;1m%s\033[0m\n' "$*"
}

warn() {
	printf '\033[33;1m%s\033[0m\n' "$*"
}

fail() {
	printf '\033[31;1m%s\033[0m\n' "$*" >&2
	exit 1
}

[ "$(id -u)" = "0" ] || fail "Run as root on the router"

if [ ! -d /usr/share/oui/menu.d ] || [ ! -d /www/views ]; then
	fail "This installer requires the GL.iNet OUI web interface"
fi

mkdir -p /usr/share/oui/menu.d /www/views /www/harpynet/icons /usr/lib/oui-httpd/rpc /usr/libexec/rpcd /usr/share/gl-validator.d /usr/share/rpcd/acl.d

if [ -f ./harpynet-gl-ui/files/usr/share/oui/menu.d/harpynet.json ]; then
	SRC="./harpynet-gl-ui/files"
else
	fail "Run this script from the harpynet.gl repository root"
fi

info "Installing HarpyNet GL UI files..."
cp "$SRC/usr/share/oui/menu.d/harpynet.json" /usr/share/oui/menu.d/harpynet.json
cp "$SRC/www/views/gl-sdk4-ui-harpynet.common.js" /www/views/gl-sdk4-ui-harpynet.common.js
cp "$SRC/www/harpynet/icons/"*.png /www/harpynet/icons/
cp "$SRC/usr/lib/oui-httpd/rpc/harpynet_gl" /usr/lib/oui-httpd/rpc/harpynet_gl
cp "$SRC/usr/share/gl-validator.d/harpynet_gl.lua" /usr/share/gl-validator.d/harpynet_gl.lua
cp "$SRC/usr/libexec/rpcd/harpynet_gl" /usr/libexec/rpcd/harpynet_gl
cp "$SRC/usr/share/rpcd/acl.d/harpynet-gl.json" /usr/share/rpcd/acl.d/harpynet-gl.json
chmod 0644 /usr/share/oui/menu.d/harpynet.json
chmod 0644 /www/views/gl-sdk4-ui-harpynet.common.js
chmod 0644 /www/harpynet/icons/*.png
chmod 0644 /usr/lib/oui-httpd/rpc/harpynet_gl
chmod 0644 /usr/share/gl-validator.d/harpynet_gl.lua
chmod 0755 /usr/libexec/rpcd/harpynet_gl
chmod 0644 /usr/share/rpcd/acl.d/harpynet-gl.json

info "Reloading rpcd/nginx..."
/etc/init.d/rpcd restart >/dev/null 2>&1 || warn "rpcd restart failed"
/etc/init.d/nginx reload >/dev/null 2>&1 || warn "nginx reload failed"

info "Done. Open the stock GL.iNet UI and refresh the page:"
info "http://192.168.8.1/#/harpynet"
