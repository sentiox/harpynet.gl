include $(TOPDIR)/rules.mk

PKG_NAME:=harpynet-gl-ui
PKG_VERSION:=1.3.9.11
PKG_RELEASE:=1
PKG_MAINTAINER:=sentiox <harpynet@sentiox>
PKG_LICENSE:=GPL-2.0-or-later

include $(INCLUDE_DIR)/package.mk

define Package/harpynet-gl-ui
  SECTION:=net
  CATEGORY:=Network
  TITLE:=HarpyNet native GL.iNet UI
  DEPENDS:=+harpynet +rpcd +jq
endef

define Package/harpynet-gl-ui/description
  Native GL.iNet OUI interface for HarpyNet.
endef

define Package/harpynet-gl-ui/install
	$(INSTALL_DIR) $(1)/usr/share/oui/menu.d
	$(INSTALL_CONF) ./files/usr/share/oui/menu.d/harpynet.json $(1)/usr/share/oui/menu.d/harpynet.json

	$(INSTALL_DIR) $(1)/www/views
	$(INSTALL_DATA) ./files/www/views/gl-sdk4-ui-harpynet.common.js $(1)/www/views/gl-sdk4-ui-harpynet.common.js

	$(INSTALL_DIR) $(1)/www/harpynet/icons
	$(INSTALL_DATA) ./files/www/harpynet/icons/*.png $(1)/www/harpynet/icons/

	$(INSTALL_DIR) $(1)/www/harpynet/flags
	$(INSTALL_DATA) ./files/www/harpynet/flags/*.png $(1)/www/harpynet/flags/

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/usr/libexec/rpcd/harpynet_gl $(1)/usr/libexec/rpcd/harpynet_gl

	$(INSTALL_DIR) $(1)/usr/lib/oui-httpd/rpc
	$(INSTALL_DATA) ./files/usr/lib/oui-httpd/rpc/harpynet_gl $(1)/usr/lib/oui-httpd/rpc/harpynet_gl

	$(INSTALL_DIR) $(1)/usr/lib
	$(INSTALL_BIN) ./files/usr/lib/harpynet_direct_monitor.sh $(1)/usr/lib/harpynet_direct_monitor.sh

	$(INSTALL_DIR) $(1)/usr/share/gl-validator.d
	$(INSTALL_DATA) ./files/usr/share/gl-validator.d/harpynet_gl.lua $(1)/usr/share/gl-validator.d/harpynet_gl.lua

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_CONF) ./files/usr/share/rpcd/acl.d/harpynet-gl.json $(1)/usr/share/rpcd/acl.d/harpynet-gl.json
endef

define Package/harpynet-gl-ui/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
if uci -q get dhcp.@dnsmasq[0] >/dev/null 2>&1; then
	uci -q set dhcp.@dnsmasq[0].logqueries='1'
	uci -q commit dhcp
	/etc/init.d/dnsmasq restart >/dev/null 2>&1 || true
fi
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/nginx reload >/dev/null 2>&1 || true
exit 0
endef

define Package/harpynet-gl-ui/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/nginx reload >/dev/null 2>&1 || true
exit 0
endef

$(eval $(call BuildPackage,harpynet-gl-ui))
