#!/bin/sh
set -eu

VERSION="${HARPYNET_VERSION:-1.3.4}"
REF="${HARPYNET_REF:-v$VERSION}"
REPO="${HARPYNET_REPO:-sentiox/harpynet.gl}"
WORKDIR=""

info() {
	printf '\033[32;1m%s\033[0m\n' "$*" >&2
}

warn() {
	printf '\033[33;1m%s\033[0m\n' "$*" >&2
}

fail() {
	printf '\033[31;1m%s\033[0m\n' "$*" >&2
	exit 1
}

cleanup() {
	[ -n "$WORKDIR" ] && [ -d "$WORKDIR" ] && rm -rf "$WORKDIR"
}
trap cleanup EXIT INT TERM

download() {
	local url="$1"
	local out="$2"
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$url" -o "$out"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O "$out" "$url"
	else
		fail "Install curl or wget first"
	fi
}

extract_tarball() {
	local archive="$1"
	local dest="$2"
	if tar -xzf "$archive" -C "$dest" 2>/dev/null; then
		return 0
	fi
	fail "Could not extract repository archive"
}

find_repo_root() {
	local base="$1"
	find "$base" -maxdepth 2 -type f -name install.sh -exec dirname {} \; | head -n 1
}

prepare_source() {
	if [ -f ./harpynet/files/usr/bin/harpynet ] && [ -f ./harpynet-gl-ui/files/www/views/gl-sdk4-ui-harpynet.common.js ]; then
		pwd
		return 0
	fi

	WORKDIR="/tmp/harpynet-gl-install.$$"
	mkdir -p "$WORKDIR"
	local archive="$WORKDIR/source.tar.gz"
	local root=""

	info "Downloading HarpyNet GL $REF..."
	if ! download "https://codeload.github.com/$REPO/tar.gz/refs/tags/$REF" "$archive"; then
		warn "Tag $REF is not available yet, falling back to main"
		download "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" "$archive"
	fi

	extract_tarball "$archive" "$WORKDIR"
	root="$(find_repo_root "$WORKDIR")"
	[ -n "$root" ] || fail "Repository archive has an unexpected layout"
	echo "$root"
}

[ "$(id -u)" = "0" ] || fail "Run as root on the router"

if [ ! -d /usr/share/oui/menu.d ] || [ ! -d /www/views ]; then
	fail "This installer requires the GL.iNet OUI web interface"
fi

ROOT="$(prepare_source)"
CORE="$ROOT/harpynet/files"
UI="$ROOT/harpynet-gl-ui/files"

[ -f "$CORE/usr/bin/harpynet" ] || fail "HarpyNet backend files not found"
[ -f "$UI/www/views/gl-sdk4-ui-harpynet.common.js" ] || fail "HarpyNet GL UI files not found"

info "Installing HarpyNet backend $VERSION..."
mkdir -p /etc/init.d /etc/config /usr/bin /usr/lib/harpynet
cp "$CORE/etc/init.d/harpynet" /etc/init.d/harpynet
if [ ! -f /etc/config/harpynet ]; then
	cp "$CORE/etc/config/harpynet" /etc/config/harpynet
else
	warn "Keeping existing /etc/config/harpynet"
fi
cp "$CORE/usr/bin/harpynet" /usr/bin/harpynet
cp "$CORE/usr/lib/"* /usr/lib/harpynet/
sed -i "s/__COMPILED_VERSION_VARIABLE__/$VERSION/g" /usr/lib/harpynet/constants.sh
chmod 0755 /etc/init.d/harpynet /usr/bin/harpynet
chmod 0644 /usr/lib/harpynet/*

info "Installing native GL.iNet UI..."
mkdir -p \
	/usr/share/oui/menu.d \
	/www/views \
	/www/harpynet/icons \
	/www/harpynet/flags \
	/usr/lib/oui-httpd/rpc \
	/usr/libexec/rpcd \
	/usr/share/gl-validator.d \
	/usr/share/rpcd/acl.d

cp "$UI/usr/share/oui/menu.d/harpynet.json" /usr/share/oui/menu.d/harpynet.json
cp "$UI/www/views/gl-sdk4-ui-harpynet.common.js" /www/views/gl-sdk4-ui-harpynet.common.js
[ -f "$UI/www/views/gl-sdk4-ui-internet.common.js.gz" ] && cp "$UI/www/views/gl-sdk4-ui-internet.common.js.gz" /www/views/gl-sdk4-ui-internet.common.js.gz
cp "$UI/www/harpynet/icons/"*.png /www/harpynet/icons/
cp "$UI/www/harpynet/flags/"*.png /www/harpynet/flags/
cp "$UI/usr/lib/oui-httpd/rpc/harpynet_gl" /usr/lib/oui-httpd/rpc/harpynet_gl
cp "$UI/usr/share/gl-validator.d/harpynet_gl.lua" /usr/share/gl-validator.d/harpynet_gl.lua
cp "$UI/usr/libexec/rpcd/harpynet_gl" /usr/libexec/rpcd/harpynet_gl
cp "$UI/usr/share/rpcd/acl.d/harpynet-gl.json" /usr/share/rpcd/acl.d/harpynet-gl.json
chmod 0644 /usr/share/oui/menu.d/harpynet.json
chmod 0644 /www/views/gl-sdk4-ui-harpynet.common.js
[ -f /www/views/gl-sdk4-ui-internet.common.js.gz ] && chmod 0644 /www/views/gl-sdk4-ui-internet.common.js.gz
chmod 0644 /www/harpynet/icons/*.png /www/harpynet/flags/*.png
chmod 0644 /usr/lib/oui-httpd/rpc/harpynet_gl
chmod 0644 /usr/share/gl-validator.d/harpynet_gl.lua
chmod 0755 /usr/libexec/rpcd/harpynet_gl
chmod 0644 /usr/share/rpcd/acl.d/harpynet-gl.json

info "Reloading services..."
/etc/init.d/harpynet enable >/dev/null 2>&1 || true
/etc/init.d/rpcd restart >/dev/null 2>&1 || warn "rpcd restart failed"
/etc/init.d/oui-httpd restart >/dev/null 2>&1 || /etc/init.d/nginx reload >/dev/null 2>&1 || warn "OUI reload failed"

info "Done. Open the stock GL.iNet UI and refresh the page:"
info "http://192.168.8.1/#/harpynet"
