include $(TOPDIR)/rules.mk

PKG_NAME:=harpynet

PKG_VERSION := $(if $(HARPYNET_VERSION),$(HARPYNET_VERSION),1.3.9.11)

PKG_RELEASE:=1

PKG_MAINTAINER:=sentiox <harpynet@sentiox>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/harpynet
	SECTION:=net
	CATEGORY:=Network
	DEPENDS:=+curl +jq +kmod-nft-tproxy +coreutils-base64 +bind-dig
	CONFLICTS:=https-dns-proxy nextdns luci-app-passwall luci-app-passwall2
	TITLE:=Domain routing app
	URL:=https://github.com/sentiox/narpynet
	PKGARCH:=all
endef

define Package/harpynet/description
	Domain routing. Use of VLESS, Shadowsocks technologies
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/harpynet/prerm
#!/bin/sh

grep -q "105 harpynet" /etc/iproute2/rt_tables && sed -i "/105 harpynet/d" /etc/iproute2/rt_tables

/etc/init.d/harpynet stop

exit 0
endef

define Package/harpynet/postinst
#!/bin/sh

[ -n "$${IPKG_INSTROOT}" ] && exit 0

if [ -x /usr/bin/mihomo ] && [ -x /etc/init.d/harpynet ]; then
	/etc/init.d/harpynet restart >/dev/null 2>&1 || true
fi

exit 0
endef

define Package/harpynet/conffiles
/etc/config/harpynet
endef

define Package/harpynet/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/harpynet $(1)/etc/init.d/harpynet

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/harpynet $(1)/etc/config/harpynet

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/harpynet $(1)/usr/bin/harpynet

	$(INSTALL_DIR) $(1)/usr/lib/harpynet
	$(CP) ./files/usr/lib/harpynet/* $(1)/usr/lib/harpynet/
endef

$(eval $(call BuildPackage,harpynet))
