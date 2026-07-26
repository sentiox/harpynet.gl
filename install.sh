#!/bin/sh
set -eu

VERSION="${HARPYNET_VERSION:-1.3.9}"
REF="${HARPYNET_REF:-v$VERSION}"
REPO="${HARPYNET_REPO:-sentiox/harpynet.gl}"
WORKDIR=""
RUNTIME_PACKAGES="curl jq coreutils-base64 bind-dig kmod-nft-tproxy ca-bundle"

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

package_manager() {
	if command -v apk >/dev/null 2>&1; then
		echo apk
	elif command -v opkg >/dev/null 2>&1; then
		echo opkg
	else
		fail "No supported package manager found: install apk or opkg first"
	fi
}

package_installed() {
	local manager="$1"
	local pkg="$2"
	if [ "$manager" = "apk" ]; then
		apk info -e "$pkg" >/dev/null 2>&1
	else
		opkg list-installed "$pkg" >/dev/null 2>&1
	fi
}

install_runtime_packages() {
	local manager=""
	local missing=""
	local pkg=""

	manager="$(package_manager)"
	for pkg in $RUNTIME_PACKAGES; do
		if ! package_installed "$manager" "$pkg"; then
			missing="$missing $pkg"
		fi
	done

	if [ -z "$missing" ]; then
		info "Runtime packages already installed"
		return 0
	fi

	info "Installing HarpyNet runtime packages:$missing"
	if [ "$manager" = "apk" ]; then
		apk update || warn "apk update failed, trying apk add anyway"
		apk add $missing || fail "Could not install required packages:$missing"
	else
		opkg update || warn "opkg update failed, trying opkg install anyway"
		opkg install $missing || fail "Could not install required packages:$missing"
	fi
}

install_mihomo() {
	if command -v mihomo >/dev/null 2>&1 && mihomo -v >/dev/null 2>&1; then
		info "Mihomo already installed: $(mihomo -v | head -n 1)"
		return 0
	fi

	local machine=""
	local arch=""
	local release_json="/tmp/harpynet-mihomo-release.$$"
	local archive="/tmp/harpynet-mihomo.gz.$$"
	local tag=""
	local asset=""
	local url=""
	local digest=""
	local actual=""

	machine="$(uname -m)"
	case "$machine" in
		aarch64|arm64) arch="arm64" ;;
		armv7l|armv7) arch="armv7" ;;
		armv6l|armv6) arch="armv6" ;;
		x86_64|amd64) arch="amd64" ;;
		i386|i486|i586|i686) arch="386" ;;
		*) fail "Unsupported Mihomo architecture: $machine" ;;
	esac

	info "Downloading current Mihomo for linux-$arch..."
	download "https://api.github.com/repos/MetaCubeX/mihomo/releases/latest" "$release_json"
	tag="$(jq -r '.tag_name // empty' "$release_json")"
	[ -n "$tag" ] || fail "Could not determine the current Mihomo release"
	asset="mihomo-linux-${arch}-${tag}.gz"
	url="$(jq -r --arg name "$asset" '.assets[] | select(.name == $name) | .browser_download_url' "$release_json" | head -n 1)"
	digest="$(jq -r --arg name "$asset" '.assets[] | select(.name == $name) | (.digest // empty)' "$release_json" | head -n 1)"
	[ -n "$url" ] || fail "Mihomo release does not contain $asset"

	download "$url" "$archive"
	if [ -n "$digest" ] && [ "${digest#sha256:}" != "$digest" ] && command -v sha256sum >/dev/null 2>&1; then
		actual="$(sha256sum "$archive" | awk '{print $1}')"
		[ "$actual" = "${digest#sha256:}" ] || fail "Mihomo checksum verification failed"
	fi

	gzip -dc "$archive" > /usr/bin/mihomo
	chmod 0755 /usr/bin/mihomo
	rm -f "$release_json" "$archive"
	mihomo -v >/dev/null 2>&1 || fail "Installed Mihomo binary does not start"
	info "Installed $(mihomo -v | head -n 1)"
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

install_runtime_packages
install_mihomo

info "Installing HarpyNet backend $VERSION..."
mkdir -p /etc/init.d /etc/config /usr/bin /usr/lib/harpynet
cp "$CORE/etc/init.d/harpynet" /etc/init.d/harpynet
if [ ! -f /etc/config/harpynet ]; then
	cp "$CORE/etc/config/harpynet" /etc/config/harpynet
else
	warn "Keeping existing /etc/config/harpynet"
fi
cp "$CORE/usr/bin/harpynet" /usr/bin/harpynet
cp "$CORE/usr/lib/harpynet/"* /usr/lib/harpynet/
rm -f /usr/lib/harpynet/sing_box_config_facade.sh /usr/lib/harpynet/sing_box_config_manager.sh
rm -f /usr/lib/harpynet/harpynet/mihomo_backend.sh
rmdir /usr/lib/harpynet/harpynet 2>/dev/null || true
chmod 0755 /etc/init.d/harpynet /usr/bin/harpynet
chmod 0644 /usr/lib/harpynet/*

if [ "$(uci -q get harpynet.settings.config_path)" = "/etc/sing-box/config.json" ]; then
	uci set harpynet.settings.config_path="/tmp/mihomo/config.yaml"
fi
if [ "$(uci -q get harpynet.settings.cache_path)" = "/etc/harpynet/cache.db" ]; then
	uci set harpynet.settings.cache_path="/etc/harpynet/mihomo-config.yaml"
fi
uci commit harpynet

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
cp "$UI/www/harpynet/icons/"*.png /www/harpynet/icons/
cp "$UI/www/harpynet/flags/"*.png /www/harpynet/flags/
cp "$UI/usr/lib/oui-httpd/rpc/harpynet_gl" /usr/lib/oui-httpd/rpc/harpynet_gl
cp "$UI/usr/share/gl-validator.d/harpynet_gl.lua" /usr/share/gl-validator.d/harpynet_gl.lua
cp "$UI/usr/libexec/rpcd/harpynet_gl" /usr/libexec/rpcd/harpynet_gl
cp "$UI/usr/share/rpcd/acl.d/harpynet-gl.json" /usr/share/rpcd/acl.d/harpynet-gl.json
chmod 0644 /usr/share/oui/menu.d/harpynet.json
chmod 0644 /www/views/gl-sdk4-ui-harpynet.common.js
chmod 0644 /www/harpynet/icons/*.png /www/harpynet/flags/*.png
chmod 0644 /usr/lib/oui-httpd/rpc/harpynet_gl
chmod 0644 /usr/share/gl-validator.d/harpynet_gl.lua
chmod 0755 /usr/libexec/rpcd/harpynet_gl
chmod 0644 /usr/share/rpcd/acl.d/harpynet-gl.json

info "Reloading services..."
/etc/init.d/harpynet enable >/dev/null 2>&1 || true
/etc/init.d/harpynet restart >/dev/null 2>&1 || fail "HarpyNet failed to start with Mihomo"
/etc/init.d/rpcd restart >/dev/null 2>&1 || warn "rpcd restart failed"
/etc/init.d/oui-httpd restart >/dev/null 2>&1 || /etc/init.d/nginx reload >/dev/null 2>&1 || warn "OUI reload failed"

info "Done. Open the stock GL.iNet UI and refresh the page:"
info "http://192.168.8.1/#/harpynet"
