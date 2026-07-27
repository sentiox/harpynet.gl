({
  name: "harpynet",
  data: function () {
    return {
      loading: false,
      actionLoading: "",
      error: "",
      notice: "",
      status: null,
      activeTab: "sections",
      tabSlideDirection: 1,
      theme: "dark",
      formDirty: false,
      form: this.emptyForm(),
      advancedListOpen: {
        local: false,
        remote: false,
        routed: false,
        excluded: false
      },
      settingsDirty: false,
      settingsForm: this.emptySettingsForm(),
      settingsComboOpen: "",
      readyListsOpen: false,
      readyListSearch: "",
      proxyReadyListsOpen: false,
      proxyReadyListSearch: "",
      subscriptionModalOpen: false,
      subscriptionUrl: "",
      subscriptionSaving: false,
      mihomoModalOpen: false,
      mihomoConfigLoading: false,
      mihomoConfigError: "",
      mihomoConfig: null,
      mihomoConfigSearch: "",
      mihomoConfigWrap: false,
      connectionsLoading: false,
      connectionsError: "",
      connectionsSearch: "",
      connectionsMode: "active",
      connections: [],
      directConnections: [],
      directConnectionFailures: [],
      directConnectionsTotals: { upload: 0, download: 0 },
      closedConnections: [],
      connectionFailures: [],
      connectionsInitialized: false,
      connectionDeviceNames: {},
      connectionsTotals: { upload: 0, download: 0 },
      devicesLoading: false,
      devicesError: "",
      devices: [],
      deviceOutbounds: [],
      deviceRouteModes: {},
      devicePendingRoutes: {},
      deviceFilter: "all",
      dashboardLoading: false,
      dashboardError: "",
      dashboardLatencyLoading: false,
      dashboardLatencyStep: 0,
      dashboardLatencyTimer: null,
      dashboardLatencyResolved: false,
      dashboardLatencyFresh: false,
      dashboardLatencyCount: 0,
      outboundSwitching: "",
      dashboard: null,
      themeObserver: null,
      themePoller: null,
      themeSync: null,
      noticeTimer: null,
      noticeRemaining: 0,
      noticeProgress: 0,
      noticeFrame: null,
      timer: null,
      connectionsTimer: null,
      connectionsRefreshing: false,
      mainAutoSaveTimer: null,
      mainAutoSaveKeys: [],
      mainAutoSaving: false
    };
  },
  computed: {
    enabledText: function () {
      if (!this.status) return "loading";
      return this.status.init_enabled ? this.t("включён", "enabled") : this.t("выключен", "disabled");
    },
    runningText: function () {
      if (!this.status) return "loading";
      return this.status.running ? this.t("работает", "running") : this.t("остановлен", "stopped");
    }
  },
  watch: {
    notice: function (value) {
      var self = this;
      if (self.noticeTimer) clearTimeout(self.noticeTimer);
      if (self.noticeFrame) cancelAnimationFrame(self.noticeFrame);
      self.noticeTimer = null;
      self.noticeFrame = null;
      self.noticeRemaining = 0;
      self.noticeProgress = 0;
      if (!value) return;
      var duration = 5000;
      var startedAt = Date.now();
      var animate = function () {
        var elapsed = Date.now() - startedAt;
        var left = Math.max(0, duration - elapsed);
        self.noticeProgress = left / duration * 100;
        self.noticeRemaining = Math.max(1, Math.ceil(left / 1000));
        if (left > 0 && self.notice) {
          self.noticeFrame = requestAnimationFrame(animate);
        } else {
          self.noticeFrame = null;
        }
      };
      animate();
      self.noticeTimer = setTimeout(function () {
        self.notice = "";
        self.noticeTimer = null;
      }, 5000);
    }
  },
  created: function () {
    this.theme = this.detectTheme();
    try {
      var savedTab = window.localStorage ? window.localStorage.getItem("harpynet-gl-active-tab") : "";
      if (["sections", "proxy", "dashboard", "settings", "devices", "connections"].indexOf(savedTab) !== -1) this.activeTab = savedTab;
    } catch (e) {}
    try {
      var savedClosed = window.localStorage ? JSON.parse(window.localStorage.getItem("harpynet-gl-closed-connections") || "[]") : [];
      var closedCutoff = Date.now() - 5 * 60 * 1000;
      if (Array.isArray(savedClosed)) {
        this.closedConnections = savedClosed.filter(function (item) {
          return item && Number(item._closedAt || 0) >= closedCutoff;
        }).slice(0, 200);
      }
    } catch (_closedError) {}
    try {
      var savedDeviceNames = window.localStorage ? JSON.parse(window.localStorage.getItem("harpynet-gl-device-names") || "{}") : {};
      if (savedDeviceNames && typeof savedDeviceNames === "object") this.connectionDeviceNames = savedDeviceNames;
    } catch (_deviceNamesError) {}
    this.loadCachedStatus();
    this.refresh();
  },
  mounted: function () {
    document.addEventListener("click", this.closeDropdownsOnOutside, true);
    document.addEventListener("keydown", this.closeDropdownsOnEscape, true);
    this.startThemeWatcher();
    this.scrollActiveTabIntoView(false);
  },
  beforeDestroy: function () {
    if (this.themeObserver) this.themeObserver.disconnect();
    if (this.themePoller) clearInterval(this.themePoller);
    if (this.themeSync) {
      window.removeEventListener("focus", this.themeSync);
      document.removeEventListener("visibilitychange", this.themeSync);
      window.removeEventListener("hashchange", this.themeSync);
      window.removeEventListener("storage", this.themeSync);
      document.removeEventListener("click", this.themeSync, true);
    }
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    if (this.noticeFrame) cancelAnimationFrame(this.noticeFrame);
    if (this.timer) clearInterval(this.timer);
    if (this.connectionsTimer) clearInterval(this.connectionsTimer);
    if (this.mainAutoSaveTimer) clearTimeout(this.mainAutoSaveTimer);
    if (this.dashboardLatencyTimer) clearInterval(this.dashboardLatencyTimer);
    document.removeEventListener("click", this.closeDropdownsOnOutside, true);
    document.removeEventListener("keydown", this.closeDropdownsOnEscape, true);
  },
  methods: {
    emptyForm: function () {
      return {
        connection_type: "proxy",
        enable_udp_over_tcp: "0",
        upstream_proxy_enabled: "0",
        upstream_proxy_name: "AI Proxy",
        upstream_proxy_protocol: "http",
        upstream_proxy_server: "",
        upstream_proxy_port: "1080",
        upstream_proxy_username: "",
        upstream_proxy_password: "",
        upstream_proxy_tls_server_name: "",
        upstream_proxy_community_lists: "",
        upstream_proxy_domains: "",
        community_lists: "",
        user_domain_list_type: "disabled",
        user_domains_text: "",
        user_subnet_list_type: "disabled",
        user_subnets_text: "",
        local_domain_lists: "",
        local_subnet_lists: "",
        remote_domain_lists: "",
        remote_subnet_lists: "",
        fully_routed_ips: "",
        mixed_proxy_enabled: "0",
        mixed_proxy_port: "",
        resolve_real_ip_for_routing: "0"
      };
    },
    emptySettingsForm: function () {
      return {
        dns_type: "udp",
        dns_server: "77.88.8.8",
        bootstrap_dns_server: "77.88.8.8",
        dns_rewrite_ttl: "60",
        source_network_interfaces: "br-lan",
        enable_output_network_interface: "0",
        output_network_interface: "",
        enable_badwan_interface_monitoring: "0",
        badwan_monitored_interfaces: "",
        enable_yacd: "0",
        disable_quic: "0",
        update_interval: "1d",
        subscription_update_interval: "12h",
        download_lists_via_proxy: "0",
        dont_touch_dhcp: "0",
        config_path: "/tmp/mihomo/config.yaml",
        cache_path: "/etc/harpynet/mihomo-config.yaml",
        log_level: "warn",
        exclude_ntp: "0",
        routing_excluded_ips: ""
      };
    },
    readyListOptions: function () {
      return [
        ["russia_inside", "Россия мимо VPN", "Российские сервисы мимо VPN"],
        ["russia_outside", "Россия через VPN", "Российские сервисы через VPN"],
        ["ukraine_inside", "Украина", "Украинские сервисы мимо VPN"],
        ["geoblock", "Гео-блокировки", "Сервисы с гео-блокировками"],
        ["block", "Блокировки", "Список блокировок"],
        ["porn", "18+", "Контент 18+"],
        ["news", "Новости", "Новостные ресурсы"],
        ["anime", "Аниме", "Аниме-сервисы"],
        ["youtube", "YouTube", "Маршрутизация YouTube"],
        ["discord", "Discord", "Маршрутизация Discord"],
        ["meta", "Meta / Instagram", "Meta, Instagram, Facebook"],
        ["twitter", "X / Twitter", "Маршрутизация X / Twitter"],
        ["hdrezka", "HDRezka", "HDRezka"],
        ["tiktok", "TikTok", "Маршрутизация TikTok"],
        ["telegram", "Telegram", "Маршрутизация Telegram"],
        ["cloudflare", "Cloudflare / CDN", "Cloudflare и CDN"],
        ["ai_full", "AI Full", "AI-сервисы полностью"],
        ["chatgpt", "ChatGPT", "OpenAI / ChatGPT"],
        ["claude", "Claude", "Anthropic / Claude"],
        ["google_ai", "Google AI / Gemini", "Google AI"],
        ["google_play", "Google Play", "Google Play"],
        ["hodca", "H.O.D.C.A", "H.O.D.C.A"],
        ["roblox", "Roblox", "Roblox"],
        ["hetzner", "Hetzner / ASN", "Hetzner ASN"],
        ["ovh", "OVH / ASN", "OVH ASN"],
        ["digitalocean", "DigitalOcean / ASN", "DigitalOcean ASN"],
        ["cloudfront", "CloudFront / CDN", "CloudFront CDN"]
      ];
    },
    readyListMeta: function (key) {
      var map = {
        ai_full: ["ai-full.png", "#d84cff"],
        chatgpt: ["chatgpt.png", "#18b894"],
        claude: ["claude.png", "#d97745"],
        discord: ["discord.png", "#5865f2"],
        google_ai: ["google-ai.png", "#48a26a"],
        telegram: ["telegram.png", "#2aabee"],
        russia_inside: ["russia-inside.png", "#d8902f"],
        russia_outside: ["russia-outside.png", "#d65b5b"],
        ukraine_inside: ["ukraine.png", "#e3b72f"],
        youtube: ["youtube.png", "#ff3030"],
        meta: ["meta.png", "#3f82ff"],
        twitter: ["twitter.png", "#aeb6c2"],
        tiktok: ["tiktok.png", "#f05b7c"],
        cloudflare: ["cloudflare.png", "#f39a32"],
        cloudfront: ["cloudfront.png", "#ed8b34"],
        google_play: ["google-play.png", "#4caf74"],
        geoblock: ["geoblock.png", "#6c92d8"],
        block: ["block.png", "#d95757"],
        porn: ["adult.png", "#d3538b"],
        news: ["news.png", "#6096cf"],
        anime: ["anime.png", "#d96fb0"],
        hdrezka: ["hdrezka.png", "#8d78d8"],
        hodca: ["hodca.png", "#6875c7"],
        roblox: ["roblox.png", "#9ba3ae"],
        hetzner: ["hetzner.png", "#db4a56"],
        ovh: ["ovh.png", "#5673c8"],
        digitalocean: ["digitalocean.png", "#2684ff"]
      };
      var item = map[key] || ["default.png", "#78889c"];
      return { icon: "/harpynet/icons/" + item[0], color: item[1] };
    },
    readyListIcon: function (h, key) {
      var meta = this.readyListMeta(key);
      return h("img", {
        staticClass: "hn-ready-icon",
        attrs: { src: meta.icon, alt: "", loading: "lazy", draggable: "false" }
      });
    },
    readyListDisabledReason: function (key) {
      var selected = this.selectedReadyLists();
      if (selected.indexOf(key) !== -1) return "";
      if (selected.indexOf("ai_full") !== -1 && (key === "chatgpt" || key === "claude")) return "Уже включено в AI Full";
      if (key === "ai_full" && (selected.indexOf("chatgpt") !== -1 || selected.indexOf("claude") !== -1)) return "Сначала снимите ChatGPT и Claude";
      var selectedRegion = this.regionalOptions().find(function (item) { return selected.indexOf(item) !== -1; });
      if (this.regionalOptions().indexOf(key) !== -1 && selectedRegion) return "Региональные режимы нельзя использовать вместе";
      if (selected.indexOf("russia_inside") !== -1 && this.allowedWithRussiaInside().indexOf(key) === -1) return "Недоступно вместе с Россия мимо VPN";
      if (key === "russia_inside") {
        var allowed = this.allowedWithRussiaInside();
        var incompatible = selected.some(function (item) { return allowed.indexOf(item) === -1; });
        if (incompatible) return "Сначала снимите несовместимые списки";
      }
      return "";
    },
    allowedWithRussiaInside: function () {
      return ["russia_inside", "meta", "twitter", "discord", "telegram", "cloudflare", "ai_full", "chatgpt", "claude", "google_ai", "google_play", "hetzner", "ovh", "hodca", "roblox", "digitalocean", "cloudfront"];
    },
    regionalOptions: function () {
      return ["russia_inside", "russia_outside", "ukraine_inside"];
    },
    callApi: function (method, params) {
      if (!window.$request) return Promise.reject(new Error("GL request API is unavailable"));
      return window.$request("call", ["sid", "harpynet_gl", method, params || {}], {
        timeout: method === "subscription_update" || method === "test_latency" ? 180000 : 30000,
        isCancel: false
      });
    },
    detectTheme: function () {
      try {
        var themeLinks = Array.prototype.slice.call(document.querySelectorAll('link[id^="theme-"], link[id="themeBase"], link[href*="/theme/"]'));
        for (var li = themeLinks.length - 1; li >= 0; li--) {
          if (themeLinks[li].disabled) continue;
          var id = String(themeLinks[li].id || "").toLowerCase();
          var href = String(themeLinks[li].getAttribute("href") || themeLinks[li].href || "").toLowerCase();
          if (id === "theme-dark" || href.indexOf("/theme/dark/") !== -1) return "dark";
          if (id === "theme-default" || id === "theme-classic" || id === "themebase" || href.indexOf("/theme/default/") !== -1 || href.indexOf("/theme/classic/") !== -1 || href.indexOf("/theme/base.css") !== -1) return "light";
        }
      } catch (_eThemeLink) {}
      try {
        var storedTheme = window.localStorage && String(window.localStorage.getItem("theme") || "").toLowerCase();
        if (storedTheme === "dark") return "dark";
        if (storedTheme === "default" || storedTheme === "classic" || storedTheme === "light") return "light";
      } catch (_eStoredTheme) {}
      var classText = "";
      try {
        classText = [
          document.documentElement && document.documentElement.className,
          document.body && document.body.className,
          document.body && document.body.getAttribute("data-theme"),
          document.documentElement && document.documentElement.getAttribute("data-theme")
        ].join(" ").toLowerCase();
      } catch (_e0) {}
      if (/(^|\s)(dark|night|black|theme-dark|gl-dark)(\s|$)/.test(classText)) return "dark";
      if (/(^|\s)(light|white|theme-light|gl-light)(\s|$)/.test(classText)) return "light";

      var bg = "rgb(30, 30, 30)";
      try {
        var nodes = [document.body, document.documentElement, document.querySelector("#app"), document.querySelector(".app")];
        for (var i = 0; i < nodes.length; i++) {
          if (!nodes[i]) continue;
          var candidate = getComputedStyle(nodes[i]).backgroundColor;
          if (candidate && candidate !== "transparent" && !/rgba\([^)]*,\s*0\)/i.test(candidate)) {
            bg = candidate;
            break;
          }
        }
      } catch (_e) {}
      var match = String(bg).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return "dark";
      var r = Number(match[1]);
      var g = Number(match[2]);
      var b = Number(match[3]);
      return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "light" : "dark";
    },
    updateTheme: function () {
      var next = this.detectTheme();
      if (next && next !== this.theme) this.theme = next;
    },
    startThemeWatcher: function () {
      var self = this;
      var sync = function () { self.updateTheme(); };
      self.themeSync = sync;
      sync();
      [50, 150, 350, 800, 1500].forEach(function (delay) { setTimeout(sync, delay); });
      if (window.MutationObserver) {
        self.themeObserver = new MutationObserver(sync);
        if (document.documentElement) self.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
        if (document.body) self.themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
        if (document.head) self.themeObserver.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "media", "disabled", "class", "style"] });
      }
      window.addEventListener("focus", sync);
      document.addEventListener("visibilitychange", sync);
      window.addEventListener("hashchange", sync);
      window.addEventListener("storage", sync);
      document.addEventListener("click", sync, true);
      self.themePoller = setInterval(sync, 120);
    },
    statusCacheKey: function () {
      return "harpynet-gl-status-cache";
    },
    loadCachedStatus: function () {
      try {
        if (!window.localStorage) return;
        var cached = JSON.parse(window.localStorage.getItem(this.statusCacheKey()) || "null");
        if (!cached || !cached.status || Date.now() - Number(cached.saved_at || 0) > 24 * 60 * 60 * 1000) return;
        this.status = this.normalizeStatus(cached.status);
        if (!this.formDirty) this.loadFormFromStatus();
        if (!this.settingsDirty) this.loadSettingsFromStatus();
      } catch (_e) {}
    },
    saveCachedStatus: function () {
      try {
        if (!window.localStorage || !this.status) return;
        var safe = JSON.parse(JSON.stringify(this.status));
        delete safe.subscription_url;
        window.localStorage.setItem(this.statusCacheKey(), JSON.stringify({ saved_at: Date.now(), status: safe }));
      } catch (_e) {}
    },
    refresh: function () {
      var self = this;
      self.theme = self.detectTheme();
      self.loading = !self.status;
      return self.callApi("summary").then(function (result) {
        self.status = self.normalizeStatus(result || {});
        self.saveCachedStatus();
        if (!self.subscriptionModalOpen) {
          self.subscriptionUrl = self.status && self.status.subscription_url ? self.status.subscription_url : "";
        }
        if (!self.formDirty) {
          self.loadFormFromStatus();
        }
        if (!self.settingsDirty) {
          self.loadSettingsFromStatus();
        }
        if (self.activeTab === "connections") {
          self.updateConnectionsAutoRefresh();
          self.refreshConnections(true);
        }
        if (self.activeTab === "dashboard") self.refreshDashboard();
        if (self.activeTab === "devices") self.refreshDevices();
        self.scrollActiveTabIntoView(false);
      }).catch(function (err) {
        self.error = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.loading = false;
      });
    },
    normalizeStatus: function (status) {
      var normalized = Object.assign({}, status || {});
      var enabled = normalized.init_enabled;
      var raw = this.parseJson(normalized.raw_status, {});
      if (!(enabled === true || enabled === 1 || enabled === "1" || enabled === "true") && raw) {
        if (raw.init_enabled === true || raw.init_enabled === 1 || raw.init_enabled === "1" || raw.init_enabled === "true") enabled = 1;
      }
      if (enabled === true || enabled === 1 || enabled === "1" || enabled === "true") {
        normalized.init_enabled = 1;
      } else {
        normalized.init_enabled = 0;
      }
      normalized.running = normalized.running === true || normalized.running === 1 || normalized.running === "1" || normalized.running === "true" ? 1 : 0;
      return normalized;
    },
    loadFormFromStatus: function () {
      var main = this.status && this.status.main ? this.status.main : {};
      var form = this.emptyForm();
      Object.keys(form).forEach(function (key) {
        var value = main[key];
        if (Array.isArray(value)) value = value.join("\n");
        if (value !== undefined && value !== null && value !== "") form[key] = String(value);
      });
      if (form.user_domain_list_type === "dynamic") form.user_domain_list_type = "disabled";
      if (form.user_subnet_list_type === "dynamic") form.user_subnet_list_type = "disabled";
      this.form = form;
      this.advancedListOpen = {
        local: Boolean(String(form.local_domain_lists || form.local_subnet_lists || "").trim()),
        remote: Boolean(String(form.remote_domain_lists || form.remote_subnet_lists || "").trim()),
        routed: Boolean(String(form.fully_routed_ips || "").trim()),
        excluded: Boolean(String(this.settingsForm && this.settingsForm.routing_excluded_ips || "").trim())
      };
    },
    loadSettingsFromStatus: function () {
      var settings = this.status && this.status.settings ? this.status.settings : {};
      var form = this.emptySettingsForm();
      Object.keys(form).forEach(function (key) {
        var value = settings[key];
        if (Array.isArray(value)) value = value.join("\n");
        if (value !== undefined && value !== null && value !== "") form[key] = String(value);
      });
      this.settingsForm = form;
      this.advancedListOpen = Object.assign({}, this.advancedListOpen, {
        excluded: Boolean(String(form.routing_excluded_ips || "").trim())
      });
    },
    t: function (ru, en) {
      var lang = (document.documentElement.getAttribute("lang") || navigator.language || "").toLowerCase();
      return lang.indexOf("ru") === 0 ? ru : en;
    },
    formValue: function (key, value, autoSave) {
      this.form[key] = value;
      if (autoSave) {
        this.scheduleMainAutoSave(key);
      } else {
        this.formDirty = true;
      }
    },
    scheduleMainAutoSave: function (key) {
      var self = this;
      if (self.mainAutoSaveKeys.indexOf(key) === -1) self.mainAutoSaveKeys.push(key);
      if (self.mainAutoSaveTimer) clearTimeout(self.mainAutoSaveTimer);
      self.mainAutoSaveTimer = setTimeout(function () {
        var keys = self.mainAutoSaveKeys.slice();
        self.mainAutoSaveKeys = [];
        self.mainAutoSaveTimer = null;
        self.saveMainConfig({ silent: true, autosave: true, keys: keys });
      }, 650);
    },
    settingsValue: function (key, value) {
      this.settingsForm[key] = value;
      this.settingsDirty = true;
    },
    isChecked: function (key) {
      return this.form[key] === "1";
    },
    isSettingsChecked: function (key) {
      return this.settingsForm[key] === "1";
    },
    toggleFlag: function (key, checked) {
      this.formValue(key, checked ? "1" : "0", key === "upstream_proxy_enabled");
      if (key === "upstream_proxy_enabled" && checked) {
        setTimeout(function () {
          if (this.form.upstream_proxy_enabled === "1") this.selectTab("proxy", 1);
        }.bind(this), 160);
      }
    },
    toggleAdvancedList: function (key, checked) {
      this.advancedListOpen = Object.assign({}, this.advancedListOpen, {});
      this.advancedListOpen[key] = Boolean(checked);
    },
    advancedListSwitch: function (h, key) {
      var self = this;
      return h("label", { staticClass: "hn-switch" }, [
        h("input", {
          attrs: { type: "checkbox" },
          domProps: { checked: Boolean(self.advancedListOpen[key]) },
          on: { change: function (event) { self.toggleAdvancedList(key, event.target.checked); } }
        }),
        h("span")
      ]);
    },
    toggleSettingsFlag: function (key, checked) {
      this.settingsValue(key, checked ? "1" : "0");
    },
    closeDropdownsOnOutside: function (event) {
      if (!this.settingsComboOpen && !this.readyListsOpen && !this.proxyReadyListsOpen) return;
      var target = event && event.target;
      if (target && target.closest && target.closest(".hn-combo")) return;
      if (target && target.closest && target.closest(".hn-ready")) return;
      this.settingsComboOpen = "";
      this.readyListsOpen = false;
      this.proxyReadyListsOpen = false;
    },
    closeDropdownsOnEscape: function (event) {
      if (!event || event.key !== "Escape") return;
      this.settingsComboOpen = "";
      this.readyListsOpen = false;
      this.proxyReadyListsOpen = false;
    },
    selectedReadyLists: function () {
      return String(this.form.community_lists || "").split(/\s+/).map(function (item) { return item.trim(); }).filter(Boolean);
    },
    setSelectedReadyLists: function (values) {
      this.formValue("community_lists", values.join("\n"));
    },
    selectedProxyReadyLists: function () {
      return String(this.form.upstream_proxy_community_lists || "").split(/\s+/).map(function (item) { return item.trim(); }).filter(Boolean);
    },
    setSelectedProxyReadyLists: function (values) {
      this.formValue("upstream_proxy_community_lists", values.join("\n"));
    },
    getReadyLabel: function (key) {
      var found = this.readyListOptions().find(function (item) { return item[0] === key; });
      return found ? found[1] : key;
    },
    toggleReadyList: function (key) {
      var selected = this.selectedReadyLists();
      var exists = selected.indexOf(key) !== -1;
      if (exists) {
        this.setSelectedReadyLists(selected.filter(function (item) { return item !== key; }));
        return;
      }
      if (this.readyListDisabledReason(key)) return;

      if (this.regionalOptions().indexOf(key) !== -1) {
        selected = selected.filter(function (item) { return ["russia_inside", "russia_outside", "ukraine_inside"].indexOf(item) === -1; });
      }
      if (key === "ai_full") {
        selected = selected.filter(function (item) { return item !== "chatgpt" && item !== "claude"; });
      }
      if (key === "chatgpt" || key === "claude") {
        selected = selected.filter(function (item) { return item !== "ai_full"; });
      }
      if (key === "russia_inside") {
        var allowed = this.allowedWithRussiaInside();
        selected = selected.filter(function (item) { return allowed.indexOf(item) !== -1; });
      }
      if (selected.indexOf("russia_inside") !== -1 && this.allowedWithRussiaInside().indexOf(key) === -1) {
        this.error = "Этот список нельзя включить вместе с «Россия мимо VPN».";
        return;
      }
      selected.push(key);
      this.setSelectedReadyLists(selected);
    },
    toggleProxyReadyList: function (key) {
      var selected = this.selectedProxyReadyLists();
      var exists = selected.indexOf(key) !== -1;
      if (exists) {
        this.setSelectedProxyReadyLists(selected.filter(function (item) { return item !== key; }));
        return;
      }
      if (key === "ai_full") {
        selected = selected.filter(function (item) { return item !== "chatgpt" && item !== "claude"; });
      }
      if (key === "chatgpt" || key === "claude") {
        selected = selected.filter(function (item) { return item !== "ai_full"; });
      }
      selected.push(key);
      this.setSelectedProxyReadyLists(selected);
    },
    validateSubscriptionUrl: function (value) {
      var url = String(value || "").trim();
      if (!url) return this.t("Введите ссылку подписки.", "Enter the subscription URL.");
      if (!/^https?:\/\/\S+$/i.test(url)) return this.t("Ссылка должна начинаться с http:// или https:// и не содержать пробелов.", "URL must start with http:// or https:// and must not contain spaces.");
      if (url.length > 4096) return this.t("Ссылка слишком длинная.", "URL is too long.");
      return "";
    },
    openSubscriptionModal: function () {
      this.error = "";
      this.notice = "";
      this.subscriptionUrl = this.status && this.status.subscription_url ? this.status.subscription_url : "";
      this.subscriptionModalOpen = true;
    },
    closeSubscriptionModal: function () {
      if (this.subscriptionSaving) return;
      this.subscriptionModalOpen = false;
    },
    saveSubscription: function (updateAfterSave) {
      var self = this;
      var url = String(self.subscriptionUrl || "").trim();
      var validation = self.validateSubscriptionUrl(url);
      if (validation) {
        self.error = validation;
        return Promise.resolve();
      }

      self.subscriptionSaving = true;
      self.actionLoading = updateAfterSave ? "subscription_save_update" : "subscription_save";
      self.error = "";
      self.notice = "";
      return self.callApi("set_subscription", { url: url }).then(function (result) {
        if (result && result.ok === false) throw new Error(result.error || result.output || "Subscription save failed");
        self.notice = self.t("Подписка сохранена.", "Subscription saved.");
        self.subscriptionModalOpen = false;
        self.formDirty = false;
        if (updateAfterSave) return self.runAction("subscription_update");
        return self.refresh();
      }).catch(function (err) {
        self.error = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.subscriptionSaving = false;
        if (self.actionLoading === "subscription_save" || self.actionLoading === "subscription_save_update") self.actionLoading = "";
      });
    },
    saveMainConfig: function (options) {
      var self = this;
      options = options || {};
      var autosaveKeys = Array.isArray(options.keys) ? options.keys : [];
      var payload = self.form;
      var draft = null;
      var draftDirty = self.formDirty;
      if (options.autosave) {
        payload = self.emptyForm();
        var saved = self.status && self.status.main ? self.status.main : {};
        Object.keys(payload).forEach(function (key) {
          var value = saved[key];
          if (Array.isArray(value)) value = value.join("\n");
          if (value !== undefined && value !== null && value !== "") payload[key] = String(value);
        });
        autosaveKeys.forEach(function (key) { payload[key] = self.form[key]; });
        draft = Object.assign({}, self.form);
      }
      if (self.mainAutoSaveTimer) {
        clearTimeout(self.mainAutoSaveTimer);
        self.mainAutoSaveTimer = null;
      }
      if (!options.autosave) self.mainAutoSaveKeys = [];
      self.actionLoading = "set_main_config";
      self.mainAutoSaving = Boolean(options.autosave);
      self.error = "";
      if (!options.silent) self.notice = "";
      return self.callApi("set_main_config", payload).then(function (result) {
        if (result && result.ok === false) throw new Error(result.error || result.output || "Save failed");
        var savedFields = result && result.saved ? result.saved : {};
        Object.keys(savedFields).forEach(function (key) {
          var value = savedFields[key];
          if (Array.isArray(value)) value = value.join("\n");
          self.form[key] = value === undefined || value === null ? "" : String(value);
          if (self.status && self.status.main) self.status.main[key] = self.form[key];
        });
        if (!options.silent) self.notice = "Настройки сохранены.";
        if (!options.autosave) self.formDirty = false;
        return self.refresh().then(function () {
          if (options.autosave && draft) {
            self.form = draft;
            self.formDirty = draftDirty;
          } else {
            Object.keys(savedFields).forEach(function (key) {
              var value = savedFields[key];
              if (Array.isArray(value)) value = value.join("\n");
              self.form[key] = value === undefined || value === null ? "" : String(value);
            });
          }
        });
      }).catch(function (err) {
        self.error = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === "set_main_config") self.actionLoading = "";
        self.mainAutoSaving = false;
      });
    },
    saveProxyConfig: function () {
      return this.saveMainConfig();
    },
    checkProxyConfig: function () {
      var self = this;
      self.actionLoading = "check_upstream_proxy";
      self.error = "";
      self.notice = "";
      return self.saveMainConfig().then(function () {
        self.actionLoading = "check_upstream_proxy";
        return self.callApi("check_upstream_proxy");
      }).then(function (result) {
        var output = result && result.output ? String(result.output) : "";
        var data = self.parseJson(output, result || {});
        if (data && (data.success === true || data.ok === true)) {
          var latency = data.latency_ms ? " ? " + data.latency_ms + " ??" : "";
          self.notice = "Прокси сохранён и доступен" + latency + ".";
        } else {
          self.error = (data && (data.error || data.output)) || output || "Прокси не отвечает";
        }
        return self.refresh();
      }).catch(function (err) {
        self.error = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === "check_upstream_proxy") self.actionLoading = "";
      });
    },
    resetMainConfig: function () {
      this.formDirty = false;
      this.loadFormFromStatus();
      this.notice = "Изменения сброшены.";
    },
    saveSettingsConfig: function () {
      var self = this;
      self.actionLoading = "set_settings_config";
      self.error = "";
      self.notice = "";
      return self.callApi("set_settings_config", self.settingsForm).then(function (result) {
        if (result && result.ok === false) throw new Error(result.error || result.output || "Save failed");
        self.notice = "Настройки сохранены.";
        self.settingsDirty = false;
        return self.refresh();
      }).catch(function (err) {
        self.error = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === "set_settings_config") self.actionLoading = "";
      });
    },
    resetSettingsConfig: function () {
      this.settingsDirty = false;
      this.loadSettingsFromStatus();
      this.notice = "Изменения сброшены.";
    },
    runAction: function (method) {
      var self = this;
      self.actionLoading = method;
      self.error = "";
      self.notice = "";
      return self.callApi(method).then(function (result) {
        var output = result && result.output ? String(result.output) : "";
        if (!self.isActionSuccess(method, result, output)) {
          self.error = output || (result && result.error) || "Action failed";
        } else {
          var notice = self.actionNotice(method, output);
          if (notice) self.notice = notice;
        }
        return self.refresh().then(function () {
          if (self.isActionSuccess(method, result, output) && (method === "enable" || method === "disable")) {
            self.status = Object.assign({}, self.status || {}, { init_enabled: method === "enable" ? 1 : 0 });
          }
        });
      }).catch(function (err) {
        self.error = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === method) self.actionLoading = "";
      });
    },
    isActionSuccess: function (method, result, output) {
      if (result && (result.ok === true || result.success === true || result.rc === 0)) return true;
      if ((method === "enable" || method === "disable") && (!output || /^Action failed$/i.test(output))) return true;
      if (result && result.ok === false && !this.isBenignActionOutput(method, output)) return false;
      return true;
    },
    isBenignActionOutput: function (method, output) {
      if (method !== "start" && method !== "restart") return false;
      return /Start harpynet|service_triggers start/i.test(String(output || ""));
    },
    actionNotice: function (method, output) {
      if (method === "start" && this.isBenignActionOutput(method, output)) return "Запуск HarpyNet отправлен.";
      if (method === "restart" && this.isBenignActionOutput(method, output)) return "Перезапуск HarpyNet отправлен.";
      if (method === "enable") return "Автозапуск включён.";
      if (method === "disable") return "Автозапуск выключен.";
      if (method === "subscription_update") return "Подписка успешно обновлена.";
      return "";
    },
    selectTab: function (id, direction) {
      if (id !== this.activeTab) this.tabSlideDirection = direction || 1;
      this.activeTab = id;
      try {
        if (window.localStorage) window.localStorage.setItem("harpynet-gl-active-tab", id);
      } catch (e) {}
      this.scrollActiveTabIntoView();
      this.updateConnectionsAutoRefresh();
      if (id === "connections") this.refreshConnections(false);
      if (id === "dashboard") this.refreshDashboard();
      if (id === "devices") this.refreshDevices();
    },
    scrollActiveTabIntoView: function (smooth) {
      setTimeout(function () {
        var active = document.querySelector(".harpynet-gl .hn-tabs .hn-tab.active");
        if (active && active.scrollIntoView) {
          active.scrollIntoView({ behavior: smooth === false ? "auto" : "smooth", block: "nearest", inline: "center" });
        }
      }, 40);
    },
    selectAdjacentTab: function (tabs, direction) {
      if (!Array.isArray(tabs) || !tabs.length) return;
      var index = tabs.findIndex(function (tab) { return tab.id === this.activeTab; }.bind(this));
      if (index < 0) index = 0;
      var next = (index + direction + tabs.length) % tabs.length;
      this.selectTab(tabs[next].id, direction);
    },
    updateConnectionsAutoRefresh: function () {
      var self = this;
      if (self.connectionsTimer) {
        clearInterval(self.connectionsTimer);
        self.connectionsTimer = null;
      }
      if (self.activeTab !== "connections") return;
      self.connectionsTimer = setInterval(function () {
        if (self.activeTab === "connections") self.refreshConnections(true);
      }, 10000);
    },
    parseJson: function (text, fallback) {
      try {
        return JSON.parse(text || "");
      } catch (_err) {
        return fallback;
      }
    },
    openMihomoConfig: function () {
      this.mihomoModalOpen = true;
      return this.loadMihomoConfig();
    },
    closeMihomoConfig: function () {
      this.mihomoModalOpen = false;
    },
    loadMihomoConfig: function () {
      var self = this;
      self.mihomoConfigLoading = true;
      self.mihomoConfigError = "";
      return self.callApi("mihomo_config").then(function (result) {
        var payload = result || {};
        if (payload.reqData && payload.reqData.result) payload = payload.reqData.result;
        if (payload.error) throw new Error(payload.error.message || payload.error || "Mihomo config failed");
        if (payload.ok === false || payload.success === false) throw new Error(payload.error || payload.output || "Mihomo config not found");
        self.mihomoConfig = payload;
      }).catch(function (err) {
        self.mihomoConfigError = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.mihomoConfigLoading = false;
      });
    },
    mihomoConfigStats: function () {
      var config = this.mihomoConfig && this.mihomoConfig.config ? String(this.mihomoConfig.config) : "";
      var lines = config ? config.split(/\r?\n/).length : 0;
      var proxies = (config.match(/^\s*-\s*name\s*:/gm) || []).length;
      var providers = 0;
      var inProviders = false;
      config.split(/\r?\n/).forEach(function (line) {
        if (/^rule-providers\s*:/i.test(line)) {
          inProviders = true;
          return;
        }
        if (inProviders && /^[A-Za-z0-9_-]+:/.test(line)) inProviders = false;
        if (inProviders && /^\s{2}[A-Za-z0-9_.-]+\s*:/.test(line)) providers += 1;
      });
      return {
        lines: lines,
        proxies: proxies,
        providers: providers,
        rules: (config.match(/^\s*-\s*(?:DOMAIN|IP|GEO|MATCH|RULE-SET|SRC-|DST-|PROCESS|NETWORK|AND|OR|NOT)/gm) || []).length,
        size: this.prettyBytes(this.mihomoConfig && this.mihomoConfig.size ? this.mihomoConfig.size : config.length)
      };
    },
    mihomoConfigOverview: function () {
      var config = this.mihomoConfig && this.mihomoConfig.config ? String(this.mihomoConfig.config) : "";
      var result = { groups: [], proxies: [], providers: [] };
      var section = "";
      config.split(/\r?\n/).forEach(function (line) {
        var top = line.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s|$)/);
        if (top) section = top[1];
        var name = line.match(/^\s{2}-\s*name:\s*(.+?)\s*$/);
        if (name && section === "proxy-groups") result.groups.push(name[1].replace(/^['"]|['"]$/g, ""));
        if (name && section === "proxies") result.proxies.push(name[1].replace(/^['"]|['"]$/g, ""));
        var provider = line.match(/^\s{2}([A-Za-z0-9_.-]+)\s*:\s*$/);
        if (provider && section === "rule-providers") result.providers.push(provider[1]);
      });
      return result;
    },
    mihomoVisibleConfig: function () {
      var config = this.mihomoConfig && this.mihomoConfig.config ? String(this.mihomoConfig.config) : "";
      var query = String(this.mihomoConfigSearch || "").trim().toLowerCase();
      if (!query) return config;
      return config.split(/\r?\n/).filter(function (line) {
        return line.toLowerCase().indexOf(query) !== -1;
      }).join("\n");
    },
    copyMihomoConfigFallback: function (text) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      area.setSelectionRange(0, area.value.length);
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (_err) {
        ok = false;
      }
      document.body.removeChild(area);
      return ok;
    },
    refreshDashboard: function () {
      var self = this;
      self.dashboardLoading = true;
      self.dashboardError = "";
      return self.callApi("summary").then(function (result) {
        var dashboard = self.parseJson(result && result.raw_status, {});
        if (result && result.dashboard) dashboard = result.dashboard;
        var metadata = self.parseJson(dashboard.metadata, {});
        var outboundPayload = self.parseJson(dashboard.outbounds, { outbounds: [] });
        var proxyPayload = self.parseJson(dashboard.proxies, {});
        self.dashboard = {
          metadata: metadata || {},
          outbounds: Array.isArray(outboundPayload.outbounds) ? outboundPayload.outbounds : [],
          proxies: proxyPayload && proxyPayload.proxies ? proxyPayload.proxies : {},
          selected: dashboard.selected_outbound || (result && result.selected_outbound) || ""
        };
      }).catch(function (err) {
        self.dashboardError = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.dashboardLoading = false;
      });
    },
    testLatency: function () {
      var self = this;
      var currentDashboard = self.dashboard || { outbounds: [] };
      var visibleCount = (currentDashboard.outbounds || []).filter(function (outbound) {
        return !self.hiddenDashboardOutbound(outbound);
      }).length || 1;
      self.dashboardLatencyLoading = true;
      self.dashboardLatencyStep = 0;
      self.dashboardLatencyResolved = false;
      self.dashboardLatencyFresh = false;
      self.dashboardLatencyCount = visibleCount;
      if (self.dashboardLatencyTimer) clearInterval(self.dashboardLatencyTimer);
      self.dashboardLatencyTimer = setInterval(function () {
        var lastActive = Math.max(0, self.dashboardLatencyCount - 1);
        if (!self.dashboardLatencyResolved) {
          self.dashboardLatencyStep = Math.min(self.dashboardLatencyStep + 1, lastActive);
          return;
        }
        self.dashboardLatencyStep += 1;
        if (self.dashboardLatencyStep >= self.dashboardLatencyCount) {
          clearInterval(self.dashboardLatencyTimer);
          self.dashboardLatencyTimer = null;
          self.dashboardLatencyLoading = false;
          self.dashboardLatencyResolved = false;
          self.dashboardLatencyStep = 0;
          self.dashboardLatencyCount = 0;
        }
      }, 760);
      self.dashboardError = "";
      self.notice = "";
      return self.callApi("test_latency").then(function (result) {
        if (result && result.ok === false) throw new Error(result.output || result.error || "Ping failed");
        return self.refreshDashboard().then(function () {
          var refreshedDashboard = self.dashboard || { outbounds: [] };
          self.dashboardLatencyCount = (refreshedDashboard.outbounds || []).filter(function (outbound) {
            return !self.hiddenDashboardOutbound(outbound);
          }).length || self.dashboardLatencyCount || 1;
          self.dashboardLatencyResolved = true;
          self.dashboardLatencyFresh = true;
        });
      }).catch(function (err) {
        self.dashboardError = err && err.message ? err.message : String(err);
        self.dashboardLatencyResolved = true;
        self.dashboardLatencyFresh = false;
      });
    },
    selectOutbound: function (tag) {
      var self = this;
      if (!tag || self.outboundSwitching || self.dashboardLoading) return Promise.resolve();
      self.outboundSwitching = tag;
      self.dashboardError = "";
      self.notice = "";
      return self.callApi("select_outbound", { tag: tag }).then(function (result) {
        if (result && result.ok === false) throw new Error(result.output || result.error || "Select outbound failed");
        self.notice = "Выбран сервер: " + self.cleanCountryName(tag);
        return self.refreshDashboard();
      }).catch(function (err) {
        self.dashboardError = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.outboundSwitching = "";
      });
    },
    dashboardSelectedOutbound: function () {
      var data = this.dashboard || {};
      var selected = data.selected || "";
      var main = data.proxies && (data.proxies["🌍 Страна"] || data.proxies["main-out"]);
      if (!selected && main && main.now) selected = main.now;
      return selected || "";
    },
    outboundLatency: function (tag) {
      if (!this.dashboardLatencyFresh && !this.dashboardLatencyResolved) return "N/A";
      var proxy = this.dashboard && this.dashboard.proxies ? this.dashboard.proxies[tag] : null;
      var history = proxy && Array.isArray(proxy.history) ? proxy.history : [];
      for (var i = history.length - 1; i >= 0; i--) {
        var delay = Number(history[i] && history[i].delay);
        if (delay > 0) return delay + " ms";
      }
      return "N/A";
    },
    outboundLatencyValue: function (tag) {
      var proxy = this.dashboard && this.dashboard.proxies ? this.dashboard.proxies[tag] : null;
      var history = proxy && Array.isArray(proxy.history) ? proxy.history : [];
      for (var i = history.length - 1; i >= 0; i--) {
        var delay = Number(history[i] && history[i].delay);
        if (delay > 0) return delay;
      }
      return Infinity;
    },
    latencyNode: function (h, tag, index) {
      if (this.dashboardLatencyLoading) {
        if (index < this.dashboardLatencyStep) {
          return h("span", { staticClass: "hn-latency-ready" }, this.outboundLatency(tag));
        }
        if (index > this.dashboardLatencyStep) {
          return h("span", { staticClass: "hn-latency-wait" }, "ждёт");
        }
        return h("span", { staticClass: "hn-latency-loading" }, [
          h("span", { staticClass: "hn-latency-dot" }),
          h("span", "ping")
        ]);
      }
      return h("span", { staticClass: "hn-latency-value" }, this.outboundLatency(tag));
    },
    hiddenDashboardOutbound: function (outbound) {
      var text = [
        outbound && outbound.tag,
        outbound && outbound.name,
        outbound && outbound.label,
        outbound && outbound.link
      ].filter(Boolean).join(" ");
      return /(^|[\s|_-])lte([\s|_-]|$)|бел(ый|ого)?\s*спис|white\s*list|auto[-_\s]*balanc|авто[-_\s]*баланс/i.test(text);
    },
    protocolFromLink: function (link) {
      var match = String(link || "").match(/^([a-z0-9+.-]+):\/\//i);
      return match ? match[1].toUpperCase() : "VLESS";
    },
    countryCodeFromName: function (name) {
      var text = String(name || "");
      var emoji = Array.from(text).slice(0, 2);
      if (emoji.length === 2 && emoji.every(function (char) {
        var code = char.codePointAt(0);
        return code >= 0x1f1e6 && code <= 0x1f1ff;
      })) {
        return emoji.map(function (char) {
          return String.fromCharCode(char.codePointAt(0) - 0x1f1e6 + 97);
        }).join("");
      }
      var map = {
        "Андорра": "ad", "ОАЭ": "ae", "Афганистан": "af", "Албания": "al", "Армения": "am", "Аргентина": "ar", "Австрия": "at", "Австралия": "au", "Азербайджан": "az",
        "Босния": "ba", "Бельгия": "be", "Болгария": "bg", "Бахрейн": "bh", "Бразилия": "br", "Беларусь": "by", "Канада": "ca", "Швейцария": "ch", "Чили": "cl", "Китай": "cn", "Колумбия": "co", "Коста-Рика": "cr", "Куба": "cu", "Кипр": "cy", "Чехия": "cz",
        "Германия": "de", "Дания": "dk", "Алжир": "dz", "Эквадор": "ec", "Эстония": "ee", "Египет": "eg", "Испания": "es", "Эфиопия": "et", "Финляндия": "fi", "Франция": "fr", "Грузия": "ge", "Греция": "gr", "Гонконг": "hk", "Хорватия": "hr", "Венгрия": "hu",
        "Индонезия": "id", "Ирландия": "ie", "Израиль": "il", "Индия": "in", "Ирак": "iq", "Иран": "ir", "Исландия": "is", "Италия": "it", "Япония": "jp", "Кения": "ke", "Киргизия": "kg", "Кыргызстан": "kg", "Камбоджа": "kh", "Корея": "kr", "Кувейт": "kw", "Казахстан": "kz",
        "Литва": "lt", "Люксембург": "lu", "Латвия": "lv", "Марокко": "ma", "Молдова": "md", "Черногория": "me", "Македония": "mk", "Монголия": "mn", "Макао": "mo", "Мальта": "mt", "Мексика": "mx", "Малайзия": "my", "Нидерланды": "nl", "Голландия": "nl", "Норвегия": "no", "Новая Зеландия": "nz",
        "Перу": "pe", "Филиппины": "ph", "Пакистан": "pk", "Польша": "pl", "Португалия": "pt", "Катар": "qa", "Румыния": "ro", "Сербия": "rs", "Россия": "ru", "Саудовская Аравия": "sa", "Швеция": "se", "Сингапур": "sg", "Словения": "si", "Словакия": "sk", "Таиланд": "th", "Таджикистан": "tj",
        "Турция": "tr", "Тайвань": "tw", "Украина": "ua", "США": "us", "Америка": "us", "Узбекистан": "uz", "Вьетнам": "vn", "ЮАР": "za", "Косово": "xk", "Великобритания": "gb", "Англия": "gb",
        "Andorra": "ad", "UAE": "ae", "Afghanistan": "af", "Albania": "al", "Armenia": "am", "Argentina": "ar", "Austria": "at", "Australia": "au", "Azerbaijan": "az",
        "Belgium": "be", "Bulgaria": "bg", "Brazil": "br", "Belarus": "by", "Canada": "ca", "Switzerland": "ch", "Chile": "cl", "China": "cn", "Colombia": "co", "Czech": "cz", "Germany": "de", "Denmark": "dk", "Estonia": "ee", "Spain": "es", "Finland": "fi", "France": "fr", "Georgia": "ge",
        "Greece": "gr", "Hong Kong": "hk", "Croatia": "hr", "Hungary": "hu", "Indonesia": "id", "Ireland": "ie", "Israel": "il", "India": "in", "Iceland": "is", "Italy": "it", "Japan": "jp", "Korea": "kr", "Kazakhstan": "kz",
        "Lithuania": "lt", "Luxembourg": "lu", "Latvia": "lv", "Morocco": "ma", "Moldova": "md", "Montenegro": "me", "Macedonia": "mk", "Netherlands": "nl", "Norway": "no", "Poland": "pl", "Portugal": "pt", "Romania": "ro", "Serbia": "rs", "Russia": "ru",
        "Sweden": "se", "Singapore": "sg", "Slovenia": "si", "Slovakia": "sk", "Thailand": "th", "Turkey": "tr", "Taiwan": "tw", "Ukraine": "ua", "United States": "us", "USA": "us", "Vietnam": "vn", "United Kingdom": "gb", "Britain": "gb", "England": "gb"
      };
      var found = Object.keys(map).find(function (key) { return text.indexOf(key) !== -1; });
      if (found) return map[found];
      var prefix = text.match(/^([A-Z]{2})\s+/);
      return prefix ? prefix[1].toLowerCase() : "";
    },
    cleanCountryName: function (name) {
      return String(name || "")
        .replace(/^(?:\uD83C[\uDDE6-\uDDFF]){2}\s*/g, "")
        .replace(/^[A-Z]{2}(?=\s|[-_|/])/i, "")
        .replace(/^[-_|/]+\s*/, "")
        .trim();
    },
    flagNode: function (h, name) {
      var code = this.countryCodeFromName(name);
      if (!code) return null;
      return h("img", {
        staticClass: "hn-flag-img",
        attrs: { src: "/harpynet/flags/" + code + ".png", alt: code.toUpperCase(), draggable: "false" }
      });
    },
    dashboardMetadata: function () {
      if (this.dashboard && this.dashboard.metadata) {
        var dashboardMetadata = this.parseJson(this.dashboard.metadata, this.dashboard.metadata);
        if (dashboardMetadata && typeof dashboardMetadata === "object") return dashboardMetadata;
      }
      if (this.status && this.status.dashboard_metadata) {
        var directMetadata = this.parseJson(this.status.dashboard_metadata, {});
        if (directMetadata && Object.keys(directMetadata).length) return directMetadata;
      }
      if (this.status && this.status.dashboard && this.status.dashboard.metadata) {
        var nestedMetadata = this.parseJson(this.status.dashboard.metadata, {});
        if (nestedMetadata && Object.keys(nestedMetadata).length) return nestedMetadata;
      }
      if (this.status && this.status.raw_status) {
        var raw = this.parseJson(this.status.raw_status, {});
        var metadata = this.parseJson(raw.metadata, {});
        return metadata || {};
      }
      return {};
    },
    metadataLine: function (prefix) {
      var metadata = this.dashboardMetadata();
      var announce = metadata ? String(metadata.announce || "") : "";
      var line = announce.split(/\r?\n/).find(function (item) { return item.indexOf(prefix) !== -1; });
      return line ? line.replace(prefix, "").trim() : "";
    },
    subscriptionOwner: function () {
      var owner = this.metadataLine("🧑");
      return owner || "клиент";
    },
    subscriptionStatusRu: function () {
      var status = this.metadataLine("Подписка:");
      if (/active/i.test(status)) return "активна";
      return status || (this.status && this.status.has_subscription ? "активна" : "не добавлена");
    },
    subscriptionDaysLeft: function () {
      var line = this.metadataLine("Осталось:");
      var match = line.match(/(\d+)/);
      if (match) return match[1] + " дней";
      var metadata = this.dashboardMetadata();
      var expire = metadata ? Number(metadata.expire || 0) : 0;
      if (expire > 0) {
        var days = Math.max(0, Math.ceil((expire * 1000 - Date.now()) / 86400000));
        return days + " дней";
      }
      return "неизвестно";
    },
    subscriptionTraffic: function () {
      var line = this.metadataLine("Трафик:");
      if (line) return line.replace(/^📊\s*/, "");
      var metadata = this.dashboardMetadata();
      var traffic = metadata ? metadata.traffic : null;
      var used = traffic
        ? Number(traffic.used || 0) || (Number(traffic.upload || 0) + Number(traffic.download || 0))
        : (Number(metadata && metadata.upload || 0) + Number(metadata && metadata.download || 0));
      return this.prettyBytes(used);
    },
    subscriptionTotalTraffic: function () {
      var metadata = this.dashboardMetadata();
      var traffic = metadata ? metadata.traffic : null;
      var used = traffic
        ? Number(traffic.used || 0) || (Number(traffic.upload || 0) + Number(traffic.download || 0))
        : (Number(metadata && metadata.upload || 0) + Number(metadata && metadata.download || 0));
      var total = Number(traffic ? traffic.total : metadata && metadata.total || 0);
      if (!used && !total) return "";
      if ((traffic && traffic.isUnlimited) || total === 0) return this.prettyBytes(used) + " / ∞";
      return this.prettyBytes(used) + " / " + this.prettyBytes(total);
    },
    subscriptionExpireText: function () {
      var metadata = this.dashboardMetadata();
      var expire = metadata ? Number(metadata.expire || 0) : 0;
      if (!expire) return "";
      var date = new Date(expire * 1000);
      return date.toLocaleDateString("ru-RU") + " (" + this.subscriptionDaysLeft() + ")";
    },
    pruneClosedConnections: function () {
      var cutoff = Date.now() - 5 * 60 * 1000;
      this.closedConnections = this.closedConnections.filter(function (item) {
        return item && Number(item._closedAt || 0) >= cutoff;
      }).slice(0, 200);
      try {
        if (window.localStorage) window.localStorage.setItem("harpynet-gl-closed-connections", JSON.stringify(this.closedConnections));
      } catch (_historyPruneError) {}
    },
    refreshConnections: function (silent) {
      var self = this;
      if (self.connectionsRefreshing) return Promise.resolve();
      self.pruneClosedConnections();
      if (self.status && !self.status.running) {
        self.connectionsError = "";
        if (self.connectionsMode === "active" || self.connectionsMode === "proxy") self.connectionsMode = "direct";
        return self.refreshDirectConnections(silent);
      }
      self.connectionsRefreshing = true;
      if (!silent) self.connectionsLoading = true;
      if (!silent) self.connectionsError = "";
      return self.callApi("connections").then(function (result) {
        if (result && result.ok === false) throw new Error(result.json || result.output || "Failed to load connections");
        var payload = {};
        try {
          payload = JSON.parse((result && result.json) || "{}");
        } catch (err) {
          throw new Error("Clash API вернул не JSON: " + (err && err.message ? err.message : err));
        }
        var devicesPayload = self.parseJson(result && result.devices, { devices: [] });
        (Array.isArray(devicesPayload.devices) ? devicesPayload.devices : []).forEach(function (device) {
          if (device && device.ip && device.name) self.connectionDeviceNames[device.ip] = device.name;
        });
        try {
          if (window.localStorage) window.localStorage.setItem("harpynet-gl-device-names", JSON.stringify(self.connectionDeviceNames));
        } catch (_deviceMapError) {}
        var nextConnections = Array.isArray(payload.connections) ? payload.connections : [];
        nextConnections.forEach(function (item) {
          var sourceIP = item && item.metadata ? (item.metadata.sourceIP || item.metadata.source) : "";
          if (sourceIP && self.connectionDeviceNames[sourceIP]) item._sourceName = self.connectionDeviceNames[sourceIP];
        });
        if (self.connectionsInitialized) {
          var nextIds = {};
          nextConnections.forEach(function (item) { if (item && item.id) nextIds[item.id] = true; });
          var closedAt = Date.now();
          self.connections.forEach(function (item) {
            if (!item || !item.id || nextIds[item.id] || self.isInfrastructureConnection(item)) return;
            if (self.closedConnections.some(function (closed) { return closed.id === item.id; })) return;
            self.closedConnections.unshift(Object.assign({}, item, { _closed: true, _closedAt: closedAt }));
          });
          self.pruneClosedConnections();
        }
        self.connections = nextConnections;
        self.connectionsInitialized = true;
        var failuresPayload = self.parseJson(result && result.failures, []);
        self.connectionFailures = Array.isArray(failuresPayload) ? failuresPayload : [];
        self.connectionFailures.forEach(function (item) {
          var sourceIP = item && item.metadata ? (item.metadata.sourceIP || item.metadata.source) : "";
          if (sourceIP && self.connectionDeviceNames[sourceIP]) item._sourceName = self.connectionDeviceNames[sourceIP];
        });
        self.connectionsTotals = {
          upload: Number(payload.uploadTotal || 0),
          download: Number(payload.downloadTotal || 0)
        };
        return self.refreshDirectConnections(true);
      }).catch(function (err) {
        self.connectionsError = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.connectionsRefreshing = false;
        if (!silent) self.connectionsLoading = false;
      });
    },
    directConnectionService: function (port) {
      port = Number(port || 0);
      if (port === 53) return "DNS";
      if (port === 80) return "HTTP";
      if (port === 443) return "HTTPS";
      if (port === 123) return "NTP";
      if (port === 5222) return "Сообщения";
      if (port === 3478 || port === 5349) return "Голос / STUN";
      return port ? "Порт " + port : "Сеть";
    },
    normalizeDirectConnection: function (item, failure) {
      var source = String(item && item.source || "");
      return {
        id: "direct-" + String(item && item.id || ""),
        _failure: Boolean(failure),
        _sourceName: this.connectionDeviceNames[source] || "",
        error: failure ? "Нет ответа (" + String(item.state || "UNREPLIED") + ")" : "",
        metadata: {
          sourceIP: source,
          sourcePort: Number(item && item.sourcePort || 0),
          destinationIP: String(item && item.destination || ""),
          destinationPort: Number(item && item.destinationPort || 0),
          host: String(item && item.domain || item && item.destination || ""),
          network: String(item && item.protocol || "")
        },
        chains: failure ? ["Сбой"] : ["DIRECT"],
        rule: this.directConnectionService(item && item.destinationPort),
        upload: Number(item && item.upload || 0),
        download: Number(item && item.download || 0)
      };
    },
    refreshDirectConnections: function (silent) {
      var self = this;
      self.connectionsRefreshing = true;
      if (!silent) self.connectionsLoading = true;
      if (!silent) self.connectionsError = "";
      return self.callApi("direct_connections").then(function (result) {
        if (result && result.ok === false) throw new Error(result.output || result.error || "Не удалось прочитать прямые соединения");
        var payload = self.parseJson(result && result.json, { connections: [] });
        var devicesPayload = self.parseJson(result && result.devices, { devices: [] });
        (Array.isArray(devicesPayload.devices) ? devicesPayload.devices : []).forEach(function (device) {
          if (device && device.ip && device.name) self.connectionDeviceNames[device.ip] = device.name;
        });
        var raw = Array.isArray(payload.connections) ? payload.connections : [];
        self.directConnections = raw.filter(function (item) { return !item.failure; }).map(function (item) {
          return self.normalizeDirectConnection(item, false);
        });
        self.directConnectionFailures = raw.filter(function (item) { return item.failure; }).map(function (item) {
          return self.normalizeDirectConnection(item, true);
        });
        if (self.status && !self.status.running) {
          self.connections = self.directConnections.slice();
          self.connectionFailures = self.directConnectionFailures.slice();
        }
        self.connectionsInitialized = true;
        self.directConnectionsTotals = {
          upload: Number(payload.uploadTotal || 0),
          download: Number(payload.downloadTotal || 0)
        };
        if (self.status && !self.status.running) {
          self.connectionsTotals = Object.assign({}, self.directConnectionsTotals);
        }
      }).catch(function (err) {
        self.connectionsError = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.connectionsRefreshing = false;
        if (!silent) self.connectionsLoading = false;
      });
    },
    closeConnection: function (id) {
      var self = this;
      if (!id) return Promise.resolve();
      self.actionLoading = "close_connection";
      self.connectionsError = "";
      return self.callApi("close_connection", { id: id }).then(function (result) {
        if (result && result.ok === false) throw new Error(result.output || result.error || "Close failed");
        return self.refreshConnections();
      }).catch(function (err) {
        self.connectionsError = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === "close_connection") self.actionLoading = "";
      });
    },
    closeAllConnections: function () {
      var self = this;
      self.actionLoading = "close_all_connections";
      self.connectionsError = "";
      return self.callApi("close_all_connections").then(function (result) {
        if (result && result.ok === false) throw new Error(result.output || result.error || "Close all failed");
        return self.refreshConnections();
      }).catch(function (err) {
        self.connectionsError = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === "close_all_connections") self.actionLoading = "";
      });
    },
    refreshDevices: function () {
      var self = this;
      self.devicesLoading = true;
      self.devicesError = "";
      return self.callApi("devices").then(function (result) {
        if (result && result.ok === false) throw new Error(result.error || result.output || "Не удалось загрузить устройства");
        var devicesPayload = self.parseJson(result && result.devices, { devices: [], clients: {} });
        var routeModes = self.parseJson(result && result.route_modes, {});
        var devices = [];
        if (Array.isArray(devicesPayload.devices) && devicesPayload.devices.length) {
          devices = devicesPayload.devices;
        } else {
          Object.keys(devicesPayload.clients || {}).forEach(function (ip) {
            devices.push({ ip: ip, name: devicesPayload.clients[ip] || "Неизвестное устройство", connection: ip.match(/\.1$/) ? "Router" : "Ранее в сети" });
          });
        }
        devices.forEach(function (device) {
          var rememberedName = device && device.ip ? self.connectionDeviceNames[device.ip] : "";
          if (rememberedName) device.name = rememberedName;
          if (!device.name) device.name = "Неизвестное устройство";
        });
        self.devices = devices.filter(function (device) { return device && device.ip && !self.isRouterDevice(device); }).sort(function (a, b) {
          return String(a.ip).localeCompare(String(b.ip), undefined, { numeric: true });
        });
        self.deviceOutbounds = [];
        self.deviceRouteModes = routeModes || {};
        self.devicePendingRoutes = {};
        if (!self.deviceFilterCounts()[self.deviceFilter]) self.deviceFilter = "all";
      }).catch(function (err) {
        self.devicesError = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.devicesLoading = false;
      });
    },
    isRouterDevice: function (device) {
      var ip = String(device && device.ip || "");
      var name = String(device && device.name || "").toLowerCase();
      var connection = String(device && device.connection || "").toLowerCase();
      if (!ip) return true;
      if (connection === "router") return true;
      if (/^192\.168\.\d+\.1$/.test(ip) || /^10\.\d+\.\d+\.1$/.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.1$/.test(ip)) return true;
      return name === "router" || name.indexOf("console.gl-inet") !== -1 || name.indexOf("gl.inet") !== -1 || name.indexOf("gateway") !== -1;
    },
    deviceConnectionLabel: function (device) {
      var connection = device && device.connection && device.connection !== "Не определено" ? device.connection : "Ранее в сети";
      var mac = String(device && device.mac || "");
      var firstOctet = parseInt(mac.split(":")[0], 16);
      var privateMac = Number.isInteger(firstOctet) && Boolean(firstOctet & 2);
      if (connection === "Ранее в сети" && privateMac) connection = "Ранее в сети / приватный MAC";
      return device && device.ssid ? connection + " / " + device.ssid : connection;
    },
    isDeviceOnline: function (device) {
      var label = this.deviceConnectionLabel(device).toLowerCase();
      return label.indexOf("не активно") === -1 && label.indexOf("ранее в сети") === -1;
    },
    deviceFilterKey: function (device) {
      var connection = device && device.connection && device.connection !== "Не определено" ? device.connection : "Ранее в сети";
      if (connection === "Router") return "router";
      if (connection === "LAN 1") return "lan1";
      if (connection === "LAN 2") return "lan2";
      if (connection === "LAN 3") return "lan3";
      if (connection === "LAN 4") return "lan4";
      if (connection.indexOf("LAN") === 0) return "lan";
      if (connection === "Wi-Fi 2.4") return "wifi24";
      if (connection === "Wi-Fi 5G") return "wifi5";
      if (connection.indexOf("Wi-Fi") === 0) return "wifi";
      return "network";
    },
    deviceFilterLabel: function (key) {
      return {
        all: "Все",
        router: "Router",
        lan1: "LAN 1",
        lan2: "LAN 2",
        lan3: "LAN 3",
        lan4: "LAN 4",
        lan: "LAN",
        wifi24: "Wi-Fi 2.4",
        wifi5: "Wi-Fi 5G",
        wifi: "Wi-Fi / не активно",
        network: "Ранее в сети"
      }[key] || "Устройства";
    },
    deviceFilterCounts: function () {
      var self = this;
      return self.devices.reduce(function (acc, device) {
        var key = self.deviceFilterKey(device);
        acc.all = (acc.all || 0) + 1;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
    },
    visibleDevices: function () {
      var self = this;
      return self.deviceFilter === "all" ? self.devices : self.devices.filter(function (device) {
        return self.deviceFilterKey(device) === self.deviceFilter;
      });
    },
    deviceSavedRoute: function (ip) {
      return this.deviceRouteModes[ip] || "default";
    },
    setDeviceRoutePending: function (ip, mode) {
      if (mode === this.deviceSavedRoute(ip)) this.$delete ? this.$delete(this.devicePendingRoutes, ip) : delete this.devicePendingRoutes[ip];
      else this.$set ? this.$set(this.devicePendingRoutes, ip, mode) : this.devicePendingRoutes[ip] = mode;
      this.devicePendingRoutes = Object.assign({}, this.devicePendingRoutes);
    },
    devicePendingCount: function () {
      return Object.keys(this.devicePendingRoutes).length;
    },
    applyDeviceChanges: function () {
      var self = this;
      var routes = Object.keys(self.devicePendingRoutes);
      if (!routes.length) return Promise.resolve();
      self.actionLoading = "devices_apply";
      self.devicesError = "";
      self.notice = "";
      var chain = Promise.resolve();
      routes.forEach(function (ip) {
        chain = chain.then(function () {
          return self.callApi("set_device_route", { ip: ip, mode: self.devicePendingRoutes[ip] }).then(function (result) {
            if (result && result.ok === false) throw new Error(result.output || result.error || "Не удалось сохранить режим");
          });
        });
      });
      return chain.then(function () {
        self.notice = "Настройки устройств сохранены. HarpyNet перезапускается в фоне.";
        return self.callApi("restart").then(function () {
          return self.refreshDevices();
        });
      }).catch(function (err) {
        self.devicesError = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === "devices_apply") self.actionLoading = "";
      });
    },
    prettyBytes: function (value) {
      var bytes = Number(value || 0);
      var units = ["B", "KB", "MB", "GB", "TB"];
      var index = 0;
      while (bytes >= 1024 && index < units.length - 1) {
        bytes = bytes / 1024;
        index += 1;
      }
      return (index === 0 ? String(Math.round(bytes)) : bytes.toFixed(bytes >= 10 ? 1 : 2)) + " " + units[index];
    },
    connectionHost: function (connection) {
      var meta = connection.metadata || {};
      var host = meta.host || meta.destinationIP || meta.remoteDestination || "";
      var port = meta.destinationPort || "";
      return host ? host + (port ? ":" + port : "") : connection.id || "-";
    },
    isOpaqueConnectionHost: function (host) {
      var text = String(host || "").trim();
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4,}/i.test(text) ||
        /^[0-9a-f]{12,}(-[0-9a-f]{4,})?/i.test(text);
    },
    connectionHostInfo: function (connection) {
      var meta = connection.metadata || {};
      var host = meta.host || meta.destinationIP || meta.remoteDestination || connection.id || "-";
      var bits = [];
      if (meta.network) bits.push(String(meta.network).toUpperCase());
      if (meta.destinationPort) bits.push(":" + meta.destinationPort);
      if (this.isOpaqueConnectionHost(host)) {
        var service = this.connectionServiceInfo(connection).name;
        var title = service && service !== "Неизвестно" ? service + " QUIC" : "Скрытый QUIC host";
        var shortHost = String(host).length > 18 ? String(host).slice(0, 18) + "..." : String(host);
        bits.push("host-id " + shortHost);
        return { title: title, sub: bits.join(" ") };
      }
      return { title: host, sub: bits.join(" ") };
    },
    connectionRoute: function (connection) {
      var chain = Array.isArray(connection.chains) ? connection.chains : [];
      if (chain.indexOf("DIRECT") !== -1) return "🇷🇺 Россия · Без VPN";
      for (var i = 0; i < chain.length; i += 1) {
        var item = String(chain[i] || "");
        if (!item || item === "REJECT" || item === "GLOBAL" || item.indexOf("out") !== -1) continue;
        if (/^(?:🔁\s*)?Режим$|^(?:🧠\s*)?Умный обход$|^(?:🔒\s*)?Полный VPN$|^(?:🌍\s*)?Страна$/i.test(item)) continue;
        return item;
      }
      return chain[0] || "-";
    },
    connectionService: function (connection) {
      return this.connectionServiceInfo(connection).name;
    },
    connectionServiceInfo: function (connection) {
      var meta = connection.metadata || {};
      var host = String(meta.host || meta.destinationIP || meta.remoteDestination || "").toLowerCase();
      var rule = String(connection.rulePayload || connection.rule || "").trim();
      var text = host + " " + rule.toLowerCase();
      var matched = [
        ["telegram|t\\.me|(^|\\s)(149\\.154\\.|91\\.108\\.)", "Telegram"],
        ["discord", "Discord"],
        ["instagram", "Instagram"],
        ["facebook|fbcdn|fbsbx|whatsapp|meta", "Meta"],
        ["youtube|googlevideo", "YouTube"],
        ["google|googleapis|gstatic", "Google"],
        ["cloudfront", "CloudFront"],
        ["cloudflare", "Cloudflare"],
        ["openai|chatgpt", "ChatGPT"],
        ["anthropic|claude", "Claude"],
        ["tiktok", "TikTok"]
      ].find(function (item) { return new RegExp(item[0], "i").test(text); });
      if (matched) return { name: matched[1], sub: "домен/IP " + matched[1] };

      var ruleSet = rule.match(/rule_set=[^-]*-([a-z0-9_]+)-community-ruleset/i);
      var names = {
        ukraine_inside: "Украина",
        geoblock: "Гео-блокировки",
        block: "Блокировки",
        porn: "18+",
        news: "Новости",
        anime: "Аниме",
        discord: "Discord",
        meta: "Meta / Instagram",
        telegram: "Telegram",
        cloudflare: "Cloudflare",
        youtube: "YouTube",
        chatgpt: "ChatGPT",
        claude: "Claude",
        google_ai: "Google AI",
        google_play: "Google Play"
      };
      if (ruleSet && names[ruleSet[1]]) return { name: names[ruleSet[1]], sub: "готовый список" };
      if (connection && connection._failure) {
        if (host && !/^[0-9a-f:.]+$/i.test(host)) return { name: host, sub: "домен сбоя" };
        return { name: "Неизвестный IP", sub: host || "Домен не виден" };
      }
      if (meta.destinationIP && !meta.host) return { name: "Неизвестный IP", sub: "Домен не виден" };
      if (/inbound=tproxy/i.test(rule)) return { name: "Неизвестно", sub: "Сервис не распознан" };
      var cleaned = rule.replace(/^geosite:/i, "").replace(/^geoip:/i, "").replace(/^rule-set:/i, "");
      return cleaned ? { name: cleaned, sub: "правило маршрута" } : { name: "Неизвестный IP", sub: "Домен не виден" };
    },
    connectionSource: function (connection) {
      var meta = connection.metadata || {};
      var ip = meta.sourceIP || meta.source || "-";
      var name = connection._sourceName || this.connectionDeviceNames[ip] || "";
      return name ? name + " · " + ip : ip;
    },
    copyConnectionHost: function (connection) {
      var self = this;
      var meta = connection && connection.metadata ? connection.metadata : {};
      var value = String(meta.host || meta.destinationIP || meta.remoteDestination || "").trim();
      if (!value) return;
      var copied = function () {
        self.error = "";
        self.notice = "Скопировано: " + value;
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(copied).catch(function () {
          if (self.copyMihomoConfigFallback(value)) copied();
        });
      } else if (self.copyMihomoConfigFallback(value)) {
        copied();
      }
    },
    connectionAge: function (connection) {
      if (!connection.start) return "-";
      var started = new Date(connection.start).getTime();
      if (!started || isNaN(started)) return "-";
      var seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
      var hours = Math.floor(seconds / 3600);
      var minutes = Math.floor((seconds % 3600) / 60);
      var rest = seconds % 60;
      if (hours) return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
      return minutes + ":" + String(rest).padStart(2, "0");
    },
    connectionKind: function (connection) {
      if (connection && connection._failure) return "failure";
      var route = this.connectionRoute(connection);
      if (route === "DIRECT" || route.indexOf("Без VPN") !== -1) return "direct";
      if (/reject|fail|timeout|сбой/i.test(route + " " + (connection.rule || ""))) return "failure";
      return "proxy";
    },
    isInfrastructureConnection: function (connection) {
      var meta = connection && connection.metadata ? connection.metadata : {};
      var host = String(meta.host || "").toLowerCase().replace(/\.$/, "");
      return /^eu-[a-z0-9-]+\.harpynet\.com$/.test(host);
    },
    visibleConnections: function () {
      var self = this;
      if (self.status && !self.status.running) return self.directConnections;
      var mihomo = self.connections.filter(function (connection) {
        return !self.isInfrastructureConnection(connection);
      });
      return mihomo.filter(function (connection) {
        return self.connectionKind(connection) !== "direct";
      }).concat(self.filteredSystemDirect(self.directConnections));
    },
    filteredSystemDirect: function (source) {
      var self = this;
      var proxied = {};
      self.connections.forEach(function (connection) {
        var meta = connection && connection.metadata ? connection.metadata : {};
        var sourceIP = String(meta.sourceIP || meta.source || "");
        var destinationIP = String(meta.destinationIP || meta.remoteDestination || "");
        var host = String(meta.host || "").toLowerCase().replace(/\.$/, "");
        if (sourceIP && destinationIP) proxied[sourceIP + "|" + destinationIP] = true;
        if (sourceIP && host) proxied[sourceIP + "|" + host] = true;
      });
      return (Array.isArray(source) ? source : []).filter(function (connection) {
        var meta = connection && connection.metadata ? connection.metadata : {};
        var sourceIP = String(meta.sourceIP || "");
        var destinationIP = String(meta.destinationIP || "");
        var host = String(meta.host || "").toLowerCase().replace(/\.$/, "");
        if (/^198\.18\./.test(destinationIP)) return false;
        if (/^eu-[a-z0-9-]+\.harpynet\.com$/.test(host)) return false;
        if (proxied[sourceIP + "|" + destinationIP]) return false;
        if (host && proxied[sourceIP + "|" + host]) return false;
        return true;
      });
    },
    filteredConnections: function () {
      var self = this;
      var query = String(self.connectionsSearch || "").toLowerCase();
      var failures = self.status && !self.status.running
        ? self.directConnectionFailures
        : self.connectionFailures.concat(self.filteredSystemDirect(self.directConnectionFailures));
      var source = self.connectionsMode === "closed"
        ? self.closedConnections
        : (self.connectionsMode === "failure" ? failures : self.visibleConnections());
      return source.filter(function (connection) {
        var kind = self.connectionKind(connection);
        if (self.connectionsMode === "proxy" && kind !== "proxy") return false;
        if (self.connectionsMode === "direct" && kind !== "direct") return false;
        if (self.connectionsMode === "failure" && kind !== "failure") return false;
        if (!query) return true;
        var text = [
          self.connectionHost(connection),
          self.connectionRoute(connection),
          self.connectionService(connection),
          self.connectionSource(connection),
          connection.metadata && connection.metadata.network
        ].join(" ").toLowerCase();
        return text.indexOf(query) !== -1;
      });
    },
    renderConnections: function (h) {
      var self = this;
      var visibleConnections = self.visibleConnections();
      var active = visibleConnections.length;
      var proxy = visibleConnections.filter(function (item) { return self.connectionKind(item) === "proxy"; }).length;
      var direct = visibleConnections.filter(function (item) { return self.connectionKind(item) === "direct"; }).length;
      var failure = (self.status && !self.status.running
        ? self.directConnectionFailures
        : self.connectionFailures.concat(self.filteredSystemDirect(self.directConnectionFailures))).length;
      var closed = self.closedConnections.length;
      var rows = self.filteredConnections();
      var filters = [
        ["active", "Активные " + active],
        ["proxy", "Прокси " + proxy],
        ["direct", "Без VPN " + direct],
        ["failure", "Сбой " + failure],
        ["closed", "Закрытые " + closed]
      ];

      return h("div", { staticClass: "hn-card hn-section hn-connections" }, [
        h("div", { staticClass: "hn-conn-toolbar" }, [
          h("div", { staticClass: "hn-conn-filters" }, filters.map(function (item) {
            return h("button", {
              staticClass: self.connectionsMode === item[0] ? "hn-conn-filter active" : "hn-conn-filter",
              attrs: { type: "button" },
              on: { click: function () { self.connectionsMode = item[0]; } }
            }, item[1]);
          })),
          h("label", { staticClass: "hn-conn-search-wrap" }, [
            h("span", { staticClass: "hn-search-icon" }),
            h("input", {
              staticClass: "hn-input hn-conn-search",
              attrs: { type: "search", placeholder: "Поиск" },
              domProps: { value: self.connectionsSearch },
              on: { input: function (event) { self.connectionsSearch = event.target.value; } }
            })
          ]),
          h("button", {
            staticClass: "hn-icon-btn hn-danger",
            attrs: { type: "button", title: "Закрыть все соединения", "aria-label": "Закрыть все соединения", disabled: Boolean(self.actionLoading || !active) },
            on: { click: self.closeAllConnections }
          })
        ]),
        h("div", { staticClass: "hn-conn-totals" }, [
          h("span", "↓ " + self.prettyBytes(self.connectionsTotals.download)),
          h("span", "↑ " + self.prettyBytes(self.connectionsTotals.upload))
        ]),
        self.connectionsError ? h("div", { staticClass: "hn-error" }, self.connectionsError) : null,
        self.connectionsLoading && !rows.length ? h("div", { staticClass: "hn-placeholder" }, "Загрузка соединений...") : null,
        !self.connectionsLoading && !rows.length ? h("div", { staticClass: "hn-placeholder" },
          self.status && !self.status.running
            ? "VPN выключен — интернет работает напрямую. Соединения Mihomo не собираются."
            : (self.connectionsMode === "closed" ? "Нет закрытых соединений" : "Нет активных соединений")
        ) : null,
        rows.length ? h("div", { staticClass: "hn-conn-table-wrap" }, [
          h("table", { staticClass: "hn-conn-table" }, [
            h("thead", [h("tr", [
              h("th", "Хост"),
              h("th", "Маршрут"),
              h("th", "Время"),
              h("th", "Трафик"),
              h("th", "Сервис"),
              h("th", "Источник"),
              h("th", "")
            ])]),
            h("tbody", rows.map(function (connection) {
              var hostInfo = self.connectionHostInfo(connection);
              var serviceInfo = self.connectionServiceInfo(connection);
              if (connection._failure && connection.error) {
                serviceInfo = { name: serviceInfo.name, sub: serviceInfo.sub + " · " + connection.error };
              }
              return h("tr", [
                h("td", { staticClass: "hn-conn-host" }, [
                  h("div", { staticClass: "hn-cell-main" }, hostInfo.title),
                  hostInfo.sub ? h("div", { staticClass: "hn-cell-sub" }, hostInfo.sub) : null
                ]),
                h("td", { staticClass: self.connectionKind(connection) === "direct" ? "hn-route-cell hn-route-direct" : "hn-route-cell hn-route-proxy" }, [
                  self.flagNode(h, self.connectionRoute(connection)),
                  h("span", self.cleanCountryName(self.connectionRoute(connection)))
                ]),
                h("td", connection._closedAt ? new Date(connection._closedAt).toLocaleTimeString("ru-RU") : self.connectionAge(connection)),
                h("td", { staticClass: "hn-traffic-cell" }, [
                  h("div", "↓ " + self.prettyBytes(connection.download)),
                  h("div", "↑ " + self.prettyBytes(connection.upload))
                ]),
                h("td", { staticClass: "hn-service-cell" }, [
                  h("div", { staticClass: "hn-service" }, serviceInfo.name),
                  h("div", { staticClass: "hn-cell-sub" }, serviceInfo.sub)
                ]),
                h("td", [
                  h("div", { staticClass: "hn-cell-main" }, self.connectionSource(connection).split(" · ")[0]),
                  self.connectionSource(connection).indexOf(" · ") !== -1 ? h("div", { staticClass: "hn-cell-sub" }, self.connectionSource(connection).split(" · ")[1]) : null
                ]),
                h("td", { staticClass: "hn-row-actions" }, [
                  h("button", {
                    staticClass: "hn-icon-btn hn-copy-host",
                    attrs: { type: "button", title: "Копировать домен или IP", "aria-label": "Копировать домен" },
                    on: { click: function () { self.copyConnectionHost(connection); } }
                  }, "⧉"),
                  connection.id && !connection._closed && !connection._failure ? h("button", {
                    staticClass: "hn-icon-btn hn-danger",
                    attrs: { type: "button", title: "Закрыть соединение", "aria-label": "Закрыть соединение", disabled: Boolean(self.actionLoading) },
                    on: { click: function () { self.closeConnection(connection.id); } }
                  }) : null
                ])
              ]);
            }))
          ])
        ]) : null
      ]);
    },
    renderDevices: function (h) {
      var self = this;
      var counts = self.deviceFilterCounts();
      var filterOrder = ["all", "lan1", "lan2", "lan3", "lan4", "lan", "wifi24", "wifi5", "wifi", "network"];
      var filters = filterOrder.filter(function (key) { return counts[key]; });
      var rows = self.visibleDevices();
      var pendingCount = self.devicePendingCount();
      var modeOptions = [
        ["default", "По умолчанию"],
        ["proxy", "Умный обход"],
        ["full_proxy", "Полный VPN"],
        ["full_proxy_bypass_ru", "Полный VPN без РФ"],
        ["exclude", "Выключить VPN"]
      ];
      return h("div", { staticClass: "hn-card hn-section hn-devices" }, [
        h("div", { staticClass: "hn-devices-head" }, [
          h("div", { staticClass: "hn-section-title" }, "Устройства"),
          h("div", { staticClass: "hn-actions" }, [
            h("button", {
              staticClass: pendingCount ? "hn-btn hn-btn-primary" : "hn-btn",
              attrs: { type: "button", disabled: Boolean(!pendingCount || self.actionLoading || self.loading) },
              on: { click: self.applyDeviceChanges }
            }, self.actionLoading === "devices_apply" ? "..." : (pendingCount ? "Применить (" + pendingCount + ")" : "Применить")),
            self.actionButton(h, "Обновить", self.refreshDevices, true, self.devicesLoading)
          ])
        ]),
        h("div", { staticClass: "hn-devices-filters" }, filters.map(function (key) {
          return h("button", {
            staticClass: self.deviceFilter === key ? "hn-device-filter active" : "hn-device-filter",
            attrs: { type: "button" },
            on: { click: function () { self.deviceFilter = key; } }
          }, [
            h("span", self.deviceFilterLabel(key)),
            h("span", { staticClass: "hn-filter-count" }, counts[key])
          ]);
        })),
        self.devicesError ? h("div", { staticClass: "hn-error" }, self.devicesError) : null,
        self.devicesLoading && !rows.length ? h("div", { staticClass: "hn-placeholder" }, "Загрузка устройств...") : null,
        !self.devicesLoading && !rows.length ? h("div", { staticClass: "hn-placeholder" }, "Устройства не найдены") : null,
        rows.length ? h("div", { staticClass: "hn-devices-table-wrap" }, [
          h("table", { staticClass: "hn-devices-table" }, [
            h("thead", [h("tr", [
              h("th", "Устройство"),
              h("th", "IP"),
              h("th", "Статус"),
              h("th", "Режим")
            ])]),
            h("tbody", rows.map(function (device) {
              var ip = device.ip || "";
              var currentRoute = self.devicePendingRoutes[ip] || self.deviceSavedRoute(ip);
              var routePending = Boolean(self.devicePendingRoutes[ip] && self.devicePendingRoutes[ip] !== self.deviceSavedRoute(ip));
              return h("tr", [
                h("td", [
                  h("div", { staticClass: "hn-device-name", attrs: { title: device.name || "" } }, device.name || "Неизвестное устройство"),
                  h("div", { staticClass: "hn-cell-sub" }, self.deviceConnectionLabel(device))
                ]),
                h("td", ip),
                h("td", [
                  h("span", { staticClass: self.isDeviceOnline(device) ? "hn-device-status online" : "hn-device-status offline" }, self.isDeviceOnline(device) ? "онлайн" : "офлайн")
                ]),
                h("td", [
                  self.optionSelectField(h, "device-route:" + ip, currentRoute, modeOptions, function (value) {
                    self.setDeviceRoutePending(ip, value);
                  }, routePending ? "hn-device-select pending" : "hn-device-select")
                ])
              ]);
            }))
          ])
        ]) : null
      ]);
    },
    badge: function (h, text, good) {
      return h("span", { staticClass: good ? "hn-badge hn-badge-ok" : "hn-badge" }, text);
    },
    button: function (h, label, method, primary) {
      var self = this;
      var busy = self.actionLoading === method;
      var busyContent = method === "subscription_update" ? [
        h("span", { staticClass: "hn-btn-spinner" }),
        h("span", "Обновляем")
      ] : "...";
      return h("button", {
        staticClass: (primary ? "hn-btn hn-btn-primary" : "hn-btn") + (busy && method === "subscription_update" ? " hn-btn-loading" : ""),
        attrs: { disabled: Boolean(self.actionLoading || self.loading) },
        on: { click: function () { self.runAction(method); } }
      }, busy ? busyContent : label);
    },
    subscriptionUpdateButton: function (h) {
      var busy = this.actionLoading === "subscription_update";
      return h("button", {
        staticClass: busy ? "hn-sub-refresh loading" : "hn-sub-refresh",
        attrs: {
          type: "button",
          title: "Обновить подписку",
          "aria-label": "Обновить подписку",
          disabled: Boolean(this.actionLoading || this.loading)
        },
        on: { click: function () { this.runAction("subscription_update"); }.bind(this) }
      }, [
        busy ? h("span", { staticClass: "hn-btn-spinner" }) : h("span", { staticClass: "hn-refresh-svg", domProps: { innerHTML: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M20 6v5h-5'/><path d='M19.1 15a7.6 7.6 0 1 1-1.8-8.1L20 11'/></svg>" } })
      ]);
    },
    actionButton: function (h, label, onClick, primary, busy) {
      return h("button", {
        staticClass: primary ? "hn-btn hn-btn-primary" : "hn-btn",
        attrs: { disabled: Boolean(this.actionLoading || this.loading || this.subscriptionSaving) },
        on: { click: onClick }
      }, busy ? "..." : label);
    },
    pingButton: function (h) {
      var busy = Boolean(this.dashboardLatencyLoading);
      return h("button", {
        staticClass: busy ? "hn-btn hn-ping-btn loading" : "hn-btn hn-ping-btn",
        attrs: { disabled: Boolean(this.actionLoading || this.loading || this.subscriptionSaving || busy), type: "button" },
        on: { click: this.testLatency }
      }, busy ? [
        h("span", { staticClass: "hn-ping-loader" }),
        h("span", "Проверяем")
      ] : "Проверить пинг");
    },
    field: function (h, label, help, control) {
      return h("div", { staticClass: "hn-form-row" }, [
        h("div", { staticClass: "hn-form-label" }, label),
        h("div", [control, help ? h("div", { staticClass: "hn-help" }, help) : null])
      ]);
    },
    selectField: function (h, key, options) {
      var self = this;
      return self.optionSelectField(h, key, self.form[key], options, function (value) {
        self.formValue(key, value);
      });
    },
    segmentedField: function (h, key, options) {
      var self = this;
      return h("div", { staticClass: "hn-segments" }, (options || []).map(function (item) {
        var active = item[0] === self.form[key];
        return h("button", {
          staticClass: active ? "hn-segment active" : "hn-segment",
          attrs: { type: "button" },
          on: { click: function () { if (!active) self.formValue(key, item[0], key === "connection_type"); } }
        }, item[1]);
      }));
    },
    settingsSelectField: function (h, key, options) {
      var self = this;
      var open = self.settingsComboOpen === key;
      var selected = (options || []).find(function (item) { return item[0] === self.settingsForm[key]; });
      return h("div", { staticClass: open ? "hn-combo hn-option open" : "hn-combo hn-option" }, [
        h("button", {
          staticClass: "hn-input hn-option-summary",
          attrs: { type: "button" },
          on: { click: function () { self.settingsComboOpen = open ? "" : key; } }
        }, [
          h("span", { staticClass: "hn-option-text" }, selected ? selected[1] : String(self.settingsForm[key] || "")),
          h("span", { staticClass: open ? "hn-caret open" : "hn-caret" })
        ]),
        open ? h("div", { staticClass: "hn-combo-panel" }, (options || []).map(function (item) {
          var active = item[0] === self.settingsForm[key];
          return h("button", {
            staticClass: active ? "hn-combo-item active" : "hn-combo-item",
            attrs: { type: "button" },
            on: { click: function () { if (!active) self.settingsValue(key, item[0]); self.settingsComboOpen = ""; } }
          }, [
            h("span", { staticClass: "hn-combo-value" }, item[1])
          ]);
        })) : null
      ]);
    },
    optionSelectField: function (h, key, value, options, onPick, extraClass) {
      var self = this;
      var openKey = "option:" + key;
      var open = self.settingsComboOpen === openKey;
      var selected = (options || []).find(function (item) { return item[0] === value; });
      return h("div", { staticClass: (open ? "hn-combo hn-option open " : "hn-combo hn-option ") + (extraClass || "") }, [
        h("button", {
          staticClass: "hn-input hn-option-summary",
          attrs: { type: "button" },
          on: { click: function () { self.settingsComboOpen = open ? "" : openKey; } }
        }, [
          h("span", { staticClass: "hn-option-text" }, selected ? selected[1] : String(value || "")),
          h("span", { staticClass: open ? "hn-caret open" : "hn-caret" })
        ]),
        open ? h("div", { staticClass: "hn-combo-panel" }, (options || []).map(function (item) {
          var active = item[0] === value;
          return h("button", {
            staticClass: active ? "hn-combo-item active" : "hn-combo-item",
            attrs: { type: "button" },
            on: { click: function () { if (!active) onPick(item[0]); self.settingsComboOpen = ""; } }
          }, [
            h("span", { staticClass: "hn-combo-value" }, item[1])
          ]);
        })) : null
      ]);
    },
    flagField: function (h, key) {
      var self = this;
      return h("label", { staticClass: "hn-switch" }, [
        h("input", {
          attrs: { type: "checkbox" },
          domProps: { checked: self.isChecked(key) },
          on: { change: function (event) { self.toggleFlag(key, event.target.checked); } }
        }),
        h("span")
      ]);
    },
    settingsFlagField: function (h, key) {
      var self = this;
      return h("label", { staticClass: "hn-switch" }, [
        h("input", {
          attrs: { type: "checkbox" },
          domProps: { checked: self.isSettingsChecked(key) },
          on: { change: function (event) { self.toggleSettingsFlag(key, event.target.checked); } }
        }),
        h("span")
      ]);
    },
    textAreaField: function (h, key, placeholder, rows) {
      var self = this;
      return h("textarea", {
        staticClass: "hn-textarea",
        attrs: { rows: rows || 4, placeholder: placeholder || "" },
        domProps: { value: self.form[key] },
        on: { input: function (event) { self.formValue(key, event.target.value); } }
      });
    },
    manualTextAreaField: function (h, key, placeholder, rows) {
      return this.textAreaField(h, key, placeholder, rows);
    },
    inputField: function (h, key, placeholder) {
      var self = this;
      return h("input", {
        staticClass: "hn-input",
        attrs: { type: "text", placeholder: placeholder || "" },
        domProps: { value: self.form[key] },
        on: { input: function (event) { self.formValue(key, event.target.value); } }
      });
    },
    settingsInputField: function (h, key, placeholder) {
      var self = this;
      return h("input", {
        staticClass: "hn-input",
        attrs: { type: "text", placeholder: placeholder || "" },
        domProps: { value: self.settingsForm[key] },
        on: { input: function (event) { self.settingsValue(key, event.target.value); } }
      });
    },
    settingsComboField: function (h, key, placeholder, options) {
      var self = this;
      var open = self.settingsComboOpen === key;
      return h("div", { staticClass: open ? "hn-combo open" : "hn-combo" }, [
        h("input", {
          staticClass: "hn-input hn-combo-input",
          attrs: { type: "text", placeholder: placeholder || "" },
          domProps: { value: self.settingsForm[key] },
          on: {
            input: function (event) {
              self.settingsValue(key, event.target.value);
              self.settingsComboOpen = key;
            },
            focus: function () { self.settingsComboOpen = key; }
          }
        }),
        h("button", {
          staticClass: "hn-combo-toggle",
          attrs: { type: "button", title: "Выбрать DNS" },
          on: { click: function () { self.settingsComboOpen = open ? "" : key; } }
        }, [h("span", { staticClass: open ? "hn-caret open" : "hn-caret" })]),
        open ? h("div", { staticClass: "hn-combo-panel" }, [
          h("button", {
            staticClass: "hn-combo-item muted",
            attrs: { type: "button" },
            on: { click: function () { self.settingsComboOpen = ""; } }
          }, "Свое значение"),
          (options || []).map(function (item) {
            var selected = self.settingsForm[key] === item[0];
            return h("button", {
              staticClass: selected ? "hn-combo-item active" : "hn-combo-item",
              attrs: { type: "button" },
              on: { click: function () { if (!selected) self.settingsValue(key, item[0]); self.settingsComboOpen = ""; } }
            }, [
              h("span", { staticClass: "hn-combo-value" }, item[0]),
              h("span", { staticClass: "hn-combo-label" }, item[1])
            ]);
          })
        ]) : null
      ]);
    },
    settingsListValues: function (key) {
      return String(this.settingsForm[key] || "").split(/\s+/).map(function (item) { return item.trim(); }).filter(Boolean);
    },
    settingsSetListValues: function (key, values) {
      this.settingsValue(key, (values || []).join("\n"));
    },
    interfaceOptions: function () {
      var dynamic = this.status && Array.isArray(this.status.network_interfaces) ? this.status.network_interfaces : [];
      if (dynamic.length) {
        return dynamic.map(function (item) { return [item.value, item.label]; });
      }
      return [
        ["br-lan", "Bridge: \"br-lan\" (lan)"],
        ["eth1", "Ethernet Adapter: \"eth1\" (wan)"],
        ["eth0", "Ethernet Adapter: \"eth0\""],
        ["wlan0", "Wireless Adapter: \"wlan0\""],
        ["wlan1", "Wireless Adapter: \"wlan1\""]
      ];
    },
    settingsMultiSelectField: function (h, key, options, placeholder) {
      var self = this;
      var open = self.settingsComboOpen === key;
      var selected = self.settingsListValues(key);
      var selectedSet = {};
      selected.forEach(function (item) { selectedSet[item] = true; });
      return h("div", { staticClass: open ? "hn-combo hn-multi open" : "hn-combo hn-multi" }, [
        h("button", {
          staticClass: "hn-ready-summary hn-combo-summary",
          attrs: { type: "button" },
          on: { click: function () { self.settingsComboOpen = open ? "" : key; } }
        }, [
          selected.length ? selected.map(function (value) {
            var found = (options || []).find(function (item) { return item[0] === value; });
            return h("span", { staticClass: "hn-chip hn-chip-count" }, found ? found[1] : value);
          }) : h("span", { staticClass: "hn-muted" }, placeholder || "Выберите интерфейс"),
          h("span", { staticClass: open ? "hn-caret open" : "hn-caret" })
        ]),
        open ? h("div", { staticClass: "hn-combo-panel" }, (options || []).map(function (item) {
          var checked = Boolean(selectedSet[item[0]]);
          return h("button", {
            staticClass: checked ? "hn-combo-item active" : "hn-combo-item",
            attrs: { type: "button" },
            on: { click: function () {
              var next = self.settingsListValues(key);
              if (checked) next = next.filter(function (value) { return value !== item[0]; });
              else next.push(item[0]);
              self.settingsSetListValues(key, next);
            } }
          }, [
            h("span", { staticClass: "hn-check" }, checked ? "✓" : ""),
            h("span", { staticClass: "hn-combo-value" }, item[1])
          ]);
        })) : null
      ]);
    },
    settingsTextAreaField: function (h, key, placeholder, rows) {
      var self = this;
      return h("textarea", {
        staticClass: "hn-textarea",
        attrs: { rows: rows || 3, placeholder: placeholder || "" },
        domProps: { value: self.settingsForm[key] },
        on: { input: function (event) { self.settingsValue(key, event.target.value); } }
      });
    },
    renderReadyLists: function (h) {
      var self = this;
      var selected = self.selectedReadyLists();
      var query = String(self.readyListSearch || "").toLowerCase();
      var options = self.readyListOptions().filter(function (item) {
        return !query || (item[1] + " " + item[2]).toLowerCase().indexOf(query) !== -1;
      });
      return h("div", { staticClass: "hn-ready" }, [
        h("button", {
          staticClass: "hn-ready-summary",
          attrs: { type: "button" },
          on: { click: function () { self.readyListsOpen = !self.readyListsOpen; } }
        }, [
          selected.length ? selected.slice(0, 5).map(function (key) {
            var meta = self.readyListMeta(key);
            return h("span", { staticClass: "hn-chip", style: { "--hn-item-color": meta.color } }, [
              self.readyListIcon(h, key),
              h("span", self.getReadyLabel(key))
            ]);
          }) : h("span", { staticClass: "hn-muted" }, "Выберите готовые списки"),
          selected.length > 5 ? h("span", { staticClass: "hn-chip hn-chip-count" }, String(selected.length)) : null,
          h("span", { staticClass: self.readyListsOpen ? "hn-caret open" : "hn-caret" })
        ]),
        self.readyListsOpen ? h("div", { staticClass: "hn-ready-panel" }, [
          h("input", {
            staticClass: "hn-input hn-ready-search",
            attrs: { type: "search", placeholder: "Поиск по спискам..." },
            domProps: { value: self.readyListSearch },
            on: { input: function (event) { self.readyListSearch = event.target.value; } }
          }),
          h("div", { staticClass: "hn-ready-items" }, options.map(function (item) {
            var checked = selected.indexOf(item[0]) !== -1;
            var meta = self.readyListMeta(item[0]);
            var disabledReason = self.readyListDisabledReason(item[0]);
            return h("button", {
              staticClass: [
                "hn-ready-item",
                checked ? "active" : "",
                disabledReason ? "disabled" : ""
              ].filter(Boolean).join(" "),
              style: { "--hn-item-color": meta.color },
              attrs: { type: "button", disabled: disabledReason ? true : false, title: disabledReason || "" },
              on: { click: function () { if (!disabledReason) self.toggleReadyList(item[0]); } }
            }, [
              h("span", { staticClass: "hn-check" }, checked ? "✓" : ""),
              h("span", { staticClass: "hn-ready-name" }, [
                self.readyListIcon(h, item[0]),
                h("span", item[1])
              ]),
              h("span", { staticClass: "hn-ready-desc" }, item[2])
            ]);
          })),
          h("div", { staticClass: "hn-ready-footer" }, [
            h("span", "Выбрано " + selected.length + " из " + self.readyListOptions().length),
            h("button", { staticClass: "hn-btn", attrs: { type: "button" }, on: { click: function () { self.setSelectedReadyLists([]); } } }, "Очистить")
          ])
        ]) : null
      ]);
    },
    renderProxyReadyLists: function (h) {
      var self = this;
      var selected = self.selectedProxyReadyLists();
      var query = String(self.proxyReadyListSearch || "").toLowerCase();
      var options = self.readyListOptions().filter(function (item) {
        if (["ai_full", "chatgpt", "claude"].indexOf(item[0]) === -1) return false;
        return !query || (item[1] + " " + item[2]).toLowerCase().indexOf(query) !== -1;
      });
      return h("div", { staticClass: "hn-ready hn-ready-proxy" }, [
        h("button", {
          staticClass: "hn-ready-summary",
          attrs: { type: "button" },
          on: { click: function () { self.proxyReadyListsOpen = !self.proxyReadyListsOpen; } }
        }, [
          selected.length ? selected.slice(0, 5).map(function (key) {
            var meta = self.readyListMeta(key);
            return h("span", { staticClass: "hn-chip", style: { "--hn-item-color": meta.color } }, [
              self.readyListIcon(h, key),
              h("span", self.getReadyLabel(key))
            ]);
          }) : h("span", { staticClass: "hn-muted" }, "Выберите готовые списки"),
          selected.length > 5 ? h("span", { staticClass: "hn-chip hn-chip-count" }, String(selected.length)) : null,
          h("span", { staticClass: self.proxyReadyListsOpen ? "hn-caret open" : "hn-caret" })
        ]),
        self.proxyReadyListsOpen ? h("div", { staticClass: "hn-ready-panel" }, [
          h("input", {
            staticClass: "hn-input hn-ready-search",
            attrs: { type: "search", placeholder: "Поиск по спискам..." },
            domProps: { value: self.proxyReadyListSearch },
            on: { input: function (event) { self.proxyReadyListSearch = event.target.value; } }
          }),
          h("div", { staticClass: "hn-ready-items" }, options.map(function (item) {
            var checked = selected.indexOf(item[0]) !== -1;
            var meta = self.readyListMeta(item[0]);
            var disabledReason = "";
            if (selected.indexOf("ai_full") !== -1 && (item[0] === "chatgpt" || item[0] === "claude")) disabledReason = "Уже включено в AI Full";
            if (item[0] === "ai_full" && (selected.indexOf("chatgpt") !== -1 || selected.indexOf("claude") !== -1)) disabledReason = "Сначала снимите ChatGPT и Claude";
            return h("button", {
              staticClass: [
                "hn-ready-item",
                checked ? "active" : "",
                disabledReason ? "disabled" : ""
              ].filter(Boolean).join(" "),
              style: { "--hn-item-color": meta.color },
              attrs: { type: "button", disabled: disabledReason ? true : false, title: disabledReason || "" },
              on: { click: function () { if (!disabledReason) self.toggleProxyReadyList(item[0]); } }
            }, [
              h("span", { staticClass: "hn-check" }, checked ? "✓" : ""),
              h("span", { staticClass: "hn-ready-name" }, [
                self.readyListIcon(h, item[0]),
                h("span", item[1])
              ]),
              h("span", { staticClass: "hn-ready-desc" }, item[2])
            ]);
          })),
          h("div", { staticClass: "hn-ready-footer" }, [
            h("span", "Выбрано " + selected.length + " из 3"),
            h("button", { staticClass: "hn-btn", attrs: { type: "button" }, on: { click: function () { self.setSelectedProxyReadyLists([]); } } }, "Очистить")
          ])
        ]) : null
      ]);
    },
    renderSubscriptionModal: function (h) {
      var self = this;
      if (!self.subscriptionModalOpen) return null;
      return h("div", { staticClass: "hn-modal-backdrop" }, [
        h("div", { staticClass: "hn-modal" }, [
          h("div", { staticClass: "hn-modal-head" }, [
            h("div", { staticClass: "hn-modal-title" }, "Подписка HarpyNet"),
            h("button", { staticClass: "hn-icon-btn", attrs: { type: "button" }, on: { click: self.closeSubscriptionModal } }, "x")
          ]),
          h("label", { staticClass: "hn-field" }, [
            h("span", "Ссылка подписки"),
            h("input", {
              staticClass: "hn-input",
              attrs: { type: "url", placeholder: "https://..." },
              domProps: { value: self.subscriptionUrl },
              on: { input: function (event) { self.subscriptionUrl = event.target.value; } }
            })
          ]),
          h("div", { staticClass: "hn-help" }, "После сохранения HarpyNet будет брать серверы из этой ссылки. Можно сразу сохранить и обновить подписку."),
          h("div", { staticClass: "hn-modal-actions" }, [
            self.actionButton(h, "Сохранить", function () { self.saveSubscription(false); }, false, self.actionLoading === "subscription_save"),
            self.actionButton(h, "Сохранить и обновить", function () { self.saveSubscription(true); }, true, self.actionLoading === "subscription_save_update"),
            self.actionButton(h, "Закрыть", self.closeSubscriptionModal, false, false)
          ])
        ])
      ]);
    },
    renderMihomoConfigModal: function (h) {
      var self = this;
      if (!self.mihomoModalOpen) return null;
      var config = self.mihomoConfig && self.mihomoConfig.config ? String(self.mihomoConfig.config) : "";
      var stats = self.mihomoConfigStats();
      var overview = self.mihomoConfigOverview();
      var visibleConfig = self.mihomoVisibleConfig();
      return h("div", {
        staticClass: "hn-modal-backdrop",
        on: {
          click: function (event) {
            if (event.target === event.currentTarget) self.closeMihomoConfig();
          }
        }
      }, [
        h("div", { staticClass: "hn-modal hn-mihomo-modal" }, [
          h("div", { staticClass: "hn-modal-head" }, [
            h("div", [
              h("div", { staticClass: "hn-modal-title" }, "Mihomo config"),
              h("div", { staticClass: "hn-muted" }, "Активный Remnawave YAML · только чтение")
            ]),
            h("button", { staticClass: "hn-icon-btn", attrs: { type: "button" }, on: { click: self.closeMihomoConfig } }, "x")
          ]),
          self.mihomoConfigError ? h("div", { staticClass: "hn-error" }, self.mihomoConfigError) : null,
          self.mihomoConfigLoading ? h("div", { staticClass: "hn-placeholder" }, "Loading Mihomo config...") : null,
          !self.mihomoConfigLoading && self.mihomoConfig ? h("div", { staticClass: "hn-mihomo-body" }, [
            h("div", { staticClass: "hn-mihomo-stats" }, [
              h("div", { staticClass: "hn-mini-stat" }, [h("span", { staticClass: "hn-mini-label" }, "path"), h("span", { staticClass: "hn-mini-value" }, self.mihomoConfig.path || "N/A")]),
              h("div", { staticClass: "hn-mini-stat" }, [h("span", { staticClass: "hn-mini-label" }, "size"), h("span", { staticClass: "hn-mini-value" }, stats.size)]),
              h("div", { staticClass: "hn-mini-stat" }, [h("span", { staticClass: "hn-mini-label" }, "lines"), h("span", { staticClass: "hn-mini-value" }, String(stats.lines))]),
              h("div", { staticClass: "hn-mini-stat" }, [h("span", { staticClass: "hn-mini-label" }, "proxies"), h("span", { staticClass: "hn-mini-value" }, String(stats.proxies))]),
              h("div", { staticClass: "hn-mini-stat" }, [h("span", { staticClass: "hn-mini-label" }, "providers"), h("span", { staticClass: "hn-mini-value" }, String(stats.providers))]),
              h("div", { staticClass: "hn-mini-stat" }, [h("span", { staticClass: "hn-mini-label" }, "rules"), h("span", { staticClass: "hn-mini-value" }, String(stats.rules))])
            ]),
            h("div", { staticClass: "hn-mihomo-overview" }, [
              h("div", { staticClass: "hn-mihomo-overview-box" }, [
                h("div", { staticClass: "hn-mihomo-overview-title" }, "Proxy groups"),
                h("div", { staticClass: "hn-mihomo-tags" }, overview.groups.map(function (name) {
                  return h("span", { staticClass: "hn-mihomo-tag group" }, name);
                }))
              ]),
              h("div", { staticClass: "hn-mihomo-overview-box" }, [
                h("div", { staticClass: "hn-mihomo-overview-title" }, "Proxies"),
                h("div", { staticClass: "hn-mihomo-tags" }, overview.proxies.map(function (name) {
                  return h("span", { staticClass: "hn-mihomo-tag proxy", style: { gap: "6px" } }, [
                    self.flagNode(h, name),
                    h("span", self.cleanCountryName(name) || name)
                  ]);
                }))
              ]),
              h("div", { staticClass: "hn-mihomo-overview-box" }, [
                h("div", { staticClass: "hn-mihomo-overview-title" }, "Rule providers"),
                h("div", { staticClass: "hn-mihomo-tags" }, overview.providers.map(function (name) {
                  return h("span", { staticClass: "hn-mihomo-tag" }, name);
                }))
              ])
            ]),
            h("div", { staticClass: "hn-mihomo-toolbar" }, [
              h("input", {
                staticClass: "hn-input",
                attrs: { type: "search", placeholder: "Поиск по YAML..." },
                domProps: { value: self.mihomoConfigSearch },
                on: { input: function (event) { self.mihomoConfigSearch = event.target.value; } }
              })
            ]),
            h("div", { staticClass: "hn-mihomo-editor" }, [
              h("div", { staticClass: "hn-mihomo-gutter" }, visibleConfig.split(/\r?\n/).map(function (_line, index) {
                return h("div", String(index + 1));
              })),
              h("pre", {
                staticClass: self.mihomoConfigWrap ? "hn-mihomo-pre wrap" : "hn-mihomo-pre"
              }, visibleConfig || (config ? "Совпадений не найдено" : "Config is empty"))
            ])
          ]) : null,
          h("div", { staticClass: "hn-modal-actions" }, [
            self.actionButton(h, "Обновить", self.loadMihomoConfig, false, self.mihomoConfigLoading),
            self.actionButton(h, "Закрыть", self.closeMihomoConfig, false, false)
          ])
        ])
      ]);
    },
    renderDashboard: function (h) {
      var self = this;
      var data = self.dashboard || { metadata: {}, outbounds: [], proxies: {} };
      if ((!data.outbounds || !data.outbounds.length) && self.status && self.status.raw_status) {
        var rawDashboard = self.parseJson(self.status.raw_status, {});
        var rawMetadata = self.parseJson(rawDashboard.metadata, {});
        var rawOutbounds = self.parseJson(rawDashboard.outbounds, { outbounds: [] });
        var rawProxies = self.parseJson(rawDashboard.proxies, {});
        data = {
          metadata: rawMetadata || {},
          outbounds: Array.isArray(rawOutbounds.outbounds) ? rawOutbounds.outbounds : [],
          proxies: rawProxies && rawProxies.proxies ? rawProxies.proxies : {},
          selected: rawDashboard.selected_outbound || ""
        };
      }
      var selected = data.selected || "";
      var mainProxy = data.proxies && (data.proxies["🌍 Страна"] || data.proxies["main-out"]);
      if (!selected && mainProxy && mainProxy.now) selected = mainProxy.now;
      var visibleOutbounds = (data.outbounds || []).filter(function (outbound) {
        return !self.hiddenDashboardOutbound(outbound);
      });
      return h("div", { staticClass: "hn-card hn-section hn-dashboard" }, [
        h("div", { staticClass: "hn-dashboard-head" }, [
          h("div", { staticClass: "hn-section-title" }, "Страна"),
          h("div", { staticClass: "hn-actions" }, [
            self.pingButton(h)
          ])
        ]),
        self.dashboardError ? h("div", { staticClass: "hn-error" }, self.dashboardError) : null,
        visibleOutbounds.length ? h("div", { staticClass: "hn-outbounds" }, visibleOutbounds.map(function (outbound, index) {
          var tag = outbound.tag || "";
          var active = tag && tag === selected;
          var switching = self.outboundSwitching === tag;
          return h("button", {
            staticClass: active ? "hn-outbound active" : "hn-outbound",
            attrs: { type: "button", disabled: Boolean(self.outboundSwitching || self.dashboardLoading), title: active ? "Выбранный сервер" : "Выбрать сервер" },
            on: { click: function () { if (!active) self.selectOutbound(tag); } }
          }, [
            h("div", { staticClass: "hn-outbound-name" }, [
              self.flagNode(h, tag),
              h("span", switching ? "Переключение..." : self.cleanCountryName(tag) || "сервер")
            ]),
            h("div", { staticClass: "hn-outbound-meta" }, [
              h("span", self.protocolFromLink(outbound.link)),
              self.latencyNode(h, tag, index)
            ])
          ]);
        })) : h("div", { staticClass: "hn-placeholder" }, self.dashboardLoading ? "Загрузка серверов..." : "Серверы пока не найдены")
      ]);
    },
    renderSections: function (h, status, subscriptionLabel, subscriptionButtonLabel) {
      var self = this;
      var connectionOptions = [
        ["proxy", "Умный обход"],
        ["full_proxy", "Полный VPN"],
        ["full_proxy_bypass_ru", "Полный VPN без РФ"],
        ["exclusion", "Выключить VPN"]
      ];
      var listTypeOptions = [
        ["disabled", "Отключено"],
        ["text", "Текстовый список"]
      ];

      return h("div", { staticClass: "hn-card hn-section" }, [
        h("div", { staticClass: "hn-section-title" }, "Маршрутизация"),
        self.field(h, "Тип подключения", "Выберите режим маршрутизации: умный обход, полный VPN, полный VPN без РФ или выключить VPN.", self.segmentedField(h, "connection_type", connectionOptions)),
        self.field(h, "Подписка", "Вставьте ссылку подписки HarpyNet и сохраните её на роутере.", h("div", { staticClass: "hn-inline" }, [
          self.actionButton(h, subscriptionButtonLabel, self.openSubscriptionModal, !status.has_subscription, false)
        ])),
        self.field(h, "UDP через TCP", "Применимо для SOCKS и Shadowsocks прокси", self.flagField(h, "enable_udp_over_tcp")),
        self.field(h, "Дополнительный маршрут через прокси", "Выбранные ниже сервисы и домены пойдут через отдельный SOCKS5, HTTP или HTTPS-прокси раньше основных правил VPN.", self.flagField(h, "upstream_proxy_enabled")),
        self.field(h, "Тип пользовательского списка доменов", "Выберите тип списка для добавления пользовательских доменов", self.selectField(h, "user_domain_list_type", listTypeOptions)),
        self.form.user_domain_list_type === "text" ? self.field(h, "Список пользовательских доменов", "Домены можно писать через запятую, пробел или с новой строки. Комментарии начинаются с //. Для применения нажмите «Сохранить» внизу раздела.", self.manualTextAreaField(h, "user_domains_text", "example.com, sub.example.com\n// Social networks\ndomain.com test.com // personal domains", 6)) : null,
        self.field(h, "Тип пользовательского списка подсетей", "Выберите тип списка для добавления пользовательских подсетей", self.selectField(h, "user_subnet_list_type", listTypeOptions)),
        self.form.user_subnet_list_type === "text" ? self.field(h, "Список пользовательских подсетей", "Введите подсети или IP, разделяя их запятыми, пробелами или переносами строк.", self.manualTextAreaField(h, "user_subnets_text", "192.168.1.2\n192.168.1.0/24", 4)) : null,
        self.field(h, "Локальные списки", "Файлы списков из файловой системы роутера. Обычно не нужно.", self.advancedListSwitch(h, "local")),
        self.advancedListOpen.local ? self.field(h, "Локальные списки доменов", "Укажите путь к файлу списка, расположенному в файловой системе маршрутизатора.", self.manualTextAreaField(h, "local_domain_lists", "/path/file.lst", 2)) : null,
        self.advancedListOpen.local ? self.field(h, "Локальные списки подсетей", "Укажите путь к файлу списка, расположенному в файловой системе маршрутизатора.", self.manualTextAreaField(h, "local_subnet_lists", "/path/file.lst", 2)) : null,
        self.field(h, "Внешние списки", "URL-адреса доменных и IP-списков для загрузки. Обычно не нужно.", self.advancedListSwitch(h, "remote")),
        self.advancedListOpen.remote ? self.field(h, "Внешние списки доменов", "Укажите URL-адреса для загрузки и использования списков доменов.", self.manualTextAreaField(h, "remote_domain_lists", "https://example.com/domains.srs", 2)) : null,
        self.advancedListOpen.remote ? self.field(h, "Внешние списки подсетей", "Укажите URL-адреса для загрузки и использования списков подсетей.", self.manualTextAreaField(h, "remote_subnet_lists", "https://example.com/subnets.srs", 2)) : null,
        self.field(h, "Полностью маршрутизированные IP", "Локальные IP или подсети, которые всегда идут через выбранный маршрут.", self.advancedListSwitch(h, "routed")),
        self.advancedListOpen.routed ? self.field(h, "IP-адреса", "Укажите локальные IP-адреса или подсети, трафик которых всегда будет направляться через настроенный маршрут.", self.manualTextAreaField(h, "fully_routed_ips", "192.168.7.129\n192.168.1.2 or 192.168.1.0/24", 3)) : null,
        self.field(h, "Включить смешанный прокси", "Включить смешанный прокси-сервер, разрешив этому разделу маршрутизировать трафик как через HTTP, так и через SOCKS-прокси.", self.flagField(h, "mixed_proxy_enabled")),
        self.form.mixed_proxy_enabled === "1" ? self.field(h, "Порт смешанного прокси", "Укажите свободный локальный порт.", self.inputField(h, "mixed_proxy_port", "2080")) : null,
        self.field(h, "Разрешение реальных IP-адресов", "Разрешать домены в реальные IP-адреса перед маршрутизацией в outbound", self.flagField(h, "resolve_real_ip_for_routing")),
        h("div", { staticClass: "hn-savebar" }, [
          h("span", { staticClass: "hn-muted" }, self.formDirty ? "Есть несохранённые изменения" : "Настройки синхронизированы"),
          h("div", { staticClass: "hn-actions" }, [
            self.actionButton(h, "Сохранить", self.saveMainConfig, true, self.actionLoading === "set_main_config"),
            self.actionButton(h, "Сбросить", self.resetMainConfig, false, false)
          ])
        ])
      ]);
    },
    renderProxy: function (h) {
      var self = this;
      var protocolOptions = [
        ["http", "HTTP"],
        ["https", "HTTPS"],
        ["socks5", "SOCKS5"]
      ];
      return h("div", { staticClass: "hn-card hn-section hn-proxy" }, [
        h("div", { staticClass: "hn-section-title" }, "Прокси"),
        h("div", { staticClass: "hn-proxy-alert" }, [
          h("strong", "Прокси"),
          h("span", String(self.form.upstream_proxy_server || "").trim() && String(self.form.upstream_proxy_port || "").trim() ? "Профиль заполнен" : "⚠ Нужно заполнить профиль")
        ]),
        self.field(h, "Профиль", "Профиль хранит адрес, протокол и авторизацию. Списки и домены ниже остаются общими.", h("div", { staticClass: "hn-inline" }, [
          h("span", { staticClass: "hn-badge" }, "Профиль 1"),
          h("span", { staticClass: "hn-muted" }, "Заполните адрес и порт ниже")
        ])),
        self.field(h, "Проверка активного профиля", "Проверяет доступность сохранённого прокси с роутера, включая сохранённые логин и пароль.", h("div", { staticClass: "hn-inline" }, [
          h("span", { staticClass: "hn-badge" }, "Профиль 1 | " + (self.form.upstream_proxy_name || "Профиль 1")),
          h("span", { staticClass: "hn-badge" }, String(self.form.upstream_proxy_protocol || "proxy").toUpperCase()),
          self.actionButton(h, "Проверить пинг", self.checkProxyConfig, false, self.actionLoading === "check_upstream_proxy")
        ])),
        self.field(h, "Название прокси", "Отображаемое название маршрута, например AI Proxy.", self.inputField(h, "upstream_proxy_name", "AI Proxy")),
        self.field(h, "Протокол прокси", "HTTPS означает защищённое TLS-соединение от роутера до HTTP-прокси.", self.selectField(h, "upstream_proxy_protocol", protocolOptions)),
        self.field(h, "IP или домен прокси", "Адрес внешнего прокси без http://, https:// и номера порта.", self.inputField(h, "upstream_proxy_server", "proxy.example.com")),
        self.field(h, "Порт прокси", "Порт от 1 до 65535.", self.inputField(h, "upstream_proxy_port", "1080")),
        self.field(h, "Логин прокси", "Оставьте пустым, если авторизация не требуется.", self.inputField(h, "upstream_proxy_username", "")),
        self.field(h, "Пароль прокси", "Пароль не выводится в интерфейсе после ввода и не должен попадать в логи.", self.inputField(h, "upstream_proxy_password", "")),
        self.form.upstream_proxy_protocol === "https" ? self.field(h, "TLS server name", "Опциональное имя сервера. Нужно, если HTTPS-прокси требует отдельное SNI-имя.", self.inputField(h, "upstream_proxy_tls_server_name", "proxy.example.com")) : null,
        self.field(h, "Готовые AI-списки", "Только AI Full, ChatGPT и Claude. Выбранные домены пойдут через этот отдельный прокси.", self.renderProxyReadyLists(h)),
        self.field(h, "Домены через прокси", "Дополнительные домены через прокси: по одному в строке либо через запятую. Указывайте без протокола.", self.textAreaField(h, "upstream_proxy_domains", "example.com\napi.example.com", 5)),
        h("div", { staticClass: "hn-savebar" }, [
          h("span", { staticClass: "hn-muted" }, self.formDirty ? "Есть несохранённые изменения" : "Настройки синхронизированы"),
          h("div", { staticClass: "hn-actions" }, [
            self.actionButton(h, "Сохранить", self.saveProxyConfig, false, self.actionLoading === "set_main_config"),
            self.actionButton(h, "Сохранить и проверить", self.checkProxyConfig, true, self.actionLoading === "check_upstream_proxy"),
            self.actionButton(h, "Сбросить", self.resetMainConfig, false, false)
          ])
        ])
      ]);
    },
    renderSettings: function (h) {
      var self = this;
      var dnsOptions = [
        ["udp", "UDP (Незащищённый DNS)"],
        ["dot", "DoT (DNS-over-TLS)"],
        ["doh", "DoH (DNS-over-HTTPS)"]
      ];
      var dnsServerOptions = [
        ["1.1.1.1", "Cloudflare"],
        ["8.8.8.8", "Google"],
        ["9.9.9.9", "Quad9"],
        ["77.88.8.8", "Yandex"],
        ["dns.adguard-dns.com", "AdGuard Default"],
        ["unfiltered.adguard-dns.com", "AdGuard Unfiltered"],
        ["family.adguard-dns.com", "AdGuard Family"]
      ];
      var bootstrapDnsOptions = [
        ["77.88.8.8", "Yandex DNS"],
        ["77.88.8.1", "Yandex DNS"],
        ["1.1.1.1", "Cloudflare DNS"],
        ["1.0.0.1", "Cloudflare DNS"],
        ["8.8.8.8", "Google DNS"],
        ["8.8.4.4", "Google DNS"],
        ["9.9.9.9", "Quad9 DNS"],
        ["9.9.9.11", "Quad9 DNS"]
      ];
      var updateOptions = [
        ["1h", "Каждый час"],
        ["3h", "Каждые 3 часа"],
        ["12h", "Каждые 12 часов"],
        ["1d", "Каждый день"],
        ["3d", "Каждые 3 дня"]
      ];
      var subscriptionUpdateOptions = [
        ["1h", "Каждый час"],
        ["3h", "Каждые 3 часа"],
        ["6h", "Каждые 6 часов"],
        ["12h", "Каждые 12 часов"],
        ["1d", "Каждый день"]
      ];
      var logOptions = [
        ["trace", "Trace"],
        ["debug", "Debug"],
        ["info", "Info"],
        ["warn", "Warn"],
        ["error", "Error"],
        ["fatal", "Fatal"],
        ["panic", "Panic"]
      ];
      var configPathOptions = [
        ["/tmp/mihomo/config.yaml", "RAM (/tmp/mihomo/config.yaml)"],
        ["/etc/harpynet/mihomo-config.yaml", "Flash (/etc/harpynet/mihomo-config.yaml)"]
      ];
      var cachePathOptions = [
        ["/etc/harpynet/mihomo-config.yaml", "/etc/harpynet/mihomo-config.yaml"],
        ["/etc/harpynet/mihomo-subscription.yaml", "/etc/harpynet/mihomo-subscription.yaml"]
      ];
      var interfaceOptions = self.interfaceOptions();

      return h("div", { staticClass: "hn-card hn-section" }, [
        h("div", { staticClass: "hn-section-title" }, "DNS и система"),
        self.field(h, "Тип протокола DNS", "Выберите протокол DNS для upstream-запросов HarpyNet.", self.settingsSelectField(h, "dns_type", dnsOptions)),
        self.field(h, "DNS-сервер", "Выберите готовый DNS или введите свой адрес вручную. Сейчас клиенты идут в dnsmasq на роутере, а HarpyNet дальше отправляет DNS сюда.", self.settingsComboField(h, "dns_server", "77.88.8.8 или dns.example.com", dnsServerOptions)),
        self.field(h, "Bootstrap DNS-сервер", "Выберите готовый bootstrap DNS или введите IP вручную. Он нужен для поиска IP-адреса вышестоящего DNS-сервера.", self.settingsComboField(h, "bootstrap_dns_server", "77.88.8.8", bootstrapDnsOptions)),
        self.field(h, "Перезапись TTL для DNS", "Время в секундах для кэширования DNS записей и fakeip-ответов.", self.settingsInputField(h, "dns_rewrite_ttl", "60")),
        self.field(h, "Сетевой интерфейс источника", "Интерфейс, с которого HarpyNet забирает клиентский трафик. Для GL обычно br-lan.", self.settingsMultiSelectField(h, "source_network_interfaces", interfaceOptions, "Выберите интерфейс")),
        self.field(h, "Включить выходной сетевой интерфейс", "Можно принудительно выбрать WAN-интерфейс, по умолчанию HarpyNet определяет его автоматически.", h("div", [
          self.settingsFlagField(h, "enable_output_network_interface"),
          self.settingsForm.enable_output_network_interface === "1" ? h("div", { staticClass: "hn-inline hn-settings-nested" }, [
            self.settingsSelectField(h, "output_network_interface", interfaceOptions)
          ]) : null
        ])),
        self.field(h, "Мониторинг интерфейса", "Мониторинг интерфейса для Bad WAN. На домашнем GL обычно выключено.", h("div", [
          self.settingsFlagField(h, "enable_badwan_interface_monitoring"),
          self.settingsForm.enable_badwan_interface_monitoring === "1" ? h("div", { staticClass: "hn-inline hn-settings-nested" }, [
            self.settingsMultiSelectField(h, "badwan_monitored_interfaces", interfaceOptions, "Выберите интерфейсы")
          ]) : null
        ])),
        self.field(h, "Включить YACD", "Включает Clash-compatible панель Mihomo. Локальный адрес на этом роутере: http://" + (window.location.hostname || "IP-роутера") + ":9090/ui", self.settingsFlagField(h, "enable_yacd")),
        self.field(h, "Отключить QUIC", "Отключить QUIC протокол для улучшения совместимости или исправления видео-стриминга.", self.settingsFlagField(h, "disable_quic")),
        self.field(h, "Частота обновления списков", "Как часто HarpyNet обновляет доменные/IP списки.", self.settingsSelectField(h, "update_interval", updateOptions)),
        self.field(h, "Частота обновления подписки", "Как часто HarpyNet заново загружает подписку для обновления ключей, серверов и информации о подписке.", self.settingsSelectField(h, "subscription_update_interval", subscriptionUpdateOptions)),
        self.field(h, "Скачивать списки через прокси", "Загружать списки доменов и подсетей через выбранную прокси-секцию.", self.settingsFlagField(h, "download_lists_via_proxy")),
        self.field(h, "Не изменять DHCP", "Если включить, HarpyNet не будет менять конфигурацию DHCP/dnsmasq. Для обычной установки лучше оставить выключенным.", self.settingsFlagField(h, "dont_touch_dhcp")),
        self.field(h, "Путь к файлу конфигурации", "Активный YAML Mihomo или его копия во flash.", self.settingsSelectField(h, "config_path", configPathOptions)),
        self.field(h, "Путь к файлу кэша", "Сохранённый YAML Remnawave/Mihomo.", self.settingsSelectField(h, "cache_path", cachePathOptions)),
        self.field(h, "Уровень логов", "Уровень логов Mihomo.", self.settingsSelectField(h, "log_level", logOptions)),
        self.field(h, "Исключить NTP", "Синхронизация времени будет идти напрямую, минуя HarpyNet.", self.settingsFlagField(h, "exclude_ntp")),
        self.field(h, "Исключённые из маршрутизации IP-адреса", "Локальные IP-адреса, которые нужно пустить напрямую и не трогать HarpyNet. Обычно не нужно.", self.advancedListSwitch(h, "excluded")),
        self.advancedListOpen.excluded ? self.field(h, "IP-адреса без маршрутизации", "Локальные IP-адреса, которые нужно пустить напрямую и не трогать HarpyNet.", self.settingsTextAreaField(h, "routing_excluded_ips", "192.168.x.x", 3)) : null,
        h("div", { staticClass: "hn-savebar" }, [
          h("span", { staticClass: "hn-muted" }, self.settingsDirty ? "Есть несохранённые изменения" : "Настройки синхронизированы"),
          h("div", { staticClass: "hn-actions" }, [
            self.actionButton(h, "Сохранить", self.saveSettingsConfig, true, self.actionLoading === "set_settings_config"),
            self.actionButton(h, "Сбросить", self.resetSettingsConfig, false, false)
          ])
        ])
      ]);
    }
  },
  render: function (h) {
    var self = this;
    var status = self.status || {};
    var subscriptionLabel = status.has_subscription ? "настроена" : "пусто";
    var subscriptionButtonLabel = "Управление";
    var tabs = [
      { id: "sections", label: "Секции" },
      { id: "proxy", label: "Прокси" },
      { id: "dashboard", label: "Страна" },
      { id: "settings", label: "Настройки" },
      { id: "devices", label: "Устройства" },
      { id: "connections", label: "Соединения" }
    ];
    if (self.form.upstream_proxy_enabled !== "1") {
      tabs = tabs.filter(function (tab) { return tab.id !== "proxy"; });
      if (self.activeTab === "proxy") self.activeTab = "sections";
    }
    return h("div", { staticClass: "harpynet-gl hn-theme-" + self.theme }, [
      h("style", ["html,body{scrollbar-gutter:stable;overflow-y:scroll}.main-container{scrollbar-gutter:stable}.harpynet-gl{overflow:visible;--hn-bg:#202020;--hn-card:#2b2b2b;--hn-card-strong:#242424;--hn-text:#f2f6ff;--hn-soft:#9aa9ca;--hn-border:rgba(140,155,184,.28);--hn-line:rgba(140,155,184,.18);--hn-input:#181a1f;--hn-primary:#4d6bff;--hn-primary-2:#34c9ff;color:var(--hn-text);padding:14px 38px 70px 20px}.hn-theme-light{--hn-bg:#f4f6fb;--hn-card:#fff;--hn-card-strong:#f7f9fd;--hn-text:#172033;--hn-soft:#5f6f8f;--hn-border:#cfd7e6;--hn-line:#dfe5ef;--hn-input:#fff;--hn-primary:#315dff;--hn-primary-2:#048bc7}.hn-head{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin:6px 0 18px}.hn-title{font-size:28px;font-weight:800;line-height:1.15;color:var(--hn-text)}.hn-sub{color:var(--hn-soft);margin-top:6px}.hn-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.hn-top-actions{justify-content:flex-start;margin-top:2px}.hn-manual-actions{margin-top:10px}.hn-segments{display:flex;gap:8px;flex-wrap:wrap;width:min(100%,760px)}.hn-segment{min-height:36px;padding:0 13px;border-radius:7px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer;font-weight:700}.hn-segment:hover{border-color:var(--hn-primary-2);background:color-mix(in srgb,var(--hn-primary-2) 8%,var(--hn-card-strong))}.hn-segment.active{background:var(--hn-primary);border-color:var(--hn-primary);color:#fff;box-shadow:0 8px 20px rgba(77,107,255,.22)}.hn-tab-nav{display:flex;align-items:center;gap:8px;margin:0 0 12px}.hn-tabs{display:flex;gap:8px;flex-wrap:wrap;min-width:0}.hn-tab-arrow{width:36px;height:36px;border-radius:8px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-primary-2);cursor:pointer;font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center}.hn-tab-arrow:hover{border-color:var(--hn-primary-2);background:rgba(52,201,255,.13)}.hn-tab{height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer}.hn-tab.active{border-color:var(--hn-primary-2);background:rgba(52,201,255,.13);color:var(--hn-primary-2)}.hn-tab-page{will-change:transform,opacity;overflow:visible}.hn-tab-page.slide-next{animation:hnSlideNext .2s ease-out both}.hn-tab-page.slide-prev{animation:hnSlidePrev .2s ease-out both}@keyframes hnSlideNext{from{opacity:.55;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}@keyframes hnSlidePrev{from{opacity:.55;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}.hn-card{background:var(--hn-card);border:1px solid var(--hn-border);border-radius:8px;padding:14px;box-shadow:0 10px 28px rgba(0,0,0,.08)}.hn-section{margin-top:12px}.hn-section-title{font-size:19px;font-weight:800;margin-bottom:12px;color:var(--hn-text)}.hn-label{font-size:12px;color:var(--hn-soft);margin-bottom:8px}.hn-value{font-size:18px;font-weight:800;word-break:break-word;color:var(--hn-text)}.hn-muted{color:var(--hn-soft)}.hn-help{color:var(--hn-soft);font-size:13px;margin-top:6px;line-height:1.35}.hn-badge{display:inline-flex;align-items:center;min-height:24px;padding:2px 9px;border-radius:999px;background:rgba(120,130,150,.14);color:var(--hn-text);font-size:12px;font-weight:700}.hn-badge-ok{background:rgba(22,199,132,.16);color:#159b67}.hn-btn{height:34px;padding:0 14px;border-radius:6px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer}.hn-btn:disabled{opacity:.55;cursor:not-allowed}.hn-btn-primary{background:var(--hn-primary);border-color:var(--hn-primary);color:#fff}.hn-error,.hn-notice{margin-bottom:14px;padding:10px 12px;border-radius:6px}.hn-error{border:1px solid rgba(216,54,68,.35);background:rgba(216,54,68,.12);color:#ff6d7a}.hn-form-row{display:grid;grid-template-columns:260px minmax(0,1fr);gap:24px;align-items:start;padding:16px 0;border-top:1px solid var(--hn-line)}.hn-form-row:first-of-type{border-top:0}.hn-form-label{font-weight:700;color:var(--hn-text);padding-top:8px}.hn-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hn-select,.hn-input,.hn-textarea{width:min(100%,560px);box-sizing:border-box;border-radius:6px;border:1px solid var(--hn-border);background:var(--hn-input);color:var(--hn-text);outline:none}.hn-select,.hn-input{height:38px;padding:0 10px}.hn-textarea{padding:10px;resize:vertical;line-height:1.4}.hn-select:focus,.hn-input:focus,.hn-textarea:focus{border-color:var(--hn-primary-2);box-shadow:0 0 0 2px rgba(52,201,255,.12)}.hn-switch{display:inline-flex;align-items:center;gap:8px;height:34px}.hn-switch input{display:none}.hn-switch span{width:42px;height:22px;border-radius:999px;border:1px solid var(--hn-border);background:rgba(120,130,150,.18);position:relative}.hn-switch span:before{content:\"\";position:absolute;width:16px;height:16px;left:3px;top:2px;border-radius:50%;background:var(--hn-soft);transition:.15s}.hn-switch input:checked+span{background:rgba(22,199,132,.22);border-color:#16c784}.hn-switch input:checked+span:before{left:21px;background:#16c784}.hn-ready{width:min(100%,760px);position:relative}.hn-ready-summary{min-height:42px;width:100%;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-input);color:var(--hn-text);display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:7px 36px 7px 8px;text-align:left;cursor:pointer}.hn-chip{display:inline-flex;align-items:center;gap:6px;min-height:26px;border-radius:6px;border:1px solid color-mix(in srgb,var(--hn-item-color,#34c9ff) 55%,transparent);background:color-mix(in srgb,var(--hn-item-color,#34c9ff) 16%,transparent);color:var(--hn-text);padding:2px 8px;font-weight:700;font-size:12px}.hn-chip-count{border-color:var(--hn-border);background:rgba(120,130,150,.12)}.hn-caret{position:absolute;right:13px;top:11px;color:var(--hn-soft)}.hn-ready-panel{margin-top:6px;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-card);overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.22);z-index:5}.hn-ready-search{width:100%;max-width:none;border-radius:0;border-width:0 0 1px 0}.hn-ready-items{max-height:360px;overflow:auto}.hn-ready-item{width:100%;display:grid;grid-template-columns:28px 210px minmax(0,1fr);gap:10px;align-items:center;border:0;border-left:3px solid transparent;border-bottom:1px solid var(--hn-line);background:transparent;color:var(--hn-text);padding:10px;text-align:left;cursor:pointer}.hn-ready-item.active{border-left-color:var(--hn-item-color,#34c9ff);background:color-mix(in srgb,var(--hn-item-color,#34c9ff) 24%,#15181d)}.hn-ready-item.disabled{opacity:.42;filter:saturate(.35);cursor:not-allowed;background:rgba(0,0,0,.12)}.hn-check{width:18px;height:18px;border:1px solid var(--hn-border);border-radius:3px;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:transparent}.hn-ready-item.active .hn-check{border-color:var(--hn-item-color,#34c9ff);background:var(--hn-item-color,#34c9ff)}.hn-ready-name{display:inline-flex;align-items:center;gap:9px;font-weight:800}.hn-ready-desc{color:var(--hn-soft);font-size:13px}.hn-ready-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px;color:var(--hn-soft)}.hn-savebar{position:sticky;bottom:0;margin:18px -14px -14px;padding:12px 14px;background:color-mix(in srgb,var(--hn-card) 92%,transparent);border-top:1px solid var(--hn-line);display:flex;justify-content:space-between;gap:12px;align-items:center;border-radius:0 0 8px 8px}.hn-placeholder{color:var(--hn-soft);line-height:1.55}.hn-modal-backdrop{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.46);display:flex;align-items:center;justify-content:center;padding:20px}.hn-modal{width:min(640px,100%);background:var(--hn-card);border:1px solid var(--hn-border);border-radius:8px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.38)}.hn-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.hn-modal-title{font-size:18px;font-weight:800}.hn-icon-btn{width:32px;height:32px;border-radius:6px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer}.hn-field{display:block}.hn-field span{display:block;color:var(--hn-soft);font-size:12px;margin-bottom:8px}.hn-modal-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}@media(max-width:980px){.harpynet-gl{padding-right:18px}.hn-form-row{grid-template-columns:1fr;gap:8px}.hn-form-label{padding-top:0}.hn-ready-item{grid-template-columns:28px minmax(0,1fr)}.hn-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.hn-tabs::-webkit-scrollbar{display:none}.hn-tab{flex:0 0 auto}}@media(max-width:560px){.hn-modal-actions,.hn-savebar{justify-content:flex-start}.hn-savebar{position:static;flex-direction:column;align-items:flex-start}}"]),
      h("style", [".hn-tab-nav{display:grid;grid-template-columns:36px minmax(0,1fr) 36px;align-items:center;gap:8px;width:min(100%,960px);margin:0 0 12px}.hn-tabs{display:flex;gap:8px;flex-wrap:wrap;min-width:0}.hn-tab-arrow{width:36px;height:36px;border-radius:9px;border:1px solid color-mix(in srgb,var(--hn-primary-2) 34%,var(--hn-border));background:linear-gradient(180deg,rgba(52,201,255,.1),rgba(52,201,255,.03)),var(--hn-card-strong);color:var(--hn-primary-2);cursor:pointer;font-size:23px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(0,0,0,.12);transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease}.hn-tab-arrow:last-child{justify-self:end}.hn-tab-arrow:hover{border-color:var(--hn-primary-2);background:linear-gradient(180deg,rgba(52,201,255,.2),rgba(52,201,255,.06)),var(--hn-card-strong);box-shadow:0 10px 28px rgba(52,201,255,.12);transform:translateY(-1px)}.hn-tab{transition:border-color .16s ease,background .16s ease,color .16s ease,box-shadow .16s ease}.hn-tab:hover{border-color:color-mix(in srgb,var(--hn-primary-2) 65%,var(--hn-border));background:rgba(52,201,255,.08)}.hn-tab.active{border-color:var(--hn-primary-2);background:linear-gradient(180deg,rgba(52,201,255,.2),rgba(52,201,255,.09));color:var(--hn-primary-2);box-shadow:0 0 0 1px rgba(52,201,255,.12) inset,0 10px 28px rgba(52,201,255,.1)}@media(max-width:980px){.hn-tab-nav{grid-template-columns:36px minmax(0,1fr) 36px}.hn-tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.hn-tabs::-webkit-scrollbar{display:none}}"]),
      h("style", ["@media(max-width:980px){.hn-tab-nav{width:100%}.hn-tabs{scroll-behavior:smooth;scroll-padding:0 18px;padding:1px 0}.hn-tab{min-width:max-content}.hn-tab-arrow{position:relative;z-index:2}}@media(max-width:420px){.hn-tab-nav{grid-template-columns:34px minmax(0,1fr) 34px;gap:6px}.hn-tab-arrow{width:34px;height:34px}.hn-tab{height:34px;padding:0 12px}}"]),
      h("style", [".hn-theme-light .hn-title,.hn-theme-light .hn-section-title,.hn-theme-light .hn-form-label,.hn-theme-light .hn-value,.hn-theme-light .hn-mini-version{color:#0b1324}.hn-theme-light .hn-card,.hn-theme-light .hn-mini-stat{background:#fff;border-color:#ccd6e6;box-shadow:0 8px 22px rgba(25,35,60,.08)}.hn-theme-light .hn-btn:not(.hn-btn-primary),.hn-theme-light .hn-tab,.hn-theme-light .hn-input,.hn-theme-light .hn-select,.hn-theme-light .hn-textarea,.hn-theme-light .hn-ready-summary{background:#fff;color:#0b1324;border-color:#c7d2e4}.hn-theme-light .hn-btn:not(.hn-btn-primary):hover,.hn-theme-light .hn-tab:hover{background:#f4f7fb}.hn-theme-light .hn-head-sub{background:linear-gradient(135deg,#eef8ff,#fff);border-color:#a9d8ef}.hn-theme-light .hn-help,.hn-theme-light .hn-sub,.hn-theme-light .hn-muted,.hn-theme-light .hn-label{color:#52627d}.hn-theme-light .hn-switch span{background:#e7edf6}.hn-theme-light .hn-ready-panel,.hn-theme-light .hn-combo-panel{background:#fff;border-color:#c7d2e4}.hn-theme-light .hn-ready-item,.hn-theme-light .hn-combo-item{color:#0b1324}.hn-theme-light .hn-ready-item.active{background:color-mix(in srgb,var(--hn-item-color,#34c9ff) 18%,#fff)}"]),
      h("style", [".hn-proxy-alert{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;border:1px solid var(--hn-line);border-radius:8px;background:rgba(120,130,150,.08)}.hn-proxy-alert strong{color:var(--hn-text)}.hn-proxy-alert span{color:#d7aa35;font-weight:800}.hn-proxy .hn-badge{white-space:nowrap}"]),
      h("style", [".hn-ready-icon{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important;object-fit:contain;flex:0 0 20px;display:inline-block}.hn-chip .hn-ready-icon{width:18px!important;height:18px!important;max-width:18px!important;max-height:18px!important;flex-basis:18px}.hn-ready-name .hn-ready-icon{width:20px!important;height:20px!important;max-width:20px!important;max-height:20px!important}"]),
      h("style", ["@media(max-width:620px){.hn-ready-item{grid-template-columns:28px minmax(0,1fr)!important;gap:8px 10px;align-items:start;padding:9px 10px}.hn-ready-name{min-width:0}.hn-ready-desc{grid-column:2;white-space:normal;word-break:normal;overflow-wrap:normal;line-height:1.35}.hn-ready-items{max-height:420px}.hn-ready-footer{align-items:flex-start}.hn-ready-footer .hn-btn{flex:0 0 auto}}"]),
      h("style", [".hn-form-row{--hn-form-label-width:260px;--hn-form-gap:24px}.hn-value{white-space:nowrap}.hn-form-row:has(.hn-ready) .hn-ready{width:100%;max-width:none}.hn-form-row:has(.hn-ready) .hn-ready-panel{margin-left:calc((var(--hn-form-label-width) + var(--hn-form-gap))*-1);width:calc(100% + var(--hn-form-label-width) + var(--hn-form-gap))}.hn-textarea{width:100%;max-width:none;min-height:118px}.hn-caret{position:absolute;right:13px;top:50%;width:18px;height:18px;margin-top:-9px;color:var(--hn-text);opacity:.95;display:inline-flex;align-items:center;justify-content:center;transition:transform .16s ease,opacity .16s ease}.hn-caret:before{content:\"\";width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin-top:-3px}.hn-caret.open{transform:rotate(180deg)}.hn-ready-summary:hover .hn-caret{opacity:1;color:var(--hn-primary-2)}@media(max-width:980px){.hn-form-row:has(.hn-ready) .hn-ready-panel{margin-left:0;width:100%}}"]),
      h("style", [".hn-ready-summary{position:relative}.hn-ready-summary .hn-caret{top:50%;right:13px;margin-top:-9px}.hn-ready-summary.hn-combo-summary .hn-caret{right:13px}"]),
      h("style", [".hn-form-row:has(.hn-ready-proxy) .hn-ready-proxy{width:min(100%,560px)!important;max-width:560px!important}.hn-form-row:has(.hn-ready-proxy) .hn-ready-proxy .hn-ready-panel{margin-left:0!important;width:100%!important;box-sizing:border-box}@media(max-width:980px){.hn-form-row:has(.hn-ready-proxy) .hn-ready-proxy{width:100%!important;max-width:none!important}}"]),
      h("style", [".hn-head{grid-template-columns:minmax(0,1fr) minmax(420px,520px);align-items:start}.hn-head-main{min-width:0}.hn-head-side{display:flex;flex-direction:column;gap:10px;min-width:0}.hn-head-sub{align-self:stretch;border:1px solid rgba(52,201,255,.22);background:linear-gradient(90deg,rgba(52,201,255,.08),rgba(52,201,255,.02));border-radius:8px;padding:12px 14px;box-shadow:0 10px 28px rgba(0,0,0,.08)}.hn-head-sub-title{display:flex;align-items:center;gap:8px;margin-bottom:9px;font-weight:800}.hn-head-sub-title span:first-child{color:var(--hn-primary-2);text-transform:uppercase;font-size:12px;letter-spacing:.04em}.hn-head-sub-main{display:flex;gap:8px;flex-wrap:wrap;align-items:center;color:var(--hn-text);font-weight:700}.hn-head-sub-main .hn-pill{min-height:24px;padding:1px 9px}.hn-head-sub-line{margin-top:8px;color:var(--hn-soft);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-grid{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:1050px){.hn-head{grid-template-columns:1fr}.hn-head-sub{width:auto}.hn-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.hn-grid{grid-template-columns:1fr}.hn-head-sub-line{white-space:normal}}"]),
      h("style", [".hn-head-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}.hn-mini-stat{min-height:34px;display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-card);padding:7px 11px;box-shadow:0 8px 20px rgba(0,0,0,.06)}.hn-mini-label{font-size:12px;color:var(--hn-soft)}.hn-mini-value{font-size:14px;font-weight:800;color:var(--hn-text);white-space:nowrap}.hn-mini-stat .hn-badge{min-height:22px;padding:1px 8px}.hn-mini-version{flex:0 0 55%;font-size:18px;text-align:center}@media(max-width:560px){.hn-head-stats{grid-template-columns:1fr}.hn-mini-stat{justify-content:space-between}.hn-mini-version{flex:0 0 auto;margin-left:auto;text-align:right}}"]),
      h("style", [".hn-head-sub{position:relative;padding-right:108px}.hn-head-sub-actions{position:absolute;right:10px;top:10px;display:flex;align-items:center;gap:6px}.hn-sub-refresh{width:30px;height:30px;border-radius:8px;border:1px solid rgba(52,201,255,.28);background:rgba(12,18,28,.36);color:var(--hn-primary-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.hn-sub-refresh:hover:not(:disabled){border-color:var(--hn-primary-2);background:rgba(52,201,255,.12)}.hn-sub-refresh:disabled{opacity:.7;cursor:not-allowed}.hn-refresh-svg{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center}.hn-refresh-svg svg{width:18px;height:18px;display:block}.hn-refresh-svg path{fill:none;stroke:currentColor;stroke-width:2.35;stroke-linecap:round;stroke-linejoin:round}.hn-sub-refresh:hover .hn-refresh-svg{transform:rotate(20deg);transition:transform .16s ease}.hn-sub-refresh.loading{border-color:rgba(19,199,130,.55);color:#13c782;background:rgba(19,199,130,.08)}"]),
      h("style", [".hn-btn-loading{display:inline-flex;align-items:center;justify-content:center;gap:8px}.hn-btn-spinner{width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:currentColor;animation:hn-spin .75s linear infinite;flex:0 0 auto}"]),
      h("style", [".hn-ping-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:128px}.hn-ping-btn.loading{border-color:rgba(19,199,130,.62);color:#13c782;background:rgba(19,199,130,.08)}.hn-ping-loader{width:14px;height:14px;border-radius:50%;border:2px solid rgba(19,199,130,.26);border-top-color:#13c782;animation:hn-spin .75s linear infinite}.hn-latency-loading,.hn-latency-ready,.hn-latency-wait,.hn-latency-value{display:inline-flex;align-items:center;justify-content:flex-end;gap:6px;min-width:54px;font-size:12px;font-weight:800}.hn-latency-loading,.hn-latency-ready,.hn-latency-value{color:#13c782}.hn-latency-wait{color:var(--hn-soft);opacity:.7}.hn-latency-dot{width:10px;height:10px;border-radius:50%;border:2px solid rgba(19,199,130,.24);border-top-color:#13c782;animation:hn-spin .75s linear infinite}@keyframes hn-spin{to{transform:rotate(360deg)}}"]),
      h("style", [".hn-notice{position:fixed;right:22px;top:78px;z-index:2600;min-width:280px;max-width:min(420px,calc(100vw - 44px));margin:0!important;padding:12px 12px 12px 14px!important;border-radius:8px!important;border:1px solid rgba(19,199,130,.34)!important;background:rgba(23,48,37,.96)!important;color:#22d08e!important;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 16px 45px rgba(0,0,0,.34);animation:hn-toast-in .18s ease-out both}.hn-notice:before{content:\"\";width:7px;height:7px;border-radius:50%;background:#16c784;box-shadow:0 0 0 4px rgba(22,199,132,.12);flex:0 0 auto}.hn-notice>span:first-child{min-width:0;line-height:1.35}.hn-notice-timer{position:relative;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 0 0 1px rgba(19,199,130,.14)}.hn-notice-timer:before{content:\"\";position:absolute;inset:2px;border-radius:50%;background:#0d2319;box-shadow:inset 0 0 0 1px rgba(19,199,130,.14)}.hn-notice-timer-text{position:relative;z-index:1;color:#d9fff0;font-size:10px;font-weight:500;line-height:1}@keyframes hn-toast-in{from{opacity:0;transform:translateX(14px) translateY(-4px)}to{opacity:1;transform:translateX(0) translateY(0)}}@media(max-width:700px){.hn-notice{left:14px;right:14px;top:72px;max-width:none;min-width:0}}"]),
      h("style", [".hn-combo{position:relative;width:min(100%,560px)}.hn-combo .hn-input{width:100%;max-width:none;padding-right:44px}.hn-combo-toggle{position:absolute;right:0;top:0;width:40px;height:38px;border:0;border-left:1px solid var(--hn-border);border-radius:0 6px 6px 0;background:transparent;color:var(--hn-text);cursor:pointer;display:flex;align-items:center;justify-content:center}.hn-combo-toggle:hover{background:rgba(120,130,150,.08)}.hn-combo-toggle .hn-caret{position:static;right:auto;top:auto;margin-top:0;width:18px;height:18px}.hn-combo-toggle .hn-caret:before{width:7px;height:7px}.hn-combo.open .hn-input{border-color:var(--hn-primary-2);box-shadow:0 0 0 2px rgba(52,201,255,.12)}.hn-combo-panel{position:absolute;left:0;right:0;top:43px;z-index:20;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-card);box-shadow:0 18px 46px rgba(0,0,0,.35);overflow:hidden}.hn-combo-item{width:100%;min-height:38px;border:0;border-bottom:1px solid var(--hn-line);background:transparent;color:var(--hn-text);display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;align-items:center;text-align:left;padding:8px 12px;cursor:pointer}.hn-combo-item:last-child{border-bottom:0}.hn-combo-item:hover,.hn-combo-item.active{background:rgba(52,201,255,.14)}.hn-combo-item.muted{display:none}.hn-combo-value{font-weight:800}.hn-combo-label{color:var(--hn-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-theme-light .hn-combo-panel{box-shadow:0 18px 46px rgba(20,30,50,.18)}@media(max-width:560px){.hn-combo-item{grid-template-columns:1fr;gap:2px}}"]),
      h("style", [".hn-multi .hn-ready-summary{width:100%;max-width:none;min-height:38px}.hn-multi .hn-combo-panel{top:45px}.hn-multi .hn-combo-item{grid-template-columns:28px minmax(0,1fr)}.hn-multi .hn-combo-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-settings-nested{margin-top:8px}.hn-settings-nested .hn-combo{width:min(100%,560px)}"]),
      h("style", [".hn-option-summary{position:relative;text-align:left;display:flex;align-items:center;min-height:38px;padding:0 44px 0 10px;cursor:pointer}.hn-option-summary:after{content:\"\";position:absolute;right:39px;top:0;bottom:0;width:1px;background:var(--hn-border)}.hn-option-summary .hn-caret{right:11px;top:50%;margin-top:-9px}.hn-option-text{display:block;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-option .hn-combo-panel{top:43px}.hn-option .hn-combo-item{grid-template-columns:minmax(0,1fr)}.hn-option .hn-combo-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"]),
      h("style", [".hn-select{appearance:none;-webkit-appearance:none;padding-right:44px;background-image:linear-gradient(to right,transparent calc(100% - 40px),var(--hn-border) calc(100% - 40px),var(--hn-border) calc(100% - 39px),transparent calc(100% - 39px)),url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath d='M3 5l4 4 4-4' fill='none' stroke='%23f2f6ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 0 top 0,right 13px center;background-size:40px 100%,14px 14px;background-repeat:no-repeat}.hn-theme-light .hn-select{background-image:linear-gradient(to right,transparent calc(100% - 40px),var(--hn-border) calc(100% - 40px),var(--hn-border) calc(100% - 39px),transparent calc(100% - 39px)),url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3E%3Cpath d='M3 5l4 4 4-4' fill='none' stroke='%230b1324' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")}.hn-select::-ms-expand{display:none}.hn-multi .hn-ready-summary{height:38px;min-height:38px;padding:0 44px 0 8px;flex-wrap:nowrap;position:relative}.hn-multi .hn-ready-summary:after{content:\"\";position:absolute;right:39px;top:0;bottom:0;width:1px;background:var(--hn-border)}.hn-multi .hn-ready-summary .hn-caret{right:11px;top:50%;width:18px;height:18px;margin-top:-9px}.hn-multi .hn-ready-summary .hn-caret:before{width:7px;height:7px}.hn-multi .hn-chip{max-width:calc(100% - 4px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"]),
      h("style", [".hn-connections{overflow:hidden}.hn-conn-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) 240px auto;gap:10px;align-items:center;margin-bottom:10px}.hn-conn-filters{display:flex;gap:8px;flex-wrap:wrap}.hn-conn-filter{height:34px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--hn-text);cursor:pointer;font-weight:400}.hn-conn-filter.active{background:rgba(52,201,255,.13);color:var(--hn-primary-2);font-weight:400}.hn-conn-search-wrap{height:34px;width:240px;position:relative;display:block}.hn-search-icon{position:absolute;left:11px;top:50%;width:13px;height:13px;margin-top:-7px;border:2px solid var(--hn-soft);border-radius:50%;opacity:.9;pointer-events:none}.hn-search-icon:after{content:\"\";position:absolute;width:6px;height:2px;right:-5px;bottom:-3px;background:var(--hn-soft);border-radius:2px;transform:rotate(45deg)}.hn-conn-search{width:100%;max-width:none;height:34px;border-radius:999px;padding-left:34px;background:rgba(19,22,30,.72)}.hn-conn-search::-webkit-search-cancel-button{filter:invert(1);opacity:.6}.hn-danger{border-color:rgba(255,92,104,.58)!important;color:#ff6d7a!important;position:relative}.hn-danger:before,.hn-danger:after{content:\"\";position:absolute;left:50%;top:50%;width:12px;height:1.6px;border-radius:2px;background:currentColor;transform-origin:center}.hn-danger:before{transform:translate(-50%,-50%) rotate(45deg)}.hn-danger:after{transform:translate(-50%,-50%) rotate(-45deg)}.hn-danger:hover:not(:disabled){background:rgba(255,92,104,.11)!important;border-color:#ff6d7a!important;color:#ff7f8a!important}.hn-danger:disabled{opacity:.45}.hn-conn-totals{display:flex;gap:14px;color:var(--hn-soft);font-size:12px;margin:0 0 10px}.hn-conn-table-wrap{overflow:auto;max-height:560px;border-top:1px solid var(--hn-line)}.hn-conn-table{width:100%;border-collapse:collapse;min-width:980px}.hn-conn-table th,.hn-conn-table td{padding:8px 8px;border-bottom:1px solid var(--hn-line);text-align:left;vertical-align:top;color:var(--hn-text);font-size:13px}.hn-conn-table th{position:sticky;top:0;background:var(--hn-card);z-index:1;color:var(--hn-soft);font-weight:800}.hn-conn-host{max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-route-proxy{font-weight:800;color:#9bc7ff!important}.hn-route-direct{font-weight:800;color:#f3c65b!important}.hn-service{display:inline-block;color:#13b675;font-weight:800;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-theme-light .hn-conn-filter.active{background:#e8f7ff}.hn-theme-light .hn-conn-search{background:#eef2f8}.hn-theme-light .hn-conn-table th{background:var(--hn-card)}@media(max-width:980px){.hn-conn-toolbar{grid-template-columns:1fr}.hn-conn-search-wrap{width:min(100%,260px)}.hn-conn-table-wrap{max-height:none}}"]),
      h("style", [".hn-conn-table th:nth-child(7),.hn-conn-table td:nth-child(7){width:74px!important}.hn-row-actions{display:flex!important;gap:6px;align-items:center;justify-content:flex-end;white-space:nowrap}.hn-row-actions .hn-icon-btn{flex:0 0 32px}.hn-copy-host{color:var(--hn-primary-2);font-size:17px;line-height:1}.hn-copy-host:hover{border-color:var(--hn-primary-2);background:rgba(52,201,255,.1)}@media(max-width:760px){.hn-conn-table tr{padding-right:82px!important}.hn-conn-table td:nth-child(7){right:8px!important;width:70px!important;margin-top:-16px!important}}"]),
      h("style", [".hn-devices{overflow:visible}.hn-devices-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.hn-devices-filters{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 12px}.hn-device-filter{height:34px;display:inline-flex;align-items:center;gap:7px;padding:0 11px;border-radius:7px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer}.hn-device-filter.active{border-color:var(--hn-primary-2);background:rgba(52,201,255,.13);color:var(--hn-primary-2)}.hn-filter-count{min-width:17px;height:17px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(120,130,150,.18);border:1px solid rgba(140,155,184,.24);font-size:11px}.hn-devices-table-wrap{overflow:visible;border-top:1px solid var(--hn-line)}.hn-devices-table{width:100%;min-width:920px;border-collapse:collapse;table-layout:fixed}.hn-devices-table th,.hn-devices-table td{padding:8px 10px;border-bottom:1px solid var(--hn-line);text-align:left;vertical-align:middle}.hn-devices-table th{color:var(--hn-soft);font-size:12px;font-weight:800}.hn-devices-table th:nth-child(1),.hn-devices-table td:nth-child(1){width:32%}.hn-devices-table th:nth-child(2),.hn-devices-table td:nth-child(2){width:18%}.hn-devices-table th:nth-child(3),.hn-devices-table td:nth-child(3){width:18%}.hn-devices-table th:nth-child(4),.hn-devices-table td:nth-child(4){width:32%}.hn-device-name{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-device-status{display:inline-flex;align-items:center;gap:6px;font-weight:800}.hn-device-status:before{content:\"\";width:7px;height:7px;border-radius:50%;background:currentColor}.hn-device-status.online{color:#13b675}.hn-device-status.offline{color:#e04f5f}.hn-device-select{width:100%;max-width:220px}.hn-device-select.pending .hn-option-summary{border-color:var(--hn-primary-2);box-shadow:0 0 0 2px rgba(52,201,255,.13)}.hn-devices .hn-combo{z-index:40}.hn-devices .hn-combo.open{z-index:280}.hn-devices .hn-combo-panel{min-width:100%;width:max-content;max-width:360px;z-index:300}.hn-devices .hn-combo-item{grid-template-columns:minmax(0,1fr);white-space:nowrap}@media(max-width:760px){.hn-devices-head{align-items:flex-start;flex-direction:column}.hn-devices-table,.hn-devices-table tbody,.hn-devices-table tr,.hn-devices-table td{display:block;width:100%!important;box-sizing:border-box}.hn-devices-table{min-width:0}.hn-devices-table thead{display:none}.hn-devices-table tr{margin-bottom:10px;padding:10px;border:1px solid var(--hn-line);border-radius:8px;background:var(--hn-card-strong)}.hn-devices-table td{border:0!important;padding:4px 0}.hn-devices .hn-combo-panel{width:100%;max-width:none;top:43px;bottom:auto}}"]),
      h("style", [".hn-dashboard{padding:14px 14px 20px}.hn-dashboard-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--hn-line);padding-bottom:10px;margin-bottom:12px}.hn-sub-card{border:1px solid rgba(52,201,255,.35);background:linear-gradient(90deg,rgba(52,201,255,.12),rgba(52,201,255,.03));border-radius:8px;padding:16px;margin-bottom:22px}.hn-sub-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.hn-sub-label{text-transform:uppercase;letter-spacing:.03em;color:var(--hn-primary-2);font-weight:800}.hn-pill{display:inline-flex;align-items:center;min-height:28px;padding:2px 12px;border-radius:999px;border:1px solid var(--hn-border);background:rgba(120,130,150,.12);color:var(--hn-soft);font-size:12px}.hn-sub-announce{display:flex;gap:10px;flex-wrap:wrap;border:1px solid var(--hn-line);border-radius:8px;background:rgba(0,0,0,.12);padding:8px 10px;font-weight:700}.hn-outbounds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.hn-outbound{min-height:70px;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-card-strong);padding:12px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;color:var(--hn-text);cursor:pointer}.hn-outbound:disabled{opacity:.72;cursor:not-allowed}.hn-outbound:not(.active):hover{border-color:var(--hn-primary-2);background:color-mix(in srgb,var(--hn-primary-2) 8%,var(--hn-card-strong))}.hn-outbound.active{border-color:#00b978;box-shadow:0 0 0 1px #00b978 inset;background:linear-gradient(180deg,rgba(0,185,120,.13),var(--hn-card-strong))}.hn-outbound-name{font-weight:800;color:var(--hn-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-outbound-meta{display:flex;justify-content:space-between;gap:12px;color:var(--hn-primary-2)}@media(max-width:1100px){.hn-outbounds{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.hn-dashboard-head{align-items:flex-start;flex-direction:column}.hn-outbounds{grid-template-columns:1fr}.hn-sub-announce{display:grid;grid-template-columns:1fr}}"]),
      h("style", [".hn-flag-img{width:21px;height:14px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.18);vertical-align:-2px;flex:0 0 auto}.hn-outbound-name{display:flex;align-items:center;gap:8px;min-width:0}.hn-outbound-name span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hn-outbounds{grid-template-columns:repeat(3,minmax(220px,1fr))}.hn-outbound{min-height:78px}.hn-route-cell{display:flex;align-items:flex-start;gap:8px;min-width:190px;max-width:230px;line-height:1.25}.hn-route-cell span{white-space:normal;word-break:normal}.hn-conn-table{min-width:1180px;table-layout:fixed}.hn-conn-table th:nth-child(1),.hn-conn-table td:nth-child(1){width:170px}.hn-conn-table th:nth-child(2),.hn-conn-table td:nth-child(2){width:56px}.hn-conn-table th:nth-child(3),.hn-conn-table td:nth-child(3){width:220px}.hn-conn-table th:nth-child(4),.hn-conn-table td:nth-child(4){width:80px}.hn-conn-table th:nth-child(5),.hn-conn-table td:nth-child(5),.hn-conn-table th:nth-child(6),.hn-conn-table td:nth-child(6){width:105px}.hn-conn-table th:nth-child(7),.hn-conn-table td:nth-child(7){width:180px}.hn-conn-table th:nth-child(8),.hn-conn-table td:nth-child(8){width:150px}.hn-conn-table th:nth-child(9),.hn-conn-table td:nth-child(9){width:48px}.hn-service{max-width:170px;white-space:normal;overflow-wrap:anywhere;line-height:1.25}.hn-conn-table td:nth-child(8){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-conn-host{max-width:160px}@media(max-width:1100px){.hn-outbounds{grid-template-columns:repeat(2,minmax(220px,1fr))}}@media(max-width:620px){.hn-outbounds{grid-template-columns:1fr}}"]),
      h("style", [".hn-conn-table-wrap{overflow-y:auto;overflow-x:hidden}.hn-conn-table{min-width:0!important;width:100%;table-layout:fixed}.hn-conn-table th,.hn-conn-table td{padding:8px 7px}.hn-conn-table th:nth-child(1),.hn-conn-table td:nth-child(1){width:22%}.hn-conn-table th:nth-child(2),.hn-conn-table td:nth-child(2){width:210px}.hn-conn-table th:nth-child(3),.hn-conn-table td:nth-child(3){width:74px}.hn-conn-table th:nth-child(4),.hn-conn-table td:nth-child(4){width:118px}.hn-conn-table th:nth-child(5),.hn-conn-table td:nth-child(5){width:20%}.hn-conn-table th:nth-child(6),.hn-conn-table td:nth-child(6){width:120px}.hn-conn-table th:nth-child(7),.hn-conn-table td:nth-child(7){width:42px}.hn-cell-main,.hn-conn-host{min-width:0;max-width:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-cell-sub{margin-top:2px;color:var(--hn-soft);font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-route-cell{min-width:0;max-width:none;align-items:flex-start}.hn-route-cell span{min-width:0;display:block;white-space:normal;word-break:normal;overflow-wrap:normal;hyphens:none}.hn-traffic-cell{white-space:nowrap;color:var(--hn-text);line-height:1.55}.hn-service-cell{min-width:0}.hn-service{display:block;max-width:none;color:#13c782;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25}.hn-conn-table td:nth-child(6){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:900px){.hn-conn-table th:nth-child(1),.hn-conn-table td:nth-child(1){width:26%}.hn-conn-table th:nth-child(2),.hn-conn-table td:nth-child(2){width:180px}.hn-conn-table th:nth-child(5),.hn-conn-table td:nth-child(5){width:19%}.hn-conn-table th:nth-child(6),.hn-conn-table td:nth-child(6){width:105px}}"]),
      h("style", ["@media(max-width:760px){.hn-conn-toolbar{display:grid;grid-template-columns:1fr 44px;gap:10px}.hn-conn-filters,.hn-conn-search-wrap{grid-column:1/-1;width:100%;max-width:none}.hn-conn-toolbar>.hn-btn{grid-column:1/2;width:100%}.hn-conn-toolbar>.hn-icon-btn{grid-column:2/3}.hn-conn-table-wrap{max-height:none;border-top:0}.hn-conn-table,.hn-conn-table tbody,.hn-conn-table tr,.hn-conn-table td{display:block;width:100%!important;box-sizing:border-box}.hn-conn-table thead{display:none}.hn-conn-table tr{position:relative;margin:0 0 10px;padding:10px 44px 10px 10px;border:1px solid var(--hn-line);border-radius:8px;background:var(--hn-card-strong)}.hn-conn-table td{border:0!important;padding:2px 0!important}.hn-conn-table td:nth-child(2){margin-top:8px}.hn-conn-table td:nth-child(3),.hn-conn-table td:nth-child(4),.hn-conn-table td:nth-child(6){display:inline-block;width:auto!important;margin-right:14px;vertical-align:top}.hn-conn-table td:nth-child(7){position:absolute;right:9px;top:50%;width:32px!important;margin-top:-16px}.hn-route-cell{display:flex!important;max-width:none;white-space:normal}.hn-route-cell span{overflow-wrap:normal;word-break:normal;white-space:normal}.hn-service{white-space:normal}.hn-cell-main{font-weight:800}.hn-cell-sub{white-space:normal}.hn-traffic-cell{font-size:12px}.hn-conn-table .hn-icon-btn{width:30px;height:30px}}"]),
      h("style", [".hn-conn-table th:nth-child(7),.hn-conn-table td:nth-child(7){width:74px!important}.hn-row-actions{display:flex!important;gap:6px;align-items:center;justify-content:flex-end;white-space:nowrap}.hn-row-actions .hn-icon-btn{flex:0 0 32px}@media(max-width:760px){.hn-conn-table tr{padding-right:82px!important}.hn-conn-table td:nth-child(7){display:flex!important;right:8px!important;width:70px!important;margin-top:-16px!important}.hn-row-actions .hn-icon-btn{flex-basis:30px}}"]),
      h("style", ["@media(max-width:1100px){.hn-conn-toolbar{display:grid;grid-template-columns:1fr 44px;gap:10px}.hn-conn-filters,.hn-conn-search-wrap{grid-column:1/-1;width:100%;max-width:none}.hn-conn-toolbar>.hn-btn{grid-column:1/2;width:100%}.hn-conn-toolbar>.hn-icon-btn{grid-column:2/3}.hn-conn-table-wrap{max-height:none;border-top:0}.hn-conn-table,.hn-conn-table tbody,.hn-conn-table tr,.hn-conn-table td{display:block;width:100%!important;box-sizing:border-box}.hn-conn-table thead{display:none}.hn-conn-table tr{position:relative;margin:0 0 10px;padding:10px 82px 10px 10px!important;border:1px solid var(--hn-line);border-radius:8px;background:var(--hn-card-strong)}.hn-conn-table td{border:0!important;padding:2px 0!important}.hn-conn-table td:nth-child(2){margin-top:8px}.hn-conn-table td:nth-child(3),.hn-conn-table td:nth-child(4),.hn-conn-table td:nth-child(6){display:inline-block;width:auto!important;margin-right:14px;vertical-align:top}.hn-conn-table td:nth-child(7){position:absolute;display:flex!important;right:8px!important;top:50%;width:70px!important;margin-top:-16px!important}.hn-route-cell{display:flex!important;max-width:none;white-space:normal}.hn-route-cell span{overflow-wrap:normal;word-break:normal;white-space:normal}.hn-service{white-space:normal}.hn-cell-main{font-weight:800}.hn-cell-sub{white-space:normal}.hn-traffic-cell{font-size:12px}.hn-conn-table .hn-icon-btn{width:30px;height:30px}.hn-row-actions .hn-icon-btn{flex-basis:30px}}"]),
      h("style", [".hn-mihomo-open{height:30px;padding:0 9px;border-radius:7px;border:1px solid rgba(52,201,255,.45);background:rgba(52,201,255,.08);color:var(--hn-primary-2);font-size:12px;font-weight:800;cursor:pointer}.hn-mihomo-open:hover{background:rgba(52,201,255,.16)}.hn-mihomo-modal{width:min(1040px,calc(100vw - 40px));max-height:calc(100vh - 42px);display:flex;flex-direction:column}.hn-mihomo-body{min-height:0;display:flex;flex-direction:column;gap:10px}.hn-mihomo-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.hn-mihomo-stats .hn-mini-stat{min-width:0}.hn-mihomo-overview{display:flex;flex-direction:column;gap:9px}.hn-mihomo-overview-box{padding:10px;border:1px solid var(--hn-border);border-radius:8px;background:rgba(127,127,127,.035)}.hn-mihomo-overview-title{margin-bottom:7px;font-weight:800}.hn-mihomo-tags{display:flex;flex-wrap:wrap;gap:6px}.hn-mihomo-tag{display:inline-flex;align-items:center;min-height:24px;padding:2px 9px;border:1px solid var(--hn-border);border-radius:999px;background:rgba(127,127,127,.06);font-size:12px;font-weight:700}.hn-mihomo-tag.group{border-color:rgba(52,201,255,.28);background:rgba(52,201,255,.07)}.hn-mihomo-toolbar{display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:8px}.hn-mihomo-sections{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px}.hn-mihomo-sections .hn-chip{border:1px solid var(--hn-border);cursor:pointer;white-space:nowrap}.hn-mihomo-sections .hn-chip.active{border-color:var(--hn-primary);color:var(--hn-primary-2)}.hn-mihomo-editor{min-height:250px;max-height:38vh;display:grid;grid-template-columns:auto minmax(0,1fr);overflow:auto;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-input);scrollbar-color:#596273 transparent}.hn-mihomo-editor::-webkit-scrollbar-corner{background:transparent}.hn-mihomo-editor::-webkit-scrollbar-button{display:none;width:0;height:0;background:transparent}.hn-mihomo-gutter{padding:12px 9px;text-align:right;color:var(--hn-muted);background:rgba(127,127,127,.08);font:12px/1.45 monospace;user-select:none}.hn-mihomo-pre{min-height:250px;margin:0;padding:12px;border:0;background:transparent;color:var(--hn-text);font-size:12px;line-height:1.45;white-space:pre;overflow:visible}.hn-mihomo-pre.wrap{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:760px){.hn-head-sub{padding-right:14px;padding-top:52px}.hn-head-sub-actions{left:12px;right:auto}.hn-mihomo-modal{width:calc(100vw - 18px);max-height:calc(100vh - 18px);padding:14px}.hn-mihomo-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hn-mihomo-toolbar{grid-template-columns:1fr}.hn-mihomo-editor{max-height:42vh}}"]),
      h("style", [".hn-mihomo-modal{box-sizing:border-box;height:min(900px,calc(100vh - 42px));overflow:hidden}.hn-mihomo-body{flex:1 1 auto;overflow:hidden}.hn-mihomo-stats .hn-mini-value{display:block;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hn-mihomo-toolbar{grid-template-columns:minmax(0,1fr)}.hn-mihomo-toolbar .hn-input{width:100%;max-width:none}.hn-mihomo-overview{flex:0 1 auto;max-height:220px;overflow:auto}.hn-mihomo-editor{flex:1 1 260px;min-height:150px;max-height:none}.hn-mihomo-modal>.hn-modal-actions{flex:0 0 auto;margin-top:10px;padding-top:10px;border-top:1px solid var(--hn-line);background:var(--hn-card)}@media(max-width:760px){.hn-modal-backdrop{padding:8px}.hn-mihomo-modal{width:calc(100vw - 16px);height:calc(100vh - 16px);max-height:none;padding:12px}.hn-mihomo-modal .hn-modal-head{margin-bottom:10px}.hn-mihomo-overview{max-height:180px}.hn-mihomo-editor{flex-basis:180px;min-height:120px}.hn-mihomo-modal>.hn-modal-actions{justify-content:flex-end;margin-top:8px;padding-top:8px}}@media(max-width:480px){.hn-mihomo-stats{grid-template-columns:1fr}.hn-mihomo-overview{max-height:145px}.hn-mihomo-gutter{padding-left:6px;padding-right:6px}.hn-mihomo-pre{padding:10px}}"]),
      h("div", { staticClass: "hn-head" }, [
        h("div", { staticClass: "hn-head-main" }, [
          h("div", { staticClass: "hn-title" }, "HarpyNet"),
          h("div", { staticClass: "hn-sub" }, "Управление Mihomo и маршрутизацией трафика"),
          h("div", { staticClass: "hn-actions hn-top-actions" }, [
            status.running ? self.button(h, "Остановить", "stop", false) : self.button(h, "Запустить", "start", true),
            self.button(h, "Перезапуск", "restart", false),
            status.init_enabled ? self.button(h, "Отключить автозапуск", "disable", false) : self.button(h, "Включить автозапуск", "enable", false)
          ])
        ]),
        h("div", { staticClass: "hn-head-side" }, [
          h("div", { staticClass: "hn-head-sub" }, [
            status.has_subscription ? h("div", { staticClass: "hn-head-sub-actions" }, [
              h("button", {
                staticClass: "hn-mihomo-open",
                attrs: { type: "button", title: "Mihomo config" },
                on: { click: self.openMihomoConfig }
              }, "Mihomo"),
              self.subscriptionUpdateButton(h)
            ]) : null,
            h("div", { staticClass: "hn-head-sub-title" }, [
              h("span", status.has_subscription ? "Подписка" : "Подписка не добавлена")
            ]),
            status.has_subscription ? h("div", { staticClass: "hn-head-sub-main" }, [
              h("span", "🧑 " + self.subscriptionOwner()),
              h("span", { staticClass: "hn-pill" }, "✅ " + self.subscriptionStatusRu()),
              h("span", { staticClass: "hn-pill" }, "⏳ " + self.subscriptionDaysLeft()),
              h("span", { staticClass: "hn-pill" }, "📊 " + self.subscriptionTraffic())
            ]) : h("div", { staticClass: "hn-head-sub-main" }, [
              self.actionButton(h, "Добавить", self.openSubscriptionModal, true, false)
            ]),
            status.has_subscription && self.subscriptionExpireText() ? h("div", { staticClass: "hn-head-sub-line" }, "Истекает " + self.subscriptionExpireText()) : null
          ]),
          h("div", { staticClass: "hn-head-stats" }, [
            h("div", { staticClass: "hn-mini-stat" }, [
              h("span", { staticClass: "hn-mini-label" }, "Сервис"),
              h("span", { staticClass: "hn-mini-value" }, [self.badge(h, self.runningText, Boolean(status.running))])
            ]),
            h("div", { staticClass: "hn-mini-stat" }, [
              h("span", { staticClass: "hn-mini-label" }, "Автозапуск"),
              h("span", { staticClass: "hn-mini-value" }, [self.badge(h, self.enabledText, Boolean(status.init_enabled))])
            ]),
            h("div", { staticClass: "hn-mini-stat" }, [
              h("span", { staticClass: "hn-mini-label" }, "Версия"),
              h("span", { staticClass: "hn-mini-value hn-mini-version" }, status.version || "N/A")
            ])
          ])
        ])
      ]),
      self.error ? h("div", { staticClass: "hn-error" }, self.error) : null,
      self.notice ? h("div", { staticClass: "hn-notice" }, [
        h("span", self.notice),
        h("span", {
          staticClass: "hn-notice-timer",
          style: {
            background: "conic-gradient(from -90deg, #16c784 " + Math.max(0, self.noticeProgress) + "%, rgba(22,153,94,.18) 0)"
          }
        }, [h("span", { staticClass: "hn-notice-timer-text" }, String(Math.max(1, self.noticeRemaining || 1)))])
      ]) : null,
      h("div", { staticClass: "hn-tab-nav" }, [
        h("button", {
          staticClass: "hn-tab-arrow",
          attrs: { type: "button", title: "Предыдущая вкладка" },
          on: { click: function () { self.selectAdjacentTab(tabs, -1); } }
        }, "‹"),
        h("div", { staticClass: "hn-tabs" }, tabs.map(function (tab) {
          return h("button", {
            key: tab.id,
            staticClass: self.activeTab === tab.id ? "hn-tab active" : "hn-tab",
            on: { click: function () { self.selectTab(tab.id); } }
          }, tab.label);
        })),
        h("button", {
          staticClass: "hn-tab-arrow",
          attrs: { type: "button", title: "Следующая вкладка" },
          on: { click: function () { self.selectAdjacentTab(tabs, 1); } }
        }, "›")
      ]),
      h("div", {
        key: "tab-page-" + self.activeTab + "-" + self.tabSlideDirection,
        staticClass: self.tabSlideDirection < 0 ? "hn-tab-page slide-prev" : "hn-tab-page slide-next"
      }, [
        self.activeTab === "sections" ? self.renderSections(h, status, subscriptionLabel, subscriptionButtonLabel) : null,
        self.activeTab === "proxy" ? self.renderProxy(h) : null,
        self.activeTab === "dashboard" ? self.renderDashboard(h) : null,
        self.activeTab === "settings" ? self.renderSettings(h) : null,
        self.activeTab === "devices" ? self.renderDevices(h) : null,
        self.activeTab === "connections" ? self.renderConnections(h) : null
      ]),
      self.renderSubscriptionModal(h),
      self.renderMihomoConfigModal(h)
    ]);
  }
})
