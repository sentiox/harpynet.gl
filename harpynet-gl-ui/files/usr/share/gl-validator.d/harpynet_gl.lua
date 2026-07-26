return {
    status = {},
    summary = {},
    version = {},
    mihomo_config = {},
    start = {},
    stop = {},
    restart = {},
    enable = {},
    disable = {},
    subscription_update = {},
    check_upstream_proxy = {
        section = function(value)
            return value == nil or value == "" or value == "main"
        end
    },
    dashboard = {},
    devices = {},
    connections = {},
    close_all_connections = {},
    set_device_route = {
        ip = function(value)
            return type(value) == "string" and value:match("^%d+%.%d+%.%d+%.%d+$") ~= nil
        end,
        mode = function(value)
            return value == "default" or value == "proxy" or value == "full_proxy" or value == "full_proxy_bypass_ru" or value == "exclude"
        end
    },
    set_device_outbound = {
        ip = function(value)
            return type(value) == "string" and value:match("^%d+%.%d+%.%d+%.%d+$") ~= nil
        end,
        outbound = function(value)
            return type(value) == "string" and #value <= 180 and not value:find("[%z\r\n\t]")
        end
    },
    logs = {
        kind = function(value)
            return value == nil or value == "" or value == "dashboard"
        end
    },
    set_subscription = {
        url = function(value)
            return type(value) == "string"
                and #value > 0
                and #value <= 4096
                and not value:find("[%z\r\n%s]")
                and (value:match("^https://") or value:match("^http://"))
        end
    },
    close_connection = {
        id = function(value)
            return type(value) == "string"
                and #value > 0
                and #value <= 256
                and not value:find("[%z\r\n]")
        end
    },
    select_outbound = {
        tag = function(value)
            return type(value) == "string"
                and #value > 0
                and #value <= 256
                and not value:find("[%z\r\n]")
        end
    },
    test_latency = {},
    set_settings_config = {
        dns_type = function(value)
            return value == "udp" or value == "dot" or value == "doh"
        end,
        dns_server = function(value) return type(value) == "string" and #value > 0 and #value <= 512 and not value:find("[%z\r\n]") end,
        bootstrap_dns_server = function(value) return type(value) == "string" and #value > 0 and #value <= 512 and not value:find("[%z\r\n]") end,
        dns_rewrite_ttl = function(value) return type(value) == "string" and value:match("^%d+$") and #value <= 6 end,
        source_network_interfaces = function(value) return type(value) == "string" and #value <= 2048 end,
        enable_output_network_interface = function(value) return value == "0" or value == "1" end,
        output_network_interface = function(value) return type(value) == "string" and #value <= 128 and not value:find("[%z\r\n]") end,
        enable_badwan_interface_monitoring = function(value) return value == "0" or value == "1" end,
        badwan_monitored_interfaces = function(value) return type(value) == "string" and #value <= 2048 end,
        enable_yacd = function(value) return value == "0" or value == "1" end,
        disable_quic = function(value) return value == "0" or value == "1" end,
        update_interval = function(value)
            return value == "1h" or value == "3h" or value == "6h" or value == "12h" or value == "1d" or value == "3d"
        end,
        subscription_update_interval = function(value)
            return value == "1h" or value == "3h" or value == "6h" or value == "12h" or value == "1d" or value == "3d"
        end,
        download_lists_via_proxy = function(value) return value == "0" or value == "1" end,
        dont_touch_dhcp = function(value) return value == "0" or value == "1" end,
        config_path = function(value) return type(value) == "string" and #value > 0 and #value <= 512 and not value:find("[%z\r\n]") end,
        cache_path = function(value) return type(value) == "string" and #value > 0 and #value <= 512 and not value:find("[%z\r\n]") end,
        log_level = function(value)
            return value == "trace" or value == "debug" or value == "info" or value == "warn" or value == "error" or value == "fatal" or value == "panic"
        end,
        exclude_ntp = function(value) return value == "0" or value == "1" end,
        routing_excluded_ips = function(value) return type(value) == "string" and #value <= 4096 end
    },
    set_main_config = {
        connection_type = function(value)
            return value == "proxy" or value == "full_proxy" or value == "full_proxy_bypass_ru" or value == "exclusion"
        end,
        user_domain_list_type = function(value)
            return value == "disabled" or value == "dynamic" or value == "text"
        end,
        user_subnet_list_type = function(value)
            return value == "disabled" or value == "dynamic" or value == "text"
        end,
        enable_udp_over_tcp = function(value) return value == "0" or value == "1" end,
        upstream_proxy_enabled = function(value) return value == "0" or value == "1" end,
        upstream_proxy_name = function(value) return type(value) == "string" and #value <= 128 end,
        upstream_proxy_protocol = function(value) return value == "http" or value == "https" or value == "socks5" end,
        upstream_proxy_server = function(value) return type(value) == "string" and #value <= 255 and not value:find("[%z\r\n]") end,
        upstream_proxy_port = function(value) return type(value) == "string" and #value <= 5 end,
        upstream_proxy_username = function(value) return type(value) == "string" and #value <= 256 and not value:find("[%z\r\n]") end,
        upstream_proxy_password = function(value) return type(value) == "string" and #value <= 512 and not value:find("[%z\r\n]") end,
        upstream_proxy_tls_server_name = function(value) return type(value) == "string" and #value <= 255 and not value:find("[%z\r\n]") end,
        upstream_proxy_community_lists = function(value) return type(value) == "string" and #value <= 4096 end,
        upstream_proxy_domains = function(value) return type(value) == "string" and #value <= 8192 end,
        mixed_proxy_enabled = function(value) return value == "0" or value == "1" end,
        resolve_real_ip_for_routing = function(value) return value == "0" or value == "1" end,
        community_lists = function(value) return type(value) == "string" and #value <= 4096 end,
        user_domains_text = function(value) return type(value) == "string" and #value <= 16384 end,
        user_subnets_text = function(value) return type(value) == "string" and #value <= 16384 end,
        local_domain_lists = function(value) return type(value) == "string" and #value <= 8192 end,
        local_subnet_lists = function(value) return type(value) == "string" and #value <= 8192 end,
        remote_domain_lists = function(value) return type(value) == "string" and #value <= 8192 end,
        remote_subnet_lists = function(value) return type(value) == "string" and #value <= 8192 end,
        fully_routed_ips = function(value) return type(value) == "string" and #value <= 8192 end,
        mixed_proxy_port = function(value) return type(value) == "string" and #value <= 5 end
    }
}
