return {
    status = {},
    summary = {},
    version = {},
    start = {},
    stop = {},
    restart = {},
    enable = {},
    disable = {},
    subscription_update = {},
    dashboard = {},
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
