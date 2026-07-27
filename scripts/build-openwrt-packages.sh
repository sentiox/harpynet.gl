#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RELEASE_VERSION="${1:-}"
OUTPUT_DIR_INPUT="${2:-}"
RELEASE_VERSION="${RELEASE_VERSION#v}"

if [[ ! "$RELEASE_VERSION" =~ ^[0-9]+(\.[0-9]+){2}([.-][0-9]+)?$ ]]; then
  echo "Expected release version in the form vX.Y.Z, X.Y.Z, X.Y.Z.N or X.Y.Z-N" >&2
  exit 1
fi

PACKAGE_VERSION="${RELEASE_VERSION}-r1"
WORK_DIR="${WORK_DIR:-$ROOT_DIR/.build}"
SDK_CACHE_DIR="${SDK_CACHE_DIR:-$HOME/.cache/harpynet-gl/openwrt-sdk}"
SDK_WORK_DIR="${SDK_WORK_DIR:-$WORK_DIR/sdk}"
OUTPUT_DIR="${OUTPUT_DIR_INPUT:-$ROOT_DIR/dist}"

IPK_SDK_URL="${IPK_SDK_URL:-https://downloads.openwrt.org/releases/24.10.6/targets/x86/64/openwrt-sdk-24.10.6-x86-64_gcc-13.3.0_musl.Linux-x86_64.tar.zst}"
APK_SDK_URL="${APK_SDK_URL:-https://downloads.openwrt.org/releases/25.12.3/targets/x86/64/openwrt-sdk-25.12.3-x86-64_gcc-14.3.0_musl.Linux-x86_64.tar.zst}"

PROJECT_URL="https://github.com/sentiox/harpynet.gl"
MAINTAINER="sentiox <harpynet@sentiox>"
BACKEND_DESCRIPTION="HarpyNet backend for GL.iNet routers"
UI_DESCRIPTION="Native GL.iNet OUI interface for HarpyNet"
BACKEND_DEPENDS_IPK="libc, curl, jq, kmod-nft-tproxy, coreutils-base64, bind-dig"
UI_DEPENDS_IPK="libc, harpynet, rpcd, jq"
BACKEND_DEPENDS_APK="bind-dig coreutils-base64 curl jq kmod-nft-tproxy libc"
UI_DEPENDS_APK="harpynet jq libc rpcd"

APT_PACKAGES=(
  build-essential
  curl
  fakeroot
  file
  gawk
  git
  patch
  python3
  rsync
  tar
  unzip
  wget
  xz-utils
  zstd
)

ensure_host_deps() {
  local missing=()
  local commands=(ar curl fakeroot file gcc git make python3 rsync sha256sum tar wget zstd)

  for cmd in "${commands[@]}"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done

  if (( ${#missing[@]} == 0 )); then
    return 0
  fi

  echo "Installing missing build dependencies: ${APT_PACKAGES[*]}" >&2
  if [[ "$(id -u)" -eq 0 ]]; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${APT_PACKAGES[@]}"
    return 0
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get update
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "${APT_PACKAGES[@]}"
    return 0
  fi

  echo "Missing build dependencies and sudo is unavailable: ${missing[*]}" >&2
  exit 1
}

download_sdk_archive() {
  local url="$1"
  local archive_path="$SDK_CACHE_DIR/$(basename "$url")"

  mkdir -p "$SDK_CACHE_DIR"
  if [[ ! -f "$archive_path" ]]; then
    echo "Downloading SDK: $url" >&2
    wget -O "$archive_path.part" "$url"
    mv "$archive_path.part" "$archive_path"
  fi

  printf '%s\n' "$archive_path"
}

extract_sdk() {
  local kind="$1"
  local archive_path="$2"
  local sdk_url="$3"
  local destination="$SDK_WORK_DIR/$kind"
  local marker_file="$destination/.harpynet-gl-sdk-url"
  local temp_dir
  local extracted_root

  mkdir -p "$SDK_WORK_DIR"
  if [[ -d "$destination" && -f "$marker_file" ]] && [[ "$(cat "$marker_file")" == "$sdk_url" ]]; then
    printf '%s\n' "$destination"
    return 0
  fi

  rm -rf "$destination"
  temp_dir="$(mktemp -d "$SDK_WORK_DIR/.${kind}.XXXXXX")"
  tar --zstd -xf "$archive_path" -C "$temp_dir"
  extracted_root="$(find "$temp_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  mv "$extracted_root" "$destination"
  printf '%s\n' "$sdk_url" > "$marker_file"
  rmdir "$temp_dir" 2>/dev/null || true

  printf '%s\n' "$destination"
}

ensure_apk_host_tool() {
  local sdk_dir="$1"
  local apk_bin="$sdk_dir/staging_dir/host/bin/apk"

  if [[ -x "$apk_bin" ]]; then
    printf '%s\n' "$apk_bin"
    return 0
  fi

  if [[ -x "$sdk_dir/setup.sh" ]]; then
    (cd "$sdk_dir" && ./setup.sh >&2)
  fi

  [[ -x "$apk_bin" ]] || {
    echo "apk host tool not found at $apk_bin" >&2
    exit 1
  }

  printf '%s\n' "$apk_bin"
}

normalize_package_root_modes() {
  local package_root="$1"

  find "$package_root" -type d -exec chmod 0755 {} +
  find "$package_root" -type f -exec chmod 0644 {} +
}

build_backend_root() {
  local output_root="$1"

  rm -rf "$output_root"
  mkdir -p \
    "$output_root/etc/init.d" \
    "$output_root/etc/config" \
    "$output_root/usr/bin" \
    "$output_root/usr/lib/harpynet"

  cp -a "$ROOT_DIR/harpynet/files/etc/init.d/harpynet" "$output_root/etc/init.d/harpynet"
  cp -a "$ROOT_DIR/harpynet/files/etc/config/harpynet" "$output_root/etc/config/harpynet"
  cp -a "$ROOT_DIR/harpynet/files/usr/bin/harpynet" "$output_root/usr/bin/harpynet"
  cp -a "$ROOT_DIR/harpynet/files/usr/lib/harpynet/." "$output_root/usr/lib/harpynet/"

  normalize_package_root_modes "$output_root"
  chmod 0755 "$output_root/etc/init.d/harpynet" "$output_root/usr/bin/harpynet"
}

build_ui_root() {
  local output_root="$1"

  rm -rf "$output_root"
  mkdir -p "$output_root"
  cp -a "$ROOT_DIR/harpynet-gl-ui/files/." "$output_root/"
  rm -f "$output_root/www/views/gl-sdk4-ui-internet.common.js.gz"

  normalize_package_root_modes "$output_root"
  chmod 0755 \
    "$output_root/usr/libexec/rpcd/harpynet_gl" \
    "$output_root/usr/lib/harpynet_direct_monitor.sh"
}

installed_size_bytes() {
  du -sk "$1" | awk '{print $1 * 1024}'
}

write_backend_ipk_control() {
  local control_dir="$1"
  local installed_size="$2"

  rm -rf "$control_dir"
  mkdir -p "$control_dir"

  cat > "$control_dir/control" <<EOF
Package: harpynet
Version: ${PACKAGE_VERSION}
Depends: ${BACKEND_DEPENDS_IPK}
Conflicts: https-dns-proxy, nextdns, luci-app-passwall, luci-app-passwall2
License: GPL-2.0-or-later
Section: net
URL: ${PROJECT_URL}
Maintainer: ${MAINTAINER}
Architecture: all
Installed-Size: ${installed_size}
Description: ${BACKEND_DESCRIPTION}
EOF

  cat > "$control_dir/conffiles" <<'EOF'
/etc/config/harpynet
EOF

  cat > "$control_dir/prerm" <<'EOF'
#!/bin/sh
grep -q "105 harpynet" /etc/iproute2/rt_tables && sed -i "/105 harpynet/d" /etc/iproute2/rt_tables
/etc/init.d/harpynet stop >/dev/null 2>&1 || true
exit 0
EOF

  chmod 0755 "$control_dir/prerm"
}

write_ui_ipk_control() {
  local control_dir="$1"
  local installed_size="$2"

  rm -rf "$control_dir"
  mkdir -p "$control_dir"

  cat > "$control_dir/control" <<EOF
Package: harpynet-gl-ui
Version: ${PACKAGE_VERSION}
Depends: ${UI_DEPENDS_IPK}
License: GPL-2.0-or-later
Section: net
URL: ${PROJECT_URL}
Maintainer: ${MAINTAINER}
Architecture: all
Installed-Size: ${installed_size}
Description: ${UI_DESCRIPTION}
EOF

  cat > "$control_dir/postinst" <<'EOF'
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0
if uci -q get dhcp.@dnsmasq[0] >/dev/null 2>&1; then
  uci -q set dhcp.@dnsmasq[0].logqueries='1'
  uci -q commit dhcp
  /etc/init.d/dnsmasq restart >/dev/null 2>&1 || true
fi
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/nginx reload >/dev/null 2>&1 || true
exit 0
EOF

  cat > "$control_dir/prerm" <<'EOF'
#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0
rm -f /usr/share/oui/menu.d/harpynet.json /www/views/gl-sdk4-ui-harpynet.common.js
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/nginx reload >/dev/null 2>&1 || true
exit 0
EOF

  chmod 0755 "$control_dir/postinst" "$control_dir/prerm"
}

build_ipk_package() {
  local ipkg_build_bin="$1"
  local package_name="$2"
  local data_root="$3"
  local control_root="$4"
  local output_file="$5"
  local build_dir="$WORK_DIR/manual/ipk-${package_name}"
  local package_root="$build_dir/pkg"
  local built_file

  rm -rf "$build_dir"
  mkdir -p "$package_root/CONTROL"

  cp -a "$data_root/." "$package_root/"
  cp -a "$control_root/." "$package_root/CONTROL/"

  fakeroot sh -c "
    chown -R 0:0 '$package_root'
    '$ipkg_build_bin' '$package_root' '$build_dir' >/dev/null
  "

  built_file="$build_dir/${package_name}_${PACKAGE_VERSION}_all.ipk"
  [[ -f "$built_file" ]] || {
    echo "Expected IPK artifact not found: $built_file" >&2
    exit 1
  }

  cp -f "$built_file" "$output_file"
}

generate_apk_metadata_files() {
  local package_name="$1"
  local package_root="$2"
  local conffile_path="${3:-}"
  local list_file="$package_root/lib/apk/packages/${package_name}.list"

  mkdir -p "$(dirname "$list_file")"
  (
    cd "$package_root"
    find . -type f ! -path './lib/apk/packages/*' | LC_ALL=C sort | sed 's#^\./#/#'
  ) > "$list_file"

  if [[ -n "$conffile_path" ]]; then
    local conffiles_file="$package_root/lib/apk/packages/${package_name}.conffiles"
    local conffiles_static_file="$package_root/lib/apk/packages/${package_name}.conffiles_static"
    local hash_value

    hash_value="$(sha256sum "$package_root$conffile_path" | awk '{print $1}')"
    printf '%s\n' "$conffile_path" > "$conffiles_file"
    printf '%s %s\n' "$conffile_path" "$hash_value" > "$conffiles_static_file"
  fi
}

write_apk_scripts() {
  local scripts_dir="$1"

  rm -rf "$scripts_dir"
  mkdir -p "$scripts_dir"

  cat > "$scripts_dir/backend-pre-install.sh" <<'EOF'
#!/bin/sh
exit 0
EOF

  cat > "$scripts_dir/backend-post-install.sh" <<'EOF'
#!/bin/sh
exit 0
EOF

  cat > "$scripts_dir/backend-pre-deinstall.sh" <<'EOF'
#!/bin/sh
grep -q "105 harpynet" /etc/iproute2/rt_tables && sed -i "/105 harpynet/d" /etc/iproute2/rt_tables
/etc/init.d/harpynet stop >/dev/null 2>&1 || true
exit 0
EOF

  cat > "$scripts_dir/ui-post-install.sh" <<'EOF'
#!/bin/sh
if uci -q get dhcp.@dnsmasq[0] >/dev/null 2>&1; then
  uci -q set dhcp.@dnsmasq[0].logqueries='1'
  uci -q commit dhcp
  /etc/init.d/dnsmasq restart >/dev/null 2>&1 || true
fi
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/nginx reload >/dev/null 2>&1 || true
exit 0
EOF

  cat > "$scripts_dir/ui-pre-deinstall.sh" <<'EOF'
#!/bin/sh
rm -f /usr/share/oui/menu.d/harpynet.json /www/views/gl-sdk4-ui-harpynet.common.js
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/nginx reload >/dev/null 2>&1 || true
exit 0
EOF

  for prefix in backend ui; do
    for hook in pre-install pre-upgrade post-install pre-deinstall post-upgrade; do
      local path="$scripts_dir/${prefix}-${hook}.sh"
      if [[ ! -f "$path" ]]; then
        printf '#!/bin/sh\nexit 0\n' > "$path"
      fi
    done
  done

  chmod 0755 "$scripts_dir"/*.sh
}

build_apk_package() {
  local apk_bin="$1"
  local package_name="$2"
  local description="$3"
  local depends="$4"
  local files_root="$5"
  local scripts_dir="$6"
  local script_prefix="$7"
  local output_file="$8"
  local temp_root="$WORK_DIR/manual/${package_name}.apk-root"
  local temp_scripts="$WORK_DIR/manual/${package_name}.apk-scripts"

  rm -rf "$temp_root" "$temp_scripts"
  cp -a "$files_root" "$temp_root"
  cp -a "$scripts_dir" "$temp_scripts"

  fakeroot sh -c "
    chown -R 0:0 '$temp_root' '$temp_scripts'
    '$apk_bin' mkpkg \
      --files '$temp_root' \
      --output '$output_file' \
      -I 'name:${package_name}' \
      -I 'version:${PACKAGE_VERSION}' \
      -I 'description:${description}' \
      -I 'arch:noarch' \
      -I 'license:GPL-2.0-or-later' \
      -I 'origin:harpynet-gl' \
      -I 'maintainer:${MAINTAINER}' \
      -I 'url:${PROJECT_URL}' \
      -I 'depends:${depends}' \
      -s pre-install:'$temp_scripts/${script_prefix}-pre-install.sh' \
      -s post-install:'$temp_scripts/${script_prefix}-post-install.sh' \
      -s pre-deinstall:'$temp_scripts/${script_prefix}-pre-deinstall.sh' \
      -s pre-upgrade:'$temp_scripts/${script_prefix}-pre-upgrade.sh' \
      -s post-upgrade:'$temp_scripts/${script_prefix}-post-upgrade.sh'
  "
}

main() {
  local ipk_archive
  local apk_archive
  local ipk_sdk_dir
  local apk_sdk_dir
  local ipkg_build_bin
  local apk_bin
  local manual_root="$WORK_DIR/manual"
  local backend_root="$manual_root/backend-root"
  local ui_root="$manual_root/ui-root"
  local backend_control="$manual_root/backend-ipk-control"
  local ui_control="$manual_root/ui-ipk-control"
  local apk_scripts="$manual_root/apk-scripts"

  ensure_host_deps

  mkdir -p "$WORK_DIR" "$OUTPUT_DIR"
  rm -rf "$manual_root"
  rm -f "$OUTPUT_DIR"/*.ipk "$OUTPUT_DIR"/*.apk

  ipk_archive="$(download_sdk_archive "$IPK_SDK_URL")"
  apk_archive="$(download_sdk_archive "$APK_SDK_URL")"
  ipk_sdk_dir="$(extract_sdk ipk "$ipk_archive" "$IPK_SDK_URL")"
  apk_sdk_dir="$(extract_sdk apk "$apk_archive" "$APK_SDK_URL")"

  ipkg_build_bin="$ipk_sdk_dir/scripts/ipkg-build"
  apk_bin="$(ensure_apk_host_tool "$apk_sdk_dir")"

  [[ -x "$ipkg_build_bin" ]] || { echo "ipkg-build not found at $ipkg_build_bin" >&2; exit 1; }

  build_backend_root "$backend_root"
  build_ui_root "$ui_root"

  write_backend_ipk_control "$backend_control" "$(installed_size_bytes "$backend_root")"
  write_ui_ipk_control "$ui_control" "$(installed_size_bytes "$ui_root")"

  build_ipk_package "$ipkg_build_bin" "harpynet" "$backend_root" "$backend_control" \
    "$OUTPUT_DIR/harpynet-${PACKAGE_VERSION}-all.ipk"
  build_ipk_package "$ipkg_build_bin" "harpynet-gl-ui" "$ui_root" "$ui_control" \
    "$OUTPUT_DIR/harpynet-gl-ui-${PACKAGE_VERSION}-all.ipk"

  generate_apk_metadata_files "harpynet" "$backend_root" "/etc/config/harpynet"
  generate_apk_metadata_files "harpynet-gl-ui" "$ui_root"
  write_apk_scripts "$apk_scripts"

  build_apk_package "$apk_bin" "harpynet" "$BACKEND_DESCRIPTION" "$BACKEND_DEPENDS_APK" \
    "$backend_root" "$apk_scripts" "backend" "$OUTPUT_DIR/harpynet-${PACKAGE_VERSION}.apk"
  build_apk_package "$apk_bin" "harpynet-gl-ui" "$UI_DESCRIPTION" "$UI_DEPENDS_APK" \
    "$ui_root" "$apk_scripts" "ui" "$OUTPUT_DIR/harpynet-gl-ui-${PACKAGE_VERSION}.apk"

  echo "Artifacts:"
  find "$OUTPUT_DIR" -maxdepth 1 -type f \( -name '*.ipk' -o -name '*.apk' \) | sort
}

main "$@"
