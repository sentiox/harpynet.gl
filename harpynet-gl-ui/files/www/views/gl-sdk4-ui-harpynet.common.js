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
      theme: "dark",
      formDirty: false,
      form: this.emptyForm(),
      subscriptionModalOpen: false,
      subscriptionUrl: "",
      subscriptionSaving: false,
      readyListsOpen: false,
      readyListSearch: "",
      connectionsLoading: false,
      connectionsError: "",
      connectionsSearch: "",
      connectionsMode: "active",
      connections: [],
      connectionsTotals: { upload: 0, download: 0 },
      dashboardLoading: false,
      dashboardError: "",
      dashboardLatencyLoading: false,
      outboundSwitching: "",
      dashboard: null,
      noticeTimer: null,
      noticeRemaining: 0,
      noticeProgress: 0,
      noticeFrame: null,
      timer: null,
      connectionsTimer: null,
      connectionsRefreshing: false
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
    this.refresh();
  },
  beforeDestroy: function () {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    if (this.noticeFrame) cancelAnimationFrame(this.noticeFrame);
    if (this.timer) clearInterval(this.timer);
    if (this.connectionsTimer) clearInterval(this.connectionsTimer);
  },
  methods: {
    emptyForm: function () {
      return {
        connection_type: "proxy",
        enable_udp_over_tcp: "0",
        upstream_proxy_enabled: "0",
        community_lists: "russia_inside",
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
      var bg = "rgb(30, 30, 30)";
      try {
        bg = getComputedStyle(document.body).backgroundColor || bg;
      } catch (_e) {}
      var match = String(bg).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return "dark";
      var r = Number(match[1]);
      var g = Number(match[2]);
      var b = Number(match[3]);
      return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "light" : "dark";
    },
    refresh: function () {
      var self = this;
      self.theme = self.detectTheme();
      self.loading = true;
      return self.callApi("summary").then(function (result) {
        self.status = self.normalizeStatus(result || {});
        if (!self.subscriptionModalOpen) {
          self.subscriptionUrl = self.status && self.status.subscription_url ? self.status.subscription_url : "";
        }
        if (!self.formDirty) {
          self.loadFormFromStatus();
        }
        if (self.activeTab === "connections") {
          self.updateConnectionsAutoRefresh();
          self.refreshConnections(true);
        }
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
      this.form = form;
    },
    t: function (ru, en) {
      var lang = (document.documentElement.getAttribute("lang") || navigator.language || "").toLowerCase();
      return lang.indexOf("ru") === 0 ? ru : en;
    },
    formValue: function (key, value) {
      this.form[key] = value;
      this.formDirty = true;
    },
    isChecked: function (key) {
      return this.form[key] === "1";
    },
    toggleFlag: function (key, checked) {
      this.formValue(key, checked ? "1" : "0");
    },
    selectedReadyLists: function () {
      return String(this.form.community_lists || "").split(/\s+/).map(function (item) { return item.trim(); }).filter(Boolean);
    },
    setSelectedReadyLists: function (values) {
      this.formValue("community_lists", values.join("\n"));
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
    saveMainConfig: function () {
      var self = this;
      self.actionLoading = "set_main_config";
      self.error = "";
      self.notice = "";
      return self.callApi("set_main_config", self.form).then(function (result) {
        if (result && result.ok === false) throw new Error(result.error || result.output || "Save failed");
        self.notice = "Настройки MAIN сохранены.";
        self.formDirty = false;
        return self.refresh();
      }).catch(function (err) {
        self.error = err && err.message ? err.message : String(err);
      }).finally(function () {
        if (self.actionLoading === "set_main_config") self.actionLoading = "";
      });
    },
    resetMainConfig: function () {
      this.formDirty = false;
      this.loadFormFromStatus();
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
      return "";
    },
    selectTab: function (id) {
      this.activeTab = id;
      this.updateConnectionsAutoRefresh();
      if (id === "connections") this.refreshConnections(false);
      if (id === "dashboard") this.refreshDashboard();
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
      self.dashboardLatencyLoading = true;
      self.dashboardError = "";
      self.notice = "";
      return self.callApi("test_latency").then(function (result) {
        if (result && result.ok === false) throw new Error(result.output || result.error || "Ping failed");
        return self.refreshDashboard();
      }).catch(function (err) {
        self.dashboardError = err && err.message ? err.message : String(err);
      }).finally(function () {
        self.dashboardLatencyLoading = false;
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
      var main = data.proxies && data.proxies["main-out"];
      if (!selected && main && main.now) selected = main.now;
      return selected || "";
    },
    outboundLatency: function (tag) {
      var proxy = this.dashboard && this.dashboard.proxies ? this.dashboard.proxies[tag] : null;
      var history = proxy && Array.isArray(proxy.history) ? proxy.history : [];
      for (var i = history.length - 1; i >= 0; i--) {
        var delay = Number(history[i] && history[i].delay);
        if (delay > 0) return delay + " ms";
      }
      return "N/A";
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
      var map = {
        "🇬🇧": "gb", "🇺🇸": "us", "🇪🇪": "ee", "🇸🇪": "se", "🇷🇺": "ru",
        "Великобритания": "gb", "США": "us", "Эстония": "ee", "Швеция": "se", "Россия": "ru"
      };
      var found = Object.keys(map).find(function (key) { return text.indexOf(key) !== -1; });
      if (found) return map[found];
      var prefix = text.match(/^([A-Z]{2})\s+/);
      return prefix ? prefix[1].toLowerCase() : "";
    },
    cleanCountryName: function (name) {
      return String(name || "").replace(/^[A-Z]{2}\s+/, "").replace(/^[🇦-🇿]{2}\s*/u, "").trim();
    },
    flagNode: function (h, name) {
      var code = this.countryCodeFromName(name);
      if (!code) return null;
      return h("img", {
        staticClass: "hn-flag-img",
        attrs: { src: "/harpynet/flags/" + code + ".png", alt: code.toUpperCase(), draggable: "false" }
      });
    },
    metadataLine: function (prefix) {
      var announce = this.dashboard && this.dashboard.metadata ? String(this.dashboard.metadata.announce || "") : "";
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
      var expire = this.dashboard && this.dashboard.metadata ? Number(this.dashboard.metadata.expire || 0) : 0;
      if (expire > 0) {
        var days = Math.max(0, Math.ceil((expire * 1000 - Date.now()) / 86400000));
        return days + " дней";
      }
      return "неизвестно";
    },
    subscriptionTraffic: function () {
      var line = this.metadataLine("Трафик:");
      if (line) return line.replace(/^📊\s*/, "");
      var traffic = this.dashboard && this.dashboard.metadata ? this.dashboard.metadata.traffic : null;
      return traffic ? this.prettyBytes(traffic.used || traffic.download || 0) : "0 B";
    },
    subscriptionTotalTraffic: function () {
      var traffic = this.dashboard && this.dashboard.metadata ? this.dashboard.metadata.traffic : null;
      if (!traffic) return "";
      if (traffic.isUnlimited) return this.prettyBytes(traffic.used || 0) + " / ∞";
      return this.prettyBytes(traffic.used || 0) + " / " + this.prettyBytes(traffic.total || 0);
    },
    subscriptionExpireText: function () {
      var expire = this.dashboard && this.dashboard.metadata ? Number(this.dashboard.metadata.expire || 0) : 0;
      if (!expire) return "";
      var date = new Date(expire * 1000);
      return date.toLocaleDateString("ru-RU") + " (" + this.subscriptionDaysLeft() + ")";
    },
    refreshConnections: function (silent) {
      var self = this;
      if (self.connectionsRefreshing) return Promise.resolve();
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
        self.connections = Array.isArray(payload.connections) ? payload.connections : [];
        self.connectionsTotals = {
          upload: Number(payload.uploadTotal || 0),
          download: Number(payload.downloadTotal || 0)
        };
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
      for (var i = chain.length - 1; i >= 0; i -= 1) {
        var item = String(chain[i] || "");
        if (item && item !== "DIRECT" && item !== "REJECT" && item.indexOf("out") === -1) return item;
      }
      if (chain.indexOf("DIRECT") !== -1) return "Без VPN";
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
        ["telegram|t\\.me", "Telegram"],
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
      if (meta.destinationIP && !meta.host) return { name: "Неизвестный IP", sub: "Домен не виден" };
      if (/inbound=tproxy/i.test(rule)) return { name: "Неизвестно", sub: "Сервис не распознан" };
      var cleaned = rule.replace(/^geosite:/i, "").replace(/^geoip:/i, "").replace(/^rule-set:/i, "");
      return cleaned ? { name: cleaned, sub: "правило маршрута" } : { name: "Неизвестный IP", sub: "Домен не виден" };
    },
    connectionSource: function (connection) {
      var meta = connection.metadata || {};
      return meta.sourceIP || meta.source || "-";
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
      var route = this.connectionRoute(connection);
      if (route === "Без VPN" || route === "DIRECT") return "direct";
      if (/reject|fail|timeout|сбой/i.test(route + " " + (connection.rule || ""))) return "failure";
      return "proxy";
    },
    filteredConnections: function () {
      var self = this;
      var query = String(self.connectionsSearch || "").toLowerCase();
      return self.connections.filter(function (connection) {
        var kind = self.connectionKind(connection);
        if (self.connectionsMode === "proxy" && kind !== "proxy") return false;
        if (self.connectionsMode === "direct" && kind !== "direct") return false;
        if (self.connectionsMode === "failure" && kind !== "failure") return false;
        if (self.connectionsMode === "closed") return false;
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
      var active = self.connections.length;
      var proxy = self.connections.filter(function (item) { return self.connectionKind(item) === "proxy"; }).length;
      var direct = self.connections.filter(function (item) { return self.connectionKind(item) === "direct"; }).length;
      var failure = self.connections.filter(function (item) { return self.connectionKind(item) === "failure"; }).length;
      var rows = self.filteredConnections();
      var filters = [
        ["active", "Активные " + active],
        ["proxy", "Прокси " + proxy],
        ["direct", "Без VPN " + direct],
        ["failure", "Сбой " + failure],
        ["closed", "Закрытые 0"]
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
        !self.connectionsLoading && !rows.length ? h("div", { staticClass: "hn-placeholder" }, self.connectionsMode === "closed" ? "Нет закрытых соединений" : "Нет активных соединений") : null,
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
              return h("tr", [
                h("td", { staticClass: "hn-conn-host" }, [
                  h("div", { staticClass: "hn-cell-main" }, hostInfo.title),
                  hostInfo.sub ? h("div", { staticClass: "hn-cell-sub" }, hostInfo.sub) : null
                ]),
                h("td", { staticClass: self.connectionKind(connection) === "direct" ? "hn-route-cell hn-route-direct" : "hn-route-cell hn-route-proxy" }, [
                  self.flagNode(h, self.connectionRoute(connection)),
                  h("span", self.cleanCountryName(self.connectionRoute(connection)))
                ]),
                h("td", self.connectionAge(connection)),
                h("td", { staticClass: "hn-traffic-cell" }, [
                  h("div", "↓ " + self.prettyBytes(connection.download)),
                  h("div", "↑ " + self.prettyBytes(connection.upload))
                ]),
                h("td", { staticClass: "hn-service-cell" }, [
                  h("div", { staticClass: "hn-service" }, serviceInfo.name),
                  h("div", { staticClass: "hn-cell-sub" }, serviceInfo.sub)
                ]),
                h("td", self.connectionSource(connection)),
                h("td", [
                  connection.id ? h("button", {
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
    badge: function (h, text, good) {
      return h("span", { staticClass: good ? "hn-badge hn-badge-ok" : "hn-badge" }, text);
    },
    button: function (h, label, method, primary) {
      var self = this;
      var busy = self.actionLoading === method;
      return h("button", {
        staticClass: primary ? "hn-btn hn-btn-primary" : "hn-btn",
        attrs: { disabled: Boolean(self.actionLoading || self.loading) },
        on: { click: function () { self.runAction(method); } }
      }, busy ? "..." : label);
    },
    actionButton: function (h, label, onClick, primary, busy) {
      return h("button", {
        staticClass: primary ? "hn-btn hn-btn-primary" : "hn-btn",
        attrs: { disabled: Boolean(this.actionLoading || this.loading || this.subscriptionSaving) },
        on: { click: onClick }
      }, busy ? "..." : label);
    },
    field: function (h, label, help, control) {
      return h("div", { staticClass: "hn-form-row" }, [
        h("div", { staticClass: "hn-form-label" }, label),
        h("div", [control, help ? h("div", { staticClass: "hn-help" }, help) : null])
      ]);
    },
    selectField: function (h, key, options) {
      var self = this;
      return h("select", {
        staticClass: "hn-select",
        domProps: { value: self.form[key] },
        on: { change: function (event) { self.formValue(key, event.target.value); } }
      }, options.map(function (item) {
        return h("option", { attrs: { value: item[0] } }, item[1]);
      }));
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
    textAreaField: function (h, key, placeholder, rows) {
      var self = this;
      return h("textarea", {
        staticClass: "hn-textarea",
        attrs: { rows: rows || 4, placeholder: placeholder || "" },
        domProps: { value: self.form[key] },
        on: { input: function (event) { self.formValue(key, event.target.value); } }
      });
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
      var title = (data.metadata && data.metadata.title) || "Harpy VPN";
      var selected = data.selected || "";
      var mainProxy = data.proxies && data.proxies["main-out"];
      if (!selected && mainProxy && mainProxy.now) selected = mainProxy.now;
      var visibleOutbounds = (data.outbounds || []).filter(function (outbound) {
        return !self.hiddenDashboardOutbound(outbound);
      });
      return h("div", { staticClass: "hn-card hn-section hn-dashboard" }, [
        h("div", { staticClass: "hn-dashboard-head" }, [
          h("div", { staticClass: "hn-section-title" }, "MAIN"),
          h("div", { staticClass: "hn-actions" }, [
            self.actionButton(h, "Проверить пинг", self.testLatency, false, self.dashboardLatencyLoading)
          ])
        ]),
        self.dashboardError ? h("div", { staticClass: "hn-error" }, self.dashboardError) : null,
        h("div", { staticClass: "hn-sub-card" }, [
          h("div", { staticClass: "hn-sub-top" }, [
            h("div", [h("span", { staticClass: "hn-sub-label" }, "Подписка:"), " ", h("strong", title)]),
            self.subscriptionTotalTraffic() ? h("span", { staticClass: "hn-pill" }, "Трафик " + self.subscriptionTotalTraffic()) : null,
            self.subscriptionExpireText() ? h("span", { staticClass: "hn-pill" }, "Истекает " + self.subscriptionExpireText()) : null
          ]),
          h("div", { staticClass: "hn-sub-announce" }, [
            h("span", "🧑 " + self.subscriptionOwner()),
            h("span", "📦 Подписка: ✅ " + self.subscriptionStatusRu()),
            h("span", "⏳ Осталось: " + self.subscriptionDaysLeft()),
            h("span", "📊 Трафик: " + self.subscriptionTraffic())
          ])
        ]),
        visibleOutbounds.length ? h("div", { staticClass: "hn-outbounds" }, visibleOutbounds.map(function (outbound) {
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
              h("span", self.outboundLatency(tag))
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
        ["dynamic", "Динамический список"],
        ["text", "Текстовый список"]
      ];

      return h("div", { staticClass: "hn-card hn-section" }, [
        h("div", { staticClass: "hn-section-title" }, "MAIN"),
        self.field(h, "Тип подключения", "Выберите: умный обход по спискам, полный VPN для всего внешнего трафика или пропуск напрямую", self.selectField(h, "connection_type", connectionOptions)),
        self.field(h, "Подписка", "Вставьте ссылку подписки HarpyNet и сохраните её на роутере.", h("div", { staticClass: "hn-inline" }, [
          self.actionButton(h, subscriptionButtonLabel, self.openSubscriptionModal, !status.has_subscription, false)
        ])),
        self.field(h, "UDP через TCP", "Применимо для SOCKS и Shadowsocks прокси", self.flagField(h, "enable_udp_over_tcp")),
        self.field(h, "Дополнительный маршрут через прокси", "Выбранные ниже сервисы и домены пойдут через отдельный SOCKS5, HTTP или HTTPS-прокси раньше основных правил VPN.", self.flagField(h, "upstream_proxy_enabled")),
        self.field(h, "Готовые списки", "Выберите готовые списки для маршрутизации доменов и IP github.com/sentiox/sentinel-lists", self.renderReadyLists(h)),
        self.field(h, "Тип пользовательского списка доменов", "Выберите тип списка для добавления пользовательских доменов", self.selectField(h, "user_domain_list_type", listTypeOptions)),
        self.form.user_domain_list_type === "text" ? self.field(h, "Список пользовательских доменов", "Введите доменные имена, разделяя их запятыми, пробелами или переносами строк. Вы можете добавлять комментарии, используя //", self.textAreaField(h, "user_domains_text", "example.com, sub.example.com\n// Social networks\ndomain.com test.com // personal domains", 6)) : null,
        self.field(h, "Тип пользовательского списка подсетей", "Выберите тип списка для добавления пользовательских подсетей", self.selectField(h, "user_subnet_list_type", listTypeOptions)),
        self.form.user_subnet_list_type === "text" ? self.field(h, "Список пользовательских подсетей", "Введите подсети или IP, разделяя их запятыми, пробелами или переносами строк.", self.textAreaField(h, "user_subnets_text", "192.168.1.2\n192.168.1.0/24", 4)) : null,
        self.field(h, "Локальные списки доменов", "Укажите путь к файлу списка, расположенному в файловой системе маршрутизатора.", self.textAreaField(h, "local_domain_lists", "/path/file.lst", 2)),
        self.field(h, "Локальные списки подсетей", "Укажите путь к файлу списка, расположенному в файловой системе маршрутизатора.", self.textAreaField(h, "local_subnet_lists", "/path/file.lst", 2)),
        self.field(h, "Внешние списки доменов", "Укажите URL-адреса для загрузки и использования списков доменов.", self.textAreaField(h, "remote_domain_lists", "https://example.com/domains.srs", 2)),
        self.field(h, "Внешние списки подсетей", "Укажите URL-адреса для загрузки и использования списков подсетей.", self.textAreaField(h, "remote_subnet_lists", "https://example.com/subnets.srs", 2)),
        self.field(h, "Полностью маршрутизированные IP-адреса", "Укажите локальные IP-адреса или подсети, трафик которых всегда будет направляться через настроенный маршрут.", self.textAreaField(h, "fully_routed_ips", "192.168.7.129\n192.168.1.2 or 192.168.1.0/24", 3)),
        self.field(h, "Включить смешанный прокси", "Включить смешанный прокси-сервер, разрешив этому разделу маршрутизировать трафик как через HTTP, так и через SOCKS-прокси.", self.flagField(h, "mixed_proxy_enabled")),
        self.form.mixed_proxy_enabled === "1" ? self.field(h, "Порт смешанного прокси", "Укажите свободный локальный порт.", self.inputField(h, "mixed_proxy_port", "2080")) : null,
        self.field(h, "Разрешение реальных IP-адресов", "Разрешать домены в реальные IP-адреса перед маршрутизацией в outbound", self.flagField(h, "resolve_real_ip_for_routing")),
        h("div", { staticClass: "hn-savebar" }, [
          h("span", { staticClass: "hn-muted" }, self.formDirty ? "Есть несохранённые изменения" : "Настройки синхронизированы"),
          h("div", { staticClass: "hn-actions" }, [
            self.actionButton(h, "Save & Apply", self.saveMainConfig, true, self.actionLoading === "set_main_config"),
            self.actionButton(h, "Reset", self.resetMainConfig, false, false)
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
      { id: "dashboard", label: "Дашборд" },
      { id: "settings", label: "Настройки" },
      { id: "devices", label: "Устройства" },
      { id: "connections", label: "Соединения" }
    ];
    return h("div", { staticClass: "harpynet-gl hn-theme-" + self.theme }, [
      h("style", [".harpynet-gl{--hn-bg:#202020;--hn-card:#2b2b2b;--hn-card-strong:#242424;--hn-text:#f2f6ff;--hn-soft:#9aa9ca;--hn-border:rgba(140,155,184,.28);--hn-line:rgba(140,155,184,.18);--hn-input:#181a1f;--hn-primary:#4d6bff;--hn-primary-2:#34c9ff;color:var(--hn-text);padding:14px 38px 70px 20px}.hn-theme-light{--hn-bg:#f4f6fb;--hn-card:#fff;--hn-card-strong:#f7f9fd;--hn-text:#172033;--hn-soft:#5f6f8f;--hn-border:#cfd7e6;--hn-line:#dfe5ef;--hn-input:#fff;--hn-primary:#315dff;--hn-primary-2:#048bc7}.hn-head{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin:6px 0 18px}.hn-title{font-size:28px;font-weight:800;line-height:1.15;color:var(--hn-text)}.hn-sub{color:var(--hn-soft);margin-top:6px}.hn-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.hn-top-actions{justify-content:flex-start;margin-top:2px}.hn-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.hn-tab{height:36px;padding:0 14px;border-radius:8px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer}.hn-tab.active{border-color:var(--hn-primary-2);background:rgba(52,201,255,.13);color:var(--hn-primary-2)}.hn-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.hn-card{background:var(--hn-card);border:1px solid var(--hn-border);border-radius:8px;padding:14px;box-shadow:0 10px 28px rgba(0,0,0,.08)}.hn-card-split{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}.hn-section{margin-top:12px}.hn-section-title{font-size:19px;font-weight:800;margin-bottom:12px;color:var(--hn-text)}.hn-label{font-size:12px;color:var(--hn-soft);margin-bottom:8px}.hn-value{font-size:18px;font-weight:800;word-break:break-word;color:var(--hn-text)}.hn-muted{color:var(--hn-soft)}.hn-help{color:var(--hn-soft);font-size:13px;margin-top:6px;line-height:1.35}.hn-badge{display:inline-flex;align-items:center;min-height:24px;padding:2px 9px;border-radius:999px;background:rgba(120,130,150,.14);color:var(--hn-text);font-size:12px;font-weight:700}.hn-badge-ok{background:rgba(22,199,132,.16);color:#159b67}.hn-btn{height:34px;padding:0 14px;border-radius:6px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer}.hn-btn:disabled{opacity:.55;cursor:not-allowed}.hn-btn-primary{background:var(--hn-primary);border-color:var(--hn-primary);color:#fff}.hn-error,.hn-notice{margin-bottom:14px;padding:10px 12px;border-radius:6px}.hn-error{border:1px solid rgba(216,54,68,.35);background:rgba(216,54,68,.12);color:#ff6d7a}.hn-notice{border:1px solid rgba(22,153,94,.28);background:rgba(22,153,94,.12);color:#159b67;display:flex;align-items:center;justify-content:space-between;gap:12px}.hn-notice-timer{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:#d9fff0;font-size:12px;font-weight:800;box-shadow:inset 0 0 0 3px rgba(15,32,25,.95)}.hn-form-row{display:grid;grid-template-columns:260px minmax(0,1fr);gap:24px;align-items:start;padding:16px 0;border-top:1px solid var(--hn-line)}.hn-form-row:first-of-type{border-top:0}.hn-form-label{font-weight:700;color:var(--hn-text);padding-top:8px}.hn-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hn-select,.hn-input,.hn-textarea{width:min(100%,560px);box-sizing:border-box;border-radius:6px;border:1px solid var(--hn-border);background:var(--hn-input);color:var(--hn-text);outline:none}.hn-select,.hn-input{height:38px;padding:0 10px}.hn-textarea{padding:10px;resize:vertical;line-height:1.4}.hn-select:focus,.hn-input:focus,.hn-textarea:focus{border-color:var(--hn-primary-2);box-shadow:0 0 0 2px rgba(52,201,255,.12)}.hn-switch{display:inline-flex;align-items:center;gap:8px;height:34px}.hn-switch input{display:none}.hn-switch span{width:42px;height:22px;border-radius:999px;border:1px solid var(--hn-border);background:rgba(120,130,150,.18);position:relative}.hn-switch span:before{content:\"\";position:absolute;width:16px;height:16px;left:3px;top:2px;border-radius:50%;background:var(--hn-soft);transition:.15s}.hn-switch input:checked+span{background:rgba(22,199,132,.22);border-color:#16c784}.hn-switch input:checked+span:before{left:21px;background:#16c784}.hn-ready{width:min(100%,760px);position:relative}.hn-ready-summary{min-height:42px;width:100%;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-input);color:var(--hn-text);display:flex;gap:7px;align-items:center;flex-wrap:wrap;padding:7px 36px 7px 8px;text-align:left;cursor:pointer}.hn-chip{display:inline-flex;align-items:center;gap:6px;min-height:26px;border-radius:6px;border:1px solid color-mix(in srgb,var(--hn-item-color,#34c9ff) 55%,transparent);background:color-mix(in srgb,var(--hn-item-color,#34c9ff) 16%,transparent);color:var(--hn-text);padding:2px 8px;font-weight:700;font-size:12px}.hn-chip-count{border-color:var(--hn-border);background:rgba(120,130,150,.12)}.hn-caret{position:absolute;right:13px;top:11px;color:var(--hn-soft)}.hn-ready-panel{margin-top:6px;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-card);overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.22);z-index:5}.hn-ready-search{width:100%;max-width:none;border-radius:0;border-width:0 0 1px 0}.hn-ready-items{max-height:360px;overflow:auto}.hn-ready-item{width:100%;display:grid;grid-template-columns:28px 210px minmax(0,1fr);gap:10px;align-items:center;border:0;border-left:3px solid transparent;border-bottom:1px solid var(--hn-line);background:transparent;color:var(--hn-text);padding:10px;text-align:left;cursor:pointer}.hn-ready-item.active{border-left-color:var(--hn-item-color,#34c9ff);background:color-mix(in srgb,var(--hn-item-color,#34c9ff) 24%,#15181d)}.hn-ready-item.disabled{opacity:.42;filter:saturate(.35);cursor:not-allowed;background:rgba(0,0,0,.12)}.hn-ready-item.disabled .hn-check{background:transparent;border-color:rgba(127,127,127,.35)}.hn-check{width:18px;height:18px;border:1px solid var(--hn-border);border-radius:3px;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:transparent}.hn-ready-item.active .hn-check{border-color:var(--hn-item-color,#34c9ff);background:var(--hn-item-color,#34c9ff)}.hn-ready-name{display:inline-flex;align-items:center;gap:9px;font-weight:800}.hn-ready-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;min-width:22px;border-radius:5px;object-fit:contain}.hn-ready-desc{color:var(--hn-soft);font-size:13px}.hn-ready-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px;color:var(--hn-soft)}.hn-savebar{position:sticky;bottom:0;margin:18px -14px -14px;padding:12px 14px;background:color-mix(in srgb,var(--hn-card) 92%,transparent);border-top:1px solid var(--hn-line);display:flex;justify-content:space-between;gap:12px;align-items:center;border-radius:0 0 8px 8px}.hn-log{white-space:pre-wrap;min-height:260px;max-height:420px;overflow:auto;font-family:Consolas,monospace;font-size:12px;line-height:1.45;color:var(--hn-text)}.hn-placeholder{color:var(--hn-soft);line-height:1.55}.hn-modal-backdrop{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.46);display:flex;align-items:center;justify-content:center;padding:20px}.hn-modal{width:min(640px,100%);background:var(--hn-card);border:1px solid var(--hn-border);border-radius:8px;padding:18px;box-shadow:0 18px 60px rgba(0,0,0,.38)}.hn-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.hn-modal-title{font-size:18px;font-weight:800}.hn-icon-btn{width:32px;height:32px;border-radius:6px;border:1px solid var(--hn-border);background:var(--hn-card-strong);color:var(--hn-text);cursor:pointer}.hn-field{display:block}.hn-field span{display:block;color:var(--hn-soft);font-size:12px;margin-bottom:8px}.hn-modal-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:16px}@media(max-width:980px){.harpynet-gl{padding-right:18px}.hn-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hn-form-row{grid-template-columns:1fr;gap:8px}.hn-form-label{padding-top:0}.hn-ready-item{grid-template-columns:28px minmax(0,1fr)}}@media(max-width:560px){.hn-grid{grid-template-columns:1fr}.hn-card-split{align-items:flex-start;flex-direction:column}.hn-modal-actions,.hn-savebar{justify-content:flex-start}.hn-savebar{position:static;flex-direction:column;align-items:flex-start}}"]),
      h("style", [".hn-form-row{--hn-form-label-width:260px;--hn-form-gap:24px}.hn-value{white-space:nowrap}.hn-form-row:has(.hn-ready) .hn-ready{width:100%;max-width:none}.hn-form-row:has(.hn-ready) .hn-ready-panel{margin-left:calc((var(--hn-form-label-width) + var(--hn-form-gap))*-1);width:calc(100% + var(--hn-form-label-width) + var(--hn-form-gap))}.hn-textarea{width:100%;max-width:none;min-height:118px}.hn-caret{position:absolute;right:13px;top:50%;width:18px;height:18px;margin-top:-9px;color:var(--hn-text);opacity:.95;display:inline-flex;align-items:center;justify-content:center;transition:transform .16s ease,opacity .16s ease}.hn-caret:before{content:\"\";width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);margin-top:-3px}.hn-caret.open{transform:rotate(180deg)}.hn-ready-summary:hover .hn-caret{opacity:1;color:var(--hn-primary-2)}@media(max-width:980px){.hn-form-row:has(.hn-ready) .hn-ready-panel{margin-left:0;width:100%}}"]),
      h("style", [".hn-connections{overflow:hidden}.hn-conn-toolbar{display:grid;grid-template-columns:minmax(260px,1fr) 240px auto;gap:10px;align-items:center;margin-bottom:10px}.hn-conn-filters{display:flex;gap:8px;flex-wrap:wrap}.hn-conn-filter{height:34px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:var(--hn-text);cursor:pointer;font-weight:400}.hn-conn-filter.active{background:rgba(52,201,255,.13);color:var(--hn-primary-2);font-weight:400}.hn-conn-search-wrap{height:34px;width:240px;position:relative;display:block}.hn-search-icon{position:absolute;left:11px;top:50%;width:13px;height:13px;margin-top:-7px;border:2px solid var(--hn-soft);border-radius:50%;opacity:.9;pointer-events:none}.hn-search-icon:after{content:\"\";position:absolute;width:6px;height:2px;right:-5px;bottom:-3px;background:var(--hn-soft);border-radius:2px;transform:rotate(45deg)}.hn-conn-search{width:100%;max-width:none;height:34px;border-radius:999px;padding-left:34px;background:rgba(19,22,30,.72)}.hn-conn-search::-webkit-search-cancel-button{filter:invert(1);opacity:.6}.hn-danger{border-color:rgba(255,92,104,.58)!important;color:#ff6d7a!important;position:relative}.hn-danger:before,.hn-danger:after{content:\"\";position:absolute;left:50%;top:50%;width:12px;height:1.6px;border-radius:2px;background:currentColor;transform-origin:center}.hn-danger:before{transform:translate(-50%,-50%) rotate(45deg)}.hn-danger:after{transform:translate(-50%,-50%) rotate(-45deg)}.hn-danger:hover:not(:disabled){background:rgba(255,92,104,.11)!important;border-color:#ff6d7a!important;color:#ff7f8a!important}.hn-danger:disabled{opacity:.45}.hn-conn-totals{display:flex;gap:14px;color:var(--hn-soft);font-size:12px;margin:0 0 10px}.hn-conn-table-wrap{overflow:auto;max-height:560px;border-top:1px solid var(--hn-line)}.hn-conn-table{width:100%;border-collapse:collapse;min-width:980px}.hn-conn-table th,.hn-conn-table td{padding:8px 8px;border-bottom:1px solid var(--hn-line);text-align:left;vertical-align:top;color:var(--hn-text);font-size:13px}.hn-conn-table th{position:sticky;top:0;background:var(--hn-card);z-index:1;color:var(--hn-soft);font-weight:800}.hn-conn-host{max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-route-proxy{font-weight:800;color:#9bc7ff!important}.hn-route-direct{font-weight:800;color:#f3c65b!important}.hn-service{display:inline-block;color:#13b675;font-weight:800;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-theme-light .hn-conn-filter.active{background:#e8f7ff}.hn-theme-light .hn-conn-search{background:#eef2f8}.hn-theme-light .hn-conn-table th{background:var(--hn-card)}@media(max-width:980px){.hn-conn-toolbar{grid-template-columns:1fr}.hn-conn-search-wrap{width:min(100%,260px)}.hn-conn-table-wrap{max-height:none}}"]),
      h("style", [".hn-dashboard{padding:14px 14px 20px}.hn-dashboard-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--hn-line);padding-bottom:10px;margin-bottom:12px}.hn-sub-card{border:1px solid rgba(52,201,255,.35);background:linear-gradient(90deg,rgba(52,201,255,.12),rgba(52,201,255,.03));border-radius:8px;padding:16px;margin-bottom:22px}.hn-sub-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.hn-sub-label{text-transform:uppercase;letter-spacing:.03em;color:var(--hn-primary-2);font-weight:800}.hn-pill{display:inline-flex;align-items:center;min-height:28px;padding:2px 12px;border-radius:999px;border:1px solid var(--hn-border);background:rgba(120,130,150,.12);color:var(--hn-soft);font-size:12px}.hn-sub-announce{display:flex;gap:10px;flex-wrap:wrap;border:1px solid var(--hn-line);border-radius:8px;background:rgba(0,0,0,.12);padding:8px 10px;font-weight:700}.hn-outbounds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.hn-outbound{min-height:70px;border:1px solid var(--hn-border);border-radius:8px;background:var(--hn-card-strong);padding:12px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;color:var(--hn-text);cursor:pointer}.hn-outbound:disabled{opacity:.72;cursor:not-allowed}.hn-outbound:not(.active):hover{border-color:var(--hn-primary-2);background:color-mix(in srgb,var(--hn-primary-2) 8%,var(--hn-card-strong))}.hn-outbound.active{border-color:#00b978;box-shadow:0 0 0 1px #00b978 inset;background:linear-gradient(180deg,rgba(0,185,120,.13),var(--hn-card-strong))}.hn-outbound-name{font-weight:800;color:var(--hn-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-outbound-meta{display:flex;justify-content:space-between;gap:12px;color:var(--hn-primary-2)}@media(max-width:1100px){.hn-outbounds{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.hn-dashboard-head{align-items:flex-start;flex-direction:column}.hn-outbounds{grid-template-columns:1fr}.hn-sub-announce{display:grid;grid-template-columns:1fr}}"]),
      h("style", [".hn-flag-img{width:21px;height:14px;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.18);vertical-align:-2px;flex:0 0 auto}.hn-outbound-name{display:flex;align-items:center;gap:8px;min-width:0}.hn-outbound-name span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hn-outbounds{grid-template-columns:repeat(3,minmax(220px,1fr))}.hn-outbound{min-height:78px}.hn-route-cell{display:flex;align-items:flex-start;gap:8px;min-width:190px;max-width:230px;line-height:1.25}.hn-route-cell span{white-space:normal;word-break:normal}.hn-conn-table{min-width:1180px;table-layout:fixed}.hn-conn-table th:nth-child(1),.hn-conn-table td:nth-child(1){width:170px}.hn-conn-table th:nth-child(2),.hn-conn-table td:nth-child(2){width:56px}.hn-conn-table th:nth-child(3),.hn-conn-table td:nth-child(3){width:220px}.hn-conn-table th:nth-child(4),.hn-conn-table td:nth-child(4){width:80px}.hn-conn-table th:nth-child(5),.hn-conn-table td:nth-child(5),.hn-conn-table th:nth-child(6),.hn-conn-table td:nth-child(6){width:105px}.hn-conn-table th:nth-child(7),.hn-conn-table td:nth-child(7){width:180px}.hn-conn-table th:nth-child(8),.hn-conn-table td:nth-child(8){width:150px}.hn-conn-table th:nth-child(9),.hn-conn-table td:nth-child(9){width:48px}.hn-service{max-width:170px;white-space:normal;overflow-wrap:anywhere;line-height:1.25}.hn-conn-table td:nth-child(8){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-conn-host{max-width:160px}@media(max-width:1100px){.hn-outbounds{grid-template-columns:repeat(2,minmax(220px,1fr))}}@media(max-width:620px){.hn-outbounds{grid-template-columns:1fr}}"]),
      h("style", [".hn-conn-table-wrap{overflow-y:auto;overflow-x:hidden}.hn-conn-table{min-width:0!important;width:100%;table-layout:fixed}.hn-conn-table th,.hn-conn-table td{padding:8px 7px}.hn-conn-table th:nth-child(1),.hn-conn-table td:nth-child(1){width:22%}.hn-conn-table th:nth-child(2),.hn-conn-table td:nth-child(2){width:210px}.hn-conn-table th:nth-child(3),.hn-conn-table td:nth-child(3){width:74px}.hn-conn-table th:nth-child(4),.hn-conn-table td:nth-child(4){width:118px}.hn-conn-table th:nth-child(5),.hn-conn-table td:nth-child(5){width:20%}.hn-conn-table th:nth-child(6),.hn-conn-table td:nth-child(6){width:120px}.hn-conn-table th:nth-child(7),.hn-conn-table td:nth-child(7){width:42px}.hn-cell-main,.hn-conn-host{min-width:0;max-width:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-cell-sub{margin-top:2px;color:var(--hn-soft);font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hn-route-cell{min-width:0;max-width:none;align-items:flex-start}.hn-route-cell span{min-width:0;display:block;white-space:normal;word-break:normal;overflow-wrap:normal;hyphens:none}.hn-traffic-cell{white-space:nowrap;color:var(--hn-text);line-height:1.55}.hn-service-cell{min-width:0}.hn-service{display:block;max-width:none;color:#13c782;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25}.hn-conn-table td:nth-child(6){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:900px){.hn-conn-table th:nth-child(1),.hn-conn-table td:nth-child(1){width:26%}.hn-conn-table th:nth-child(2),.hn-conn-table td:nth-child(2){width:180px}.hn-conn-table th:nth-child(5),.hn-conn-table td:nth-child(5){width:19%}.hn-conn-table th:nth-child(6),.hn-conn-table td:nth-child(6){width:105px}}"]),
      h("style", ["@media(max-width:760px){.hn-conn-toolbar{display:grid;grid-template-columns:1fr 44px;gap:10px}.hn-conn-filters,.hn-conn-search-wrap{grid-column:1/-1;width:100%;max-width:none}.hn-conn-toolbar>.hn-btn{grid-column:1/2;width:100%}.hn-conn-toolbar>.hn-icon-btn{grid-column:2/3}.hn-conn-table-wrap{max-height:none;border-top:0}.hn-conn-table,.hn-conn-table tbody,.hn-conn-table tr,.hn-conn-table td{display:block;width:100%!important;box-sizing:border-box}.hn-conn-table thead{display:none}.hn-conn-table tr{position:relative;margin:0 0 10px;padding:10px 44px 10px 10px;border:1px solid var(--hn-line);border-radius:8px;background:var(--hn-card-strong)}.hn-conn-table td{border:0!important;padding:2px 0!important}.hn-conn-table td:nth-child(2){margin-top:8px}.hn-conn-table td:nth-child(3),.hn-conn-table td:nth-child(4),.hn-conn-table td:nth-child(6){display:inline-block;width:auto!important;margin-right:14px;vertical-align:top}.hn-conn-table td:nth-child(7){position:absolute;right:9px;top:50%;width:32px!important;margin-top:-16px}.hn-route-cell{display:flex!important;max-width:none;white-space:normal}.hn-route-cell span{overflow-wrap:normal;word-break:normal;white-space:normal}.hn-service{white-space:normal}.hn-cell-main{font-weight:800}.hn-cell-sub{white-space:normal}.hn-traffic-cell{font-size:12px}.hn-conn-table .hn-icon-btn{width:30px;height:30px}}"]),
      h("div", { staticClass: "hn-head" }, [
        h("div", [
          h("div", { staticClass: "hn-title" }, "HarpyNet"),
          h("div", { staticClass: "hn-sub" }, "Панель для основного интерфейса GL.iNet")
        ]),
        h("div", { staticClass: "hn-actions hn-top-actions" }, [
          self.button(h, "Обновить", "summary", false),
          status.running ? self.button(h, "Остановить", "stop", false) : self.button(h, "Запустить", "start", true),
          self.button(h, "Перезапуск", "restart", false),
          status.init_enabled ? self.button(h, "Отключить автозапуск", "disable", false) : self.button(h, "Включить автозапуск", "enable", false),
          self.button(h, "Обновить подписку", "subscription_update", false)
        ])
      ]),
      self.error ? h("div", { staticClass: "hn-error" }, self.error) : null,
      self.notice ? h("div", { staticClass: "hn-notice" }, [
        h("span", self.notice),
        h("span", {
          staticClass: "hn-notice-timer",
          style: {
            background: "conic-gradient(#16c784 " + Math.max(0, self.noticeProgress) + "%, rgba(22,153,94,.16) 0)"
          }
        }, String(Math.max(1, self.noticeRemaining || 1)))
      ]) : null,
      h("div", { staticClass: "hn-tabs" }, tabs.map(function (tab) {
        return h("button", {
          staticClass: self.activeTab === tab.id ? "hn-tab active" : "hn-tab",
          on: { click: function () { self.selectTab(tab.id); } }
        }, tab.label);
      })),
      h("div", { staticClass: "hn-grid" }, [
        h("div", { staticClass: "hn-card" }, [h("div", { staticClass: "hn-label" }, "Сервис"), h("div", { staticClass: "hn-value" }, [self.badge(h, self.runningText, Boolean(status.running))])]),
        h("div", { staticClass: "hn-card" }, [h("div", { staticClass: "hn-label" }, "Автозапуск"), h("div", { staticClass: "hn-value" }, [self.badge(h, self.enabledText, Boolean(status.init_enabled))])]),
        h("div", { staticClass: "hn-card" }, [h("div", { staticClass: "hn-label" }, "Версия"), h("div", { staticClass: "hn-value" }, status.version || "неизвестно")]),
        h("div", { staticClass: "hn-card" }, [h("div", { staticClass: "hn-label" }, "Подписка"), h("div", { staticClass: "hn-value" }, subscriptionLabel)])
      ]),
      self.activeTab === "sections" ? self.renderSections(h, status, subscriptionLabel, subscriptionButtonLabel) : null,
      self.activeTab === "dashboard" ? self.renderDashboard(h) : null,
      self.activeTab === "settings" ? h("div", { staticClass: "hn-card hn-section hn-placeholder" }, "Системные настройки DNS и обновлений перенесём отдельно, чтобы не смешивать их с основной секцией MAIN.") : null,
      self.activeTab === "devices" ? h("div", { staticClass: "hn-card hn-section hn-placeholder" }, "Устройства лучше сделать отдельной таблицей позже, чтобы не трогать основной VPN-контур.") : null,
      self.activeTab === "connections" ? self.renderConnections(h) : null,
      self.renderSubscriptionModal(h)
    ]);
  }
})
