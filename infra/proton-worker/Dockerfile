FROM alpine:3.22
RUN apk add --no-cache wireguard-tools iptables ip6tables openresolv curl tinyproxy
COPY entrypoint.sh /entrypoint.sh
RUN chmod 700 /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
