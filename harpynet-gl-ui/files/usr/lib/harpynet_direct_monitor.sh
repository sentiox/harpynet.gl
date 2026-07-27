#!/bin/sh

dns_map="/tmp/harpynet-direct-dns.map"
dns_new="${dns_map}.new.$$"
dns_merged="${dns_map}.merged.$$"
logread 2>/dev/null | awk '
/dnsmasq.* reply [A-Za-z0-9._-]+ is [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ {
    domain = $(NF - 2)
    ip = $NF
    if (domain ~ /^[A-Za-z0-9._-]+$/) names[ip] = domain
}
END {
    for (ip in names) print ip, names[ip]
}' > "$dns_new"

touch "$dns_map"
awk '{ if ($1 ~ /^[0-9.]+$/ && $2 ~ /^[A-Za-z0-9._-]+$/) names[$1] = $2 }
END { for (ip in names) print ip, names[ip] }' "$dns_map" "$dns_new" |
    tail -n 4096 > "$dns_merged"
mv "$dns_merged" "$dns_map"
rm -f "$dns_new"

conntrack -L -o extended 2>/dev/null | awk '
FILENAME != "-" {
    domains[$1] = $2
    next
}
function private_ip(ip, a) {
    split(ip, a, ".")
    return a[1] == 10 || (a[1] == 172 && a[2] >= 16 && a[2] <= 31) || (a[1] == 192 && a[2] == 168)
}
function value(token) {
    sub(/^[^=]*=/, "", token)
    return token
}
BEGIN {
    print "{\"ok\":true,\"connections\":["
    first = 1
}
{
    proto = $3
    timeout = $5 + 0
    state = ""
    src = dst = sport = dport = packets = bytes = ""
    reply_packets = reply_bytes = ""
    tuple = 1
    unreplied = 0

    for (i = 6; i <= NF; i++) {
        token = $i
        if (token == "[UNREPLIED]") unreplied = 1
        if (token ~ /^(SYN_SENT|SYN_RECV|ESTABLISHED|FIN_WAIT|CLOSE_WAIT|LAST_ACK|TIME_WAIT|CLOSE)$/) state = token
        if (token ~ /^src=/) {
            if (src != "") tuple = 2
            if (tuple == 1) src = value(token)
        } else if (token ~ /^dst=/ && tuple == 1 && dst == "") dst = value(token)
        else if (token ~ /^sport=/ && tuple == 1 && sport == "") sport = value(token)
        else if (token ~ /^dport=/ && tuple == 1 && dport == "") dport = value(token)
        else if (token ~ /^packets=/) {
            if (tuple == 1 && packets == "") packets = value(token)
            else if (tuple == 2 && reply_packets == "") reply_packets = value(token)
        } else if (token ~ /^bytes=/) {
            if (tuple == 1 && bytes == "") bytes = value(token)
            else if (tuple == 2 && reply_bytes == "") reply_bytes = value(token)
        }
    }

    if (!private_ip(src) || src == dst || dst == "") next
    if (state == "") state = unreplied ? "UNREPLIED" : "ACTIVE"
    failure = unreplied || state == "SYN_SENT"

    key = src SUBSEP dst
    traffic = (bytes + 0) + (reply_bytes + 0)
    if (!(key in seen)) {
        if (count >= 300) next
        seen[key] = 1
        order[++count] = key
        best_failure[key] = failure
        best_traffic[key] = -1
    }
    if (best_traffic[key] < 0 || (best_failure[key] && !failure) || (best_failure[key] == failure && traffic > best_traffic[key])) {
        best_proto[key] = proto
        best_src[key] = src
        best_dst[key] = dst
        best_sport[key] = sport + 0
        best_dport[key] = dport + 0
        best_state[key] = state
        best_timeout[key] = timeout
        best_failure[key] = failure
        best_traffic[key] = traffic
    }
    sum_up[key] += bytes + 0
    sum_down[key] += reply_bytes + 0
    total_up += bytes + 0
    total_down += reply_bytes + 0
}
END {
    for (n = 1; n <= count; n++) {
        key = order[n]
        if (!first) printf ","
        first = 0
        printf "{\"id\":\"%s-%s-%s-%s\",\"protocol\":\"%s\",\"source\":\"%s\",\"destination\":\"%s\",\"domain\":\"%s\",\"sourcePort\":%d,\"destinationPort\":%d,\"state\":\"%s\",\"timeout\":%d,\"upload\":%d,\"download\":%d,\"failure\":%s}", best_proto[key], best_src[key], best_dst[key], best_dport[key], best_proto[key], best_src[key], best_dst[key], domains[best_dst[key]], best_sport[key], best_dport[key], best_state[key], best_timeout[key], sum_up[key], sum_down[key], best_failure[key] ? "true" : "false"
    }
    printf "],\"count\":%d,\"uploadTotal\":%d,\"downloadTotal\":%d}\n", count, total_up, total_down
}' "$dns_map" -
