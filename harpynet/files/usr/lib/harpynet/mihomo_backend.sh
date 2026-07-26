#!/bin/sh

MIHOMO_BIN="${MIHOMO_BIN:-/usr/bin/mihomo}"
MIHOMO_DIR="/tmp/mihomo"
MIHOMO_CONFIG="$MIHOMO_DIR/config.yaml"
MIHOMO_CACHE_DIR="/etc/harpynet"
MIHOMO_RAW="$MIHOMO_CACHE_DIR/mihomo-subscription.yaml"
MIHOMO_SAVED="$MIHOMO_CACHE_DIR/mihomo-config.yaml"
MIHOMO_HEADERS="$MIHOMO_CACHE_DIR/subscription.headers"
MIHOMO_METADATA="$MIHOMO_CACHE_DIR/subscription-metadata.json"
MIHOMO_GEOIP="$MIHOMO_DIR/geoip.metadb"
MIHOMO_GEOIP_SAVED="$MIHOMO_CACHE_DIR/geoip.metadb"
MIHOMO_GEOIP_URL="https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb"
MIHOMO_API="http://127.0.0.1:9090"
MIHOMO_MARK="0x100000"
MIHOMO_BYPASS_MARK="0x200000"
MIHOMO_TABLE="105"
MIHOMO_TPROXY_PORT="1602"
HARPYNET_VERSION="${HARPYNET_VERSION:-1.3.9.2}"

hn_log() {
    logger -t harpynet -- "$*"
}

hn_json_error() {
    jq -nc --arg error "$1" '{success:false,error:$error}'
}

hn_require() {
    command -v "$1" >/dev/null 2>&1 || {
        hn_log "Required command is missing: $1"
        return 1
    }
}

hn_wan_interface() {
    ip -4 route show table main default 2>/dev/null |
        awk 'NR == 1 { for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit } }'
}

hn_valid_geodata() {
    [ -s "$1" ] && [ "$(wc -c < "$1" 2>/dev/null)" -gt 1000000 ]
}

hn_prepare_geodata() {
    local download_tmp wan_interface
    mkdir -p "$MIHOMO_DIR" "$MIHOMO_CACHE_DIR"

    if hn_valid_geodata "$MIHOMO_GEOIP"; then
        hn_valid_geodata "$MIHOMO_GEOIP_SAVED" ||
            cp "$MIHOMO_GEOIP" "$MIHOMO_GEOIP_SAVED"
        return 0
    fi
    if hn_valid_geodata "$MIHOMO_GEOIP_SAVED"; then
        cp "$MIHOMO_GEOIP_SAVED" "$MIHOMO_GEOIP"
        return 0
    fi

    download_tmp="$MIHOMO_GEOIP_SAVED.new"
    wan_interface="$(hn_wan_interface)"
    rm -f "$download_tmp"
    hn_log "Downloading Mihomo GeoIP database"
    set -- -fsSL --connect-timeout 15 --max-time 120 --retry 3
    [ -n "$wan_interface" ] && set -- "$@" --interface "$wan_interface"
    curl "$@" \
        -o "$download_tmp" "$MIHOMO_GEOIP_URL" || {
        rm -f "$download_tmp"
        hn_log "Failed to download Mihomo GeoIP database"
        return 1
    }
    hn_valid_geodata "$download_tmp" || {
        rm -f "$download_tmp"
        hn_log "Downloaded Mihomo GeoIP database is invalid"
        return 1
    }
    mv "$download_tmp" "$MIHOMO_GEOIP_SAVED"
    chmod 0644 "$MIHOMO_GEOIP_SAVED"
    cp "$MIHOMO_GEOIP_SAVED" "$MIHOMO_GEOIP"
}

hn_uci_get() {
    uci -q get "harpynet.$1.$2" 2>/dev/null
}

hn_primary_section() {
    printf '%s\n' "main"
}

hn_hwid() {
    local hwid
    hwid="$(uci -q get harpynet.settings.hwid 2>/dev/null)"
    if [ -z "$hwid" ]; then
        hwid="$(cat /sys/class/net/br-lan/address 2>/dev/null | tr -d ':')"
        [ -n "$hwid" ] || hwid="$(cat /etc/machine-id 2>/dev/null)"
        [ -n "$hwid" ] || hwid="harpynet-router"
        uci -q set "harpynet.settings.hwid=$hwid"
        uci -q commit harpynet
    fi
    printf '%s' "$hwid"
}

hn_download_subscription() {
    local url tmp_headers tmp_yaml model os_version version wan_interface
    url="$(hn_uci_get main subscription_url)"
    [ -n "$url" ] || {
        hn_log "Subscription URL is empty"
        return 1
    }

    mkdir -p "$MIHOMO_CACHE_DIR" "$MIHOMO_DIR"
    tmp_headers="$MIHOMO_HEADERS.new"
    tmp_yaml="$MIHOMO_RAW.new"
    model="$(ubus call system board 2>/dev/null | jq -r '.model // "OpenWrt router"')"
    os_version="$(. /etc/openwrt_release 2>/dev/null; printf '%s' "$DISTRIB_RELEASE")"
    version="$(opkg status harpynet 2>/dev/null | awk '/^Version:/{print $2; exit}')"
    [ -n "$version" ] || version="1.3.9.2"
    wan_interface="$(hn_wan_interface)"

    set -- -fsSL --connect-timeout 15 --max-time 90 --retry 2
    [ -n "$wan_interface" ] && set -- "$@" --interface "$wan_interface"
    if ! curl "$@" \
        -D "$tmp_headers" -o "$tmp_yaml" \
        -H "User-Agent: ClashMeta/1.19.29 HarpyNet/$version/router" \
        -H "x-hwid: $(hn_hwid)" \
        -H "x-device-os: OpenWrt" \
        -H "x-ver-os: $os_version" \
        -H "x-device-model: $model" \
        "$url"; then
        rm -f "$tmp_headers" "$tmp_yaml"
        hn_log "Failed to download Mihomo subscription"
        return 1
    fi

    grep -qE '^[[:space:]]*(proxies|proxy-providers):[[:space:]]*$' "$tmp_yaml" || {
        rm -f "$tmp_headers" "$tmp_yaml"
        hn_log "Subscription is not a Mihomo YAML template"
        return 1
    }
    grep -qE '^proxy-groups:[[:space:]]*$' "$tmp_yaml" || {
        rm -f "$tmp_headers" "$tmp_yaml"
        hn_log "Subscription has no proxy-groups"
        return 1
    }

    mv "$tmp_headers" "$MIHOMO_HEADERS"
    mv "$tmp_yaml" "$MIHOMO_RAW"
    hn_save_metadata
}

hn_save_metadata() {
    local info title upload download total expire
    info="$(awk 'BEGIN{IGNORECASE=1} /^subscription-userinfo:/{sub(/\r$/,""); sub(/^[^:]*:[ ]*/,""); print; exit}' "$MIHOMO_HEADERS" 2>/dev/null)"
    title="$(awk 'BEGIN{IGNORECASE=1} /^profile-title:/{sub(/\r$/,""); sub(/^[^:]*:[ ]*/,""); print; exit}' "$MIHOMO_HEADERS" 2>/dev/null)"
    upload="$(printf '%s' "$info" | sed -n 's/.*upload=\([0-9]*\).*/\1/p')"
    download="$(printf '%s' "$info" | sed -n 's/.*download=\([0-9]*\).*/\1/p')"
    total="$(printf '%s' "$info" | sed -n 's/.*total=\([0-9]*\).*/\1/p')"
    expire="$(printf '%s' "$info" | sed -n 's/.*expire=\([0-9]*\).*/\1/p')"
    jq -nc \
        --arg title "$title" \
        --argjson upload "${upload:-0}" \
        --argjson download "${download:-0}" \
        --argjson total "${total:-0}" \
        --argjson expire "${expire:-0}" \
        '{title:$title,upload:$upload,download:$download,total:$total,expire:$expire}' \
        > "$MIHOMO_METADATA"
}

hn_yaml_quote() {
    jq -Rn --arg value "$1" '$value'
}

hn_patch_yaml() {
    local source target log_level fully_routed smart_routed bypass_ru
    local user_domain_type user_domains user_subnet_type user_subnets
    local upstream_enabled upstream_name upstream_protocol upstream_server upstream_port
    local upstream_username upstream_password upstream_sni upstream_domains upstream_lists
    local upstream_ready_domains upstream_snippet upstream_list
    source="$1"
    target="$2"
    log_level="$(hn_uci_get settings log_level)"
    [ -n "$log_level" ] || log_level="info"
    case "$log_level" in
        warn) log_level="warning" ;;
        trace) log_level="debug" ;;
        fatal|panic) log_level="error" ;;
        debug|info|warning|error|silent) ;;
        *) log_level="info" ;;
    esac
    fully_routed="$(hn_uci_get main fully_routed_ips)"
    smart_routed="$(hn_uci_get main smart_routed_ips)"
    bypass_ru="$(hn_uci_get main bypass_ru_routed_ips)"
    user_domain_type="$(hn_uci_get main user_domain_list_type)"
    user_domains="$(hn_uci_get main user_domains_text)"
    user_subnet_type="$(hn_uci_get main user_subnet_list_type)"
    user_subnets="$(hn_uci_get main user_subnets_text)"
    upstream_enabled="$(hn_uci_get main upstream_proxy_enabled)"
    upstream_name="$(hn_uci_get main upstream_proxy_name)"
    upstream_protocol="$(hn_uci_get main upstream_proxy_protocol)"
    upstream_server="$(hn_uci_get main upstream_proxy_server)"
    upstream_port="$(hn_uci_get main upstream_proxy_port)"
    upstream_username="$(hn_uci_get main upstream_proxy_username)"
    upstream_password="$(hn_uci_get main upstream_proxy_password)"
    upstream_sni="$(hn_uci_get main upstream_proxy_tls_server_name)"
    upstream_domains="$(hn_uci_get main upstream_proxy_domains)"
    upstream_lists="$(hn_uci_get main upstream_proxy_community_lists)"
    upstream_ready_domains=""
    for upstream_list in $upstream_lists; do
        case "$upstream_list" in
            ai_full)
                upstream_ready_domains="$upstream_ready_domains openai.com chatgpt.com oaistatic.com oaiusercontent.com anthropic.com claude.ai claudeusercontent.com gemini.google.com generativelanguage.googleapis.com aistudio.google.com perplexity.ai x.ai grok.com copilot.microsoft.com"
                ;;
            chatgpt)
                upstream_ready_domains="$upstream_ready_domains openai.com chatgpt.com oaistatic.com oaiusercontent.com"
                ;;
            claude)
                upstream_ready_domains="$upstream_ready_domains anthropic.com claude.ai claudeusercontent.com"
                ;;
        esac
    done
    upstream_snippet="$MIHOMO_DIR/upstream-proxy.yaml"
    rm -f "$upstream_snippet"

    case "$upstream_protocol" in
        socks5|http|https) ;;
        *) upstream_protocol="http" ;;
    esac
    [ -n "$upstream_name" ] || upstream_name="HarpyNet Proxy"
    upstream_name="$(printf '%s' "$upstream_name" | tr ',' ' ')"
    case "$upstream_port" in
        ''|*[!0-9]*) upstream_enabled=0 ;;
        *) [ "$upstream_port" -ge 1 ] 2>/dev/null && [ "$upstream_port" -le 65535 ] 2>/dev/null || upstream_enabled=0 ;;
    esac
    [ -n "$upstream_server" ] || upstream_enabled=0

    if [ "$upstream_enabled" = 1 ]; then
        {
            printf '  - name: %s\n' "$(hn_yaml_quote "$upstream_name")"
            [ "$upstream_protocol" = socks5 ] && printf '    type: socks5\n' || printf '    type: http\n'
            printf '    server: %s\n' "$(hn_yaml_quote "$upstream_server")"
            printf '    port: %s\n' "$upstream_port"
            [ -n "$upstream_username" ] && printf '    username: %s\n' "$(hn_yaml_quote "$upstream_username")"
            [ -n "$upstream_password" ] && printf '    password: %s\n' "$(hn_yaml_quote "$upstream_password")"
            if [ "$upstream_protocol" = socks5 ]; then
                printf '    udp: true\n'
            elif [ "$upstream_protocol" = https ]; then
                printf '    tls: true\n'
                [ -n "$upstream_sni" ] && printf '    sni: %s\n' "$(hn_yaml_quote "$upstream_sni")"
            fi
        } > "$upstream_snippet"
        chmod 600 "$upstream_snippet"
    fi

    awk -v level="$log_level" -v fully_routed="$fully_routed" -v smart_routed="$smart_routed" -v bypass_ru="$bypass_ru" \
        -v user_domain_type="$user_domain_type" -v user_domains="$user_domains" \
        -v user_subnet_type="$user_subnet_type" -v user_subnets="$user_subnets" \
        -v upstream_enabled="$upstream_enabled" -v upstream_name="$upstream_name" \
        -v upstream_domains="$upstream_domains" -v upstream_ready_domains="$upstream_ready_domains" \
        -v upstream_snippet="$upstream_snippet" '
        function print_upstream_domains(raw, lines, tokens, line_count, token_count, i, j, value) {
            line_count = split(raw, lines, /\n/)
            for (i = 1; i <= line_count; i++) {
                sub(/\/\/.*/, "", lines[i])
                gsub(/[,	\r]+/, " ", lines[i])
                token_count = split(lines[i], tokens, /[ ]+/)
                for (j = 1; j <= token_count; j++) {
                    value = tokens[j]
                    sub(/^https?:\/\//, "", value)
                    sub(/\/.*$/, "", value)
                    sub(/:[0-9]+$/, "", value)
                    sub(/^\+\./, "", value)
                    sub(/^\*\./, "", value)
                    if (value ~ /^[A-Za-z0-9_.-]+$/ && value ~ /\./) {
                        rule_key = "DOMAIN-SUFFIX," tolower(value)
                        if (!seen_rule_key[rule_key]++)
                            print "  - DOMAIN-SUFFIX," tolower(value) "," upstream_name
                    }
                }
            }
        }
        function print_user_domains(raw, lines, tokens, line_count, token_count, i, j, value) {
            line_count = split(raw, lines, /\n/)
            for (i = 1; i <= line_count; i++) {
                sub(/\/\/.*/, "", lines[i])
                gsub(/[,	\r]+/, " ", lines[i])
                token_count = split(lines[i], tokens, /[ ]+/)
                for (j = 1; j <= token_count; j++) {
                    value = tokens[j]
                    sub(/^\+\./, "", value)
                    sub(/^\*\./, "", value)
                    if (value ~ /^[A-Za-z0-9_.-]+$/ && value ~ /\./) {
                        rule_line = "  - DOMAIN-SUFFIX," tolower(value) ",🌍 Страна"
                        rule_key = "DOMAIN-SUFFIX," tolower(value)
                        if (!seen_rule_key[rule_key]++) print rule_line
                    }
                }
            }
        }
        function print_user_subnets(raw, lines, tokens, line_count, token_count, i, j, value, rule_type) {
            line_count = split(raw, lines, /\n/)
            for (i = 1; i <= line_count; i++) {
                sub(/\/\/.*/, "", lines[i])
                gsub(/[,	\r]+/, " ", lines[i])
                token_count = split(lines[i], tokens, /[ ]+/)
                for (j = 1; j <= token_count; j++) {
                    value = tokens[j]
                    if (value ~ /^[0-9A-Fa-f:.]+(\/[0-9]+)?$/) {
                        rule_type = value ~ /:/ ? "IP-CIDR6" : "IP-CIDR"
                        if (value !~ /\//) value = value (rule_type == "IP-CIDR6" ? "/128" : "/32")
                        rule_line = "  - " rule_type "," tolower(value) ",🌍 Страна,no-resolve"
                        rule_key = rule_type "," tolower(value)
                        if (!seen_rule_key[rule_key]++) print rule_line
                    }
                }
            }
        }
        BEGIN {
            print "external-controller: 0.0.0.0:9090"
            print "tproxy-port: 1602"
            print "routing-mark: 2097152"
            print "allow-lan: true"
            print "log-level: " level
            print "mode: rule"
            print "enable-process: false"
            print "find-process-mode: off"
        }
        /^(external-controller|tproxy-port|routing-mark|allow-lan|log-level|mode|enable-process|find-process-mode):/ { next }
        /^[[:space:]]*-[[:space:]]*PROCESS-(NAME|NAME-REGEX|PATH|PATH-REGEX),/ { next }
        /^dns:[[:space:]]*$/ {
            in_dns = 1
            dns_listen = 0
            print
            next
        }
        in_dns && /^[^[:space:]]/ {
            if (!dns_listen) print "  listen: 127.0.0.42:53"
            in_dns = 0
        }
        in_dns && /^[[:space:]]+listen:[[:space:]]*/ {
            print "  listen: 127.0.0.42:53"
            dns_listen = 1
            next
        }
        /^proxies:[[:space:]]*$/ {
            print
            if (upstream_enabled == 1)
                while ((getline proxy_line < upstream_snippet) > 0) print proxy_line
            close(upstream_snippet)
            next
        }
        /^rules:[[:space:]]*$/ {
            in_rules = 1
            print
            if (upstream_enabled == 1) print_upstream_domains(upstream_domains)
            if (upstream_enabled == 1) print_upstream_domains(upstream_ready_domains)
            if (user_domain_type == "text") print_user_domains(user_domains)
            if (user_subnet_type == "text") print_user_subnets(user_subnets)
            count = split(fully_routed, ips, /[[:space:]]+/)
            for (i = 1; i <= count; i++)
                if (ips[i] != "") {
                    cidr = ips[i] ~ /\// ? ips[i] : ips[i] "/32"
                    print "  - SRC-IP-CIDR," cidr ",🔒 Полный VPN,no-resolve"
                }
            count = split(smart_routed, ips, /[[:space:]]+/)
            for (i = 1; i <= count; i++)
                if (ips[i] != "") {
                    cidr = ips[i] ~ /\// ? ips[i] : ips[i] "/32"
                    print "  - SRC-IP-CIDR," cidr ",🧠 Умный обход,no-resolve"
                }
            count = split(bypass_ru, ips, /[[:space:]]+/)
            for (i = 1; i <= count; i++)
                if (ips[i] != "") {
                    cidr = ips[i] ~ /\// ? ips[i] : ips[i] "/32"
                    print "  - SRC-IP-CIDR," cidr ",🧠 Умный обход,no-resolve"
                }
            next
        }
        in_rules && /^[^[:space:]]/ { in_rules = 0 }
        in_rules && /^[[:space:]]*-[[:space:]]*(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6),/ {
            rule_text = $0
            sub(/^[[:space:]]*-[[:space:]]*/, "", rule_text)
            split(rule_text, rule_parts, ",")
            rule_key = rule_parts[1] "," tolower(rule_parts[2])
            if (seen_rule_key[rule_key]++) next
        }
        { print }
        END {
            if (in_dns && !dns_listen) print "  listen: 127.0.0.42:53"
        }
    ' "$source" > "$target"
    rm -f "$upstream_snippet"
}

hn_check_upstream_proxy() {
    local protocol server port username password name encoded_name api_result result latency wan_interface
    protocol="$(hn_uci_get main upstream_proxy_protocol)"
    server="$(hn_uci_get main upstream_proxy_server)"
    port="$(hn_uci_get main upstream_proxy_port)"
    username="$(hn_uci_get main upstream_proxy_username)"
    password="$(hn_uci_get main upstream_proxy_password)"
    name="$(hn_uci_get main upstream_proxy_name)"
    [ -n "$name" ] || name="HarpyNet Proxy"
    name="$(printf '%s' "$name" | tr ',' ' ')"

    [ -n "$server" ] && [ -n "$port" ] || {
        hn_json_error "proxy_not_configured"
        return 1
    }
    command -v curl >/dev/null 2>&1 || {
        hn_json_error "curl_not_installed"
        return 1
    }

    encoded_name="$(hn_urlencode "$name")"
    api_result="$(hn_api GET "/proxies/$encoded_name/delay?timeout=10000&url=https%3A%2F%2Fwww.gstatic.com%2Fgenerate_204" 2>/dev/null)"
    latency="$(printf '%s' "$api_result" | jq -r '.delay // empty' 2>/dev/null)"
    if [ -n "$latency" ]; then
        jq -nc --argjson latency_ms "$latency" '{success:true,latency_ms:$latency_ms}'
        return 0
    fi

    case "$protocol" in
        socks5)
            set -- --socks5-hostname "$server:$port"
            ;;
        http)
            set -- --proxy "http://$server:$port"
            ;;
        https)
            set -- --proxy "https://$server:$port"
            ;;
        *)
            hn_json_error "unsupported_proxy_protocol"
            return 1
            ;;
    esac
    [ -n "$username$password" ] && set -- "$@" --proxy-user "$username:$password"
    wan_interface="$(ip -4 route show table main default 2>/dev/null | awk 'NR == 1 { for (i = 1; i <= NF; i++) if ($i == "dev") { print $(i + 1); exit } }')"
    [ -n "$wan_interface" ] && set -- "$@" --interface "$wan_interface"
    result="$(curl "$@" --connect-timeout 8 --max-time 15 --silent --show-error \
        --output /dev/null --write-out '%{time_total}' https://www.gstatic.com/generate_204 2>/dev/null)" || {
        hn_json_error "proxy_unreachable"
        return 1
    }
    latency="$(awk -v seconds="$result" 'BEGIN { printf "%d", (seconds * 1000) + 0.5 }')"
    jq -nc --argjson latency_ms "${latency:-0}" '{success:true,latency_ms:$latency_ms}'
}

hn_prepare_config() {
    local candidate
    hn_require "$MIHOMO_BIN" || return 1
    hn_require jq || return 1
    mkdir -p "$MIHOMO_DIR" "$MIHOMO_CACHE_DIR"

    if [ ! -s "$MIHOMO_RAW" ]; then
        hn_download_subscription || return 1
    fi
    if grep -qE '(^|[[:space:],])GEOIP,' "$MIHOMO_RAW"; then
        hn_prepare_geodata || return 1
    fi

    candidate="$MIHOMO_DIR/config.yaml.new"
    hn_patch_yaml "$MIHOMO_RAW" "$candidate" || return 1
    if ! "$MIHOMO_BIN" -d "$MIHOMO_DIR" -t -f "$candidate" >/tmp/harpynet-mihomo-check.log 2>&1; then
        hn_log "Mihomo rejected generated config: $(tail -n 3 /tmp/harpynet-mihomo-check.log)"
        rm -f "$candidate"
        return 1
    fi

    mv "$candidate" "$MIHOMO_CONFIG"
    cp "$MIHOMO_CONFIG" "$MIHOMO_SAVED"
    hn_setup_policy || return 1
    hn_setup_dns || return 1
    return 0
}

hn_wait_api() {
    local attempt
    attempt=0
    while ! hn_api GET /version >/dev/null 2>&1; do
        attempt=$((attempt + 1))
        [ "$attempt" -lt 20 ] || return 1
        sleep 1
    done
}

hn_apply_config() {
    local payload
    hn_prepare_config || return 1
    payload="$(jq -nc --arg path "$MIHOMO_CONFIG" '{path:$path}')"
    if hn_api PUT "/configs?force=true" "$payload" >/dev/null 2>&1; then
        hn_apply_mode >/dev/null || return 1
        printf '%s\n' '{"success":true,"reload":"hot"}'
        return 0
    fi

    hn_log "Mihomo hot reload failed, using service restart"
    /etc/init.d/harpynet restart >/dev/null 2>&1 || {
        hn_json_error "mihomo_reload_failed"
        return 1
    }
    hn_wait_api || {
        hn_json_error "mihomo_start_timeout"
        return 1
    }
    hn_apply_mode >/dev/null || return 1
    printf '%s\n' '{"success":true,"reload":"restart"}'
}

hn_interfaces_json() {
    local interfaces iface first
    interfaces="$(uci -q get harpynet.settings.source_network_interfaces 2>/dev/null)"
    [ -n "$interfaces" ] || interfaces="br-lan"
    first=1
    for iface in $interfaces; do
        [ "$first" = 1 ] || printf ', '
        printf '"%s"' "$iface"
        first=0
    done
}

hn_setup_policy() {
    local nft_file interfaces excluded ip first
    nft_file="/tmp/harpynet.nft"
    interfaces="$(hn_interfaces_json)"
    excluded="$(uci -q get harpynet.settings.routing_excluded_ips 2>/dev/null)"

    nft delete table inet HarpyNetTable >/dev/null 2>&1 || true
    {
        printf 'table inet HarpyNetTable {\n'
        printf ' set interfaces { type ifname; elements = { %s } }\n' "$interfaces"
        printf ' set bypass_src { type ipv4_addr; flags interval;'
        if [ -n "$excluded" ]; then
            printf ' elements = { '
            first=1
            for ip in $excluded; do
                [ "$first" = 1 ] || printf ', '
                printf '%s' "$ip"
                first=0
            done
            printf ' }'
        fi
        printf ' }\n'
        printf ' chain mark_prerouting { type filter hook prerouting priority mangle; policy accept;\n'
        printf '  ct status dnat return\n'
        printf '  iifname != @interfaces return\n'
        printf '  ip saddr @bypass_src return\n'
        printf '  ip daddr { 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4 } return\n'
        printf '  meta l4proto { tcp, udp } meta mark set %s\n' "$MIHOMO_MARK"
        printf ' }\n'
        printf ' chain tproxy_prerouting { type filter hook prerouting priority dstnat; policy accept;\n'
        printf '  meta mark & %s == %s meta l4proto { tcp, udp } tproxy ip to 127.0.0.1:%s\n' "$MIHOMO_MARK" "$MIHOMO_MARK" "$MIHOMO_TPROXY_PORT"
        printf ' }\n'
        printf '}\n'
    } > "$nft_file"
    nft -f "$nft_file" || return 1

    grep -qE '^[[:space:]]*105[[:space:]]+harpynet$' /etc/iproute2/rt_tables 2>/dev/null ||
        printf '105 harpynet\n' >> /etc/iproute2/rt_tables
    ip -4 rule del fwmark "$MIHOMO_MARK/$MIHOMO_MARK" table "$MIHOMO_TABLE" priority "$MIHOMO_TABLE" >/dev/null 2>&1 || true
    ip -4 rule add fwmark "$MIHOMO_MARK/$MIHOMO_MARK" table "$MIHOMO_TABLE" priority "$MIHOMO_TABLE"
    ip -4 route replace local default dev lo table "$MIHOMO_TABLE"
}

hn_setup_dns() {
    local dont_touch previous item fallback_dns
    dont_touch="$(hn_uci_get settings dont_touch_dhcp)"
    [ "$dont_touch" = "1" ] && return 0

    if [ "$(hn_uci_get settings dnsmasq_backup_done)" != "1" ]; then
        previous="$(uci -q get dhcp.@dnsmasq[0].server)"
        uci -q set "harpynet.settings.dnsmasq_server_before=$previous"
        uci -q set "harpynet.settings.dnsmasq_noresolv_before=$(uci -q get dhcp.@dnsmasq[0].noresolv)"
        uci -q set harpynet.settings.dnsmasq_backup_done='1'
        uci -q commit harpynet
    fi
    fallback_dns="$(hn_uci_get settings bootstrap_dns_server)"
    case "$fallback_dns" in
        *[!0-9.]*|"") fallback_dns="77.88.8.8" ;;
    esac
    uci -q delete dhcp.@dnsmasq[0].server
    uci -q add_list dhcp.@dnsmasq[0].server='127.0.0.42#53'
    uci -q add_list "dhcp.@dnsmasq[0].server=$fallback_dns"
    uci -q set dhcp.@dnsmasq[0].noresolv='1'
    uci -q set dhcp.@dnsmasq[0].strictorder='1'
    uci -q commit dhcp
    /etc/init.d/dnsmasq restart >/dev/null 2>&1
}

hn_refresh_dns() {
    hn_setup_dns || return 1
    jq -nc --arg bootstrap "$(hn_uci_get settings bootstrap_dns_server)" \
        '{success:true,bootstrap_dns:$bootstrap}'
}

hn_restore_dns() {
    local previous item noresolv
    [ "$(hn_uci_get settings dnsmasq_backup_done)" = "1" ] || return 0
    previous="$(hn_uci_get settings dnsmasq_server_before)"
    noresolv="$(hn_uci_get settings dnsmasq_noresolv_before)"
    uci -q delete dhcp.@dnsmasq[0].server
    for item in $previous; do
        uci -q add_list "dhcp.@dnsmasq[0].server=$item"
    done
    uci -q delete dhcp.@dnsmasq[0].strictorder
    if [ -n "$noresolv" ]; then
        uci -q set "dhcp.@dnsmasq[0].noresolv=$noresolv"
    else
        uci -q delete dhcp.@dnsmasq[0].noresolv
    fi
    uci -q commit dhcp
    uci -q delete harpynet.settings.dnsmasq_backup_done
    uci -q commit harpynet
    /etc/init.d/dnsmasq restart >/dev/null 2>&1
}

hn_force_direct_dns() {
    uci -q delete dhcp.@dnsmasq[0].server
    uci -q delete dhcp.@dnsmasq[0].noresolv
    uci -q delete dhcp.@dnsmasq[0].strictorder
    uci -q commit dhcp
    uci -q delete harpynet.settings.dnsmasq_backup_done
    uci -q delete harpynet.settings.dnsmasq_server_before
    uci -q delete harpynet.settings.dnsmasq_noresolv_before
    uci -q commit harpynet
    /etc/init.d/dnsmasq restart >/dev/null 2>&1
}

hn_cleanup() {
    nft delete table inet HarpyNetTable >/dev/null 2>&1 || true
    ip -4 rule del fwmark "$MIHOMO_MARK/$MIHOMO_MARK" table "$MIHOMO_TABLE" priority "$MIHOMO_TABLE" >/dev/null 2>&1 || true
    ip -4 route flush table "$MIHOMO_TABLE" >/dev/null 2>&1 || true
    hn_restore_dns
}

hn_api() {
    local method path data
    method="$1"
    path="$2"
    data="$3"
    if [ -n "$data" ]; then
        curl -fsS --max-time 15 -X "$method" -H 'Content-Type: application/json' -d "$data" "$MIHOMO_API$path"
    else
        curl -fsS --max-time 15 -X "$method" "$MIHOMO_API$path"
    fi
}

hn_urlencode() {
    jq -nr --arg value "$1" '$value|@uri'
}

hn_primary_group() {
    local proxies
    proxies="$(hn_api GET /proxies 2>/dev/null)" || return 1
    printf '%s' "$proxies" | jq -r '
        .proxies as $p |
        if $p["🌍 Страна"] then "🌍 Страна"
        elif $p["main-out"] then "main-out"
        else ([ $p | to_entries[] |
            select(.value.type == "Selector") |
            select(.key != "GLOBAL") |
            select(.key | test("Режим|Полный VPN|Умный обход") | not) |
            .key ][0] // "GLOBAL") end'
}

hn_clash_api() {
    local action group tag timeout encoded payload
    action="$1"
    shift
    case "$action" in
        get_proxies) hn_api GET /proxies ;;
        get_connections) hn_api GET /connections ;;
        close_connection)
            encoded="$(hn_urlencode "$1")"
            hn_api DELETE "/connections/$encoded"
            ;;
        close_all_connections) hn_api DELETE /connections ;;
        set_group_proxy)
            group="$1"
            tag="$2"
            [ "$group" = "main-out" ] && group="$(hn_primary_group)"
            encoded="$(hn_urlencode "$group")"
            payload="$(jq -nc --arg name "$tag" '{name:$name}')"
            hn_api PUT "/proxies/$encoded" "$payload" &&
                uci -q set "harpynet.main.selected_outbound=$tag" &&
                uci -q commit harpynet
            ;;
        get_group_latency)
            group="$1"
            timeout="${2:-8000}"
            [ "$group" = "main-out" ] && group="$(hn_primary_group)"
            encoded="$(hn_urlencode "$group")"
            hn_api GET "/group/$encoded/delay?url=https%3A%2F%2Fwww.gstatic.com%2Fgenerate_204&timeout=$timeout"
            ;;
        *) hn_json_error "unknown_clash_api_action"; return 1 ;;
    esac
}

hn_outbounds() {
    local proxies group
    proxies="$(hn_api GET /proxies 2>/dev/null)" || {
        printf '%s\n' '{"success":false,"outbounds":[]}'
        return 1
    }
    group="$(printf '%s' "$proxies" | jq -r '
        .proxies as $p |
        if $p["🌍 Страна"] then "🌍 Страна"
        elif $p["main-out"] then "main-out"
        else ([ $p | to_entries[] | select(.value.type=="Selector" and .key!="GLOBAL") | .key ][0] // "GLOBAL") end')"
    printf '%s' "$proxies" | jq -c --arg group "$group" '
        .proxies as $p |
        {success:true,group:$group,outbounds:[
            ($p[$group].all // [])[] as $name |
            {tag:$name,name:$name,type:($p[$name].type // "Proxy"),link:""}
        ]}'
}

hn_apply_mode() {
    local mode target group encoded payload config_payload
    mode="$(hn_uci_get main connection_type)"
    group="🔁 Режим"

    if [ "$mode" = "exclusion" ]; then
        /etc/init.d/harpynet stop >/dev/null 2>&1 || true
        hn_cleanup
        hn_force_direct_dns
        jq -nc '{success:true,connection_type:"exclusion",target:"DIRECT",vpn_enabled:false}'
        return 0
    fi

    if ! hn_api GET /version >/dev/null 2>&1; then
        /etc/init.d/harpynet start >/dev/null 2>&1 || {
            hn_json_error "mihomo_start_failed"
            return 1
        }
        local attempt
        attempt=0
        while ! hn_api GET /version >/dev/null 2>&1; do
            attempt=$((attempt + 1))
            [ "$attempt" -lt 10 ] || {
                hn_json_error "mihomo_api_unavailable"
                return 1
            }
            sleep 1
        done
    fi

    nft list table inet HarpyNetTable >/dev/null 2>&1 || hn_setup_policy || return 1
    case "$(uci -q get dhcp.@dnsmasq[0].server 2>/dev/null)" in
        *127.0.0.42*) ;;
        *) hn_setup_dns || return 1 ;;
    esac

    case "$mode" in
        full_proxy) target="🔒 Полный VPN" ;;
        proxy|full_proxy_bypass_ru|"") target="🧠 Умный обход" ;;
        *) hn_json_error "invalid_connection_type"; return 1 ;;
    esac
    encoded="$(hn_urlencode "$group")"
    payload="$(jq -nc --arg name "$target" '{name:$name}')"
    hn_api PUT "/proxies/$encoded" "$payload" >/dev/null || {
        hn_json_error "mihomo_mode_switch_failed"
        return 1
    }

    config_payload='{"mode":"rule"}'
    hn_api PATCH "/configs" "$config_payload" >/dev/null || {
        hn_json_error "mihomo_runtime_mode_failed"
        return 1
    }

    jq -nc --arg mode "$mode" --arg target "$target" \
        '{success:true,connection_type:$mode,target:$target}'
}

hn_devices() {
    local leases leases_json gl_clients
    leases="/tmp/dhcp.leases"
    leases_json="$(
        awk 'NF>=4 {
            printf "%s%s\t%s\t%s", (n++ ? "\n" : ""), $3, $2, $4
        }' "$leases" 2>/dev/null | jq -Rsc '
            split("\n") | map(select(length>0) | split("\t") | {
                ip:.[0],
                mac:.[1],
                name:(.[2] | if .=="*" then "" else . end)
            })'
    )"
    [ -n "$leases_json" ] || leases_json='[]'

    gl_clients="$(
        ubus call gl-clients list '{}' 2>/dev/null | jq -c '{
            clients: ((.clients // {}) | with_entries(
                .value |= {
                    ip:(.ip // ""),
                    mac:(.mac // ""),
                    name:(.name // ""),
                    iface:(.iface // ""),
                    type:(.type // 0),
                    online:(.online // false)
                }
            ))
        }' 2>/dev/null
    )"
    [ -n "$gl_clients" ] || gl_clients='{"clients":{}}'

    jq -nc --argjson gl "$gl_clients" --argjson leases "$leases_json" '
        (reduce $leases[] as $lease ({}; .[$lease.ip] = $lease)) as $lease_by_ip |
        ($gl.clients | to_entries | map(
            .value as $client |
            ($client.ip // "") as $ip |
            ($client.iface | ascii_downcase) as $iface |
            {
                ip:$ip,
                mac:(if ($client.mac // "") != "" then $client.mac else .key end),
                hostname:($lease_by_ip[$ip].name // ""),
                name:(if ($client.name // "") != "" then $client.name else ($lease_by_ip[$ip].name // "") end),
                connection:(
                    if $iface == "cable" then "LAN"
                    elif $iface == "2.4g" or $iface == "2g" then "Wi-Fi 2.4"
                    elif $iface == "5g" then "Wi-Fi 5G"
                    else "Wi-Fi"
                    end +
                    (if $client.online then "" else " / не активно" end)
                ),
                online:$client.online
            }
        ) | map(select(.ip != ""))) as $gl_devices |
        ($gl_devices | map(.ip)) as $gl_ips |
        ($gl_devices + (
            $leases | map(. as $lease | select(
                $lease.ip != "" and (($gl_ips | index($lease.ip)) == null)
            ) | {
                ip:$lease.ip,
                mac:$lease.mac,
                hostname:$lease.name,
                name:$lease.name,
                connection:"DHCP / не активно",
                online:false
            })
        ) | unique_by(.ip) | sort_by(.ip)) as $devices |
        {
            clients:($devices | map({
                key:.ip,
                value:(if .name != "" then .name else "Неизвестное устройство" end)
            }) | from_entries),
            devices:$devices
        }'
}

hn_remove_list_value() {
    local section option value current item
    section="$1"; option="$2"; value="$3"
    current="$(uci -q get "harpynet.$section.$option" 2>/dev/null)"
    uci -q delete "harpynet.$section.$option"
    for item in $current; do
        [ "$item" = "$value" ] || uci -q add_list "harpynet.$section.$option=$item"
    done
}

hn_set_device_route() {
    local ip mode
    ip="$1"; mode="$2"
    hn_remove_list_value settings routing_excluded_ips "$ip"
    hn_remove_list_value main fully_routed_ips "$ip"
    hn_remove_list_value main smart_routed_ips "$ip"
    hn_remove_list_value main bypass_ru_routed_ips "$ip"
    case "$mode" in
        exclude) uci -q add_list "harpynet.settings.routing_excluded_ips=$ip" ;;
        full_proxy) uci -q add_list "harpynet.main.fully_routed_ips=$ip" ;;
        proxy) uci -q add_list "harpynet.main.smart_routed_ips=$ip" ;;
        full_proxy_bypass_ru) uci -q add_list "harpynet.main.bypass_ru_routed_ips=$ip" ;;
        default) ;;
        *) hn_json_error "invalid_mode"; return 1 ;;
    esac
    uci -q commit harpynet
    if hn_api GET /version >/dev/null 2>&1; then
        /etc/init.d/harpynet restart >/dev/null 2>&1 || {
            hn_json_error "mihomo_restart_failed"
            return 1
        }
        hn_apply_mode >/dev/null || return 1
    else
        hn_setup_policy
    fi
    printf '%s\n' '{"success":true}'
}

hn_set_device_outbound() {
    local ip outbound current entry
    ip="$1"; outbound="$2"
    current="$(uci -q get harpynet.main.device_outbounds 2>/dev/null)"
    uci -q delete harpynet.main.device_outbounds
    for entry in $current; do
        case "$entry" in "$ip="*) ;; *) uci -q add_list "harpynet.main.device_outbounds=$entry" ;; esac
    done
    [ "$outbound" = "default" ] || uci -q add_list "harpynet.main.device_outbounds=$ip=$outbound"
    uci -q commit harpynet
    printf '%s\n' '{"success":true}'
}

hn_status() {
    local running version
    running=0
    hn_api GET /version >/dev/null 2>&1 && running=1
    version="$("$MIHOMO_BIN" -v 2>/dev/null | head -n1)"
    jq -nc --argjson running "$running" --arg version "$version" \
        '{running:$running,backend:"mihomo",version:$version,config:"/tmp/mihomo/config.yaml"}'
}

hn_connection_failures() {
    logread -e mihomo 2>/dev/null | tail -n 400 | awk '
        / error: / && / --> / {
            split($0, halves, " --> ")
            left = halves[1]
            right = halves[2]
            split(right, detail, " error: ")
            destination = detail[1]
            error = detail[2]
            sub(/"$/, "", error)
            count = split(left, words, /[[:space:]]+/)
            source = words[count]
            gsub(/\t/, " ", error)
            print source "\t" destination "\t" error
        }
    ' | tail -n 50 | jq -Rsc '
        split("\n") | map(select(length > 0) | split("\t") |
        {
            id:("failure-" + (((.[0] // "") | split(":")[0])) + "-" + (.[1] // "") + "-" + (.[2] // "")),
            _failure:true,
            metadata:{
                sourceIP:((.[0] // "") | split(":")[0]),
                host:((.[1] // "") | split(":")[0]),
                destinationIP:((.[1] // "") | split(":")[0]),
                destinationPort:((.[1] // "") | split(":")[1] // ""),
                network:"tcp"
            },
            chains:["Сбой"],
            rule:"Сбой",
            error:(.[2] // "Соединение не установлено"),
            upload:0,
            download:0
        }) | unique_by(.id) | reverse'
}

hn_subscription_update() {
    hn_download_subscription &&
        hn_apply_config
}

hn_save_subscription() {
    local section url
    section="$1"; url="$2"
    uci -q set "harpynet.$section.subscription_url=$url"
    uci -q commit harpynet
    printf '%s\n' '{"success":true}'
}

hn_show_version() {
    printf '%s\n' "$HARPYNET_VERSION"
}

harpynet_main() {
    local command
    command="$1"
    shift 2>/dev/null || true
    case "$command" in
        prepare) hn_prepare_config ;;
        cleanup) hn_cleanup ;;
        start) /etc/init.d/harpynet start ;;
        stop) /etc/init.d/harpynet stop ;;
        restart|reload) /etc/init.d/harpynet restart ;;
        get_status|get_mihomo_status) hn_status ;;
        get_connection_failures) hn_connection_failures ;;
        show_version|show_mihomo_version) hn_show_version ;;
        get_subscription_metadata) [ -s "$MIHOMO_METADATA" ] && cat "$MIHOMO_METADATA" || printf '%s\n' '{}' ;;
        get_device_outbound_options) hn_outbounds ;;
        get_dhcp_clients) hn_devices ;;
        set_device_route) hn_set_device_route "$@" ;;
        set_device_outbound) hn_set_device_outbound "$@" ;;
        apply_mode) hn_apply_mode ;;
        apply_config) hn_apply_config ;;
        prepare_geodata) hn_prepare_geodata && printf '%s\n' '{"success":true}' ;;
        wait_ready) hn_wait_api && printf '%s\n' '{"success":true}' || {
            hn_json_error "mihomo_start_timeout"
            return 1
        } ;;
        refresh_dns) hn_refresh_dns ;;
        save_subscription_url) hn_save_subscription "$@" ;;
        subscription_update) hn_subscription_update ;;
        clash_api) hn_clash_api "$@" ;;
        check_upstream_proxy) hn_check_upstream_proxy ;;
        *)
            hn_json_error "unknown_command:$command"
            return 1
            ;;
    esac
}
