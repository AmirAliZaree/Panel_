import https from "node:https";

function joinUrl(base, path) {
  return new URL(path.replace(/^\/+/, ""), base.replace(/\/+$/, "") + "/").toString();
}

export class XUIClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.panelPath = config.panelPath || "/";
    this.username = config.username;
    this.password = config.password;
    this.agent = config.insecureTLS
      ? new https.Agent({ rejectUnauthorized: false })
      : undefined;
    this.cookie = "";
  }

  async request(path, options = {}) {
    const url = joinUrl(this.baseUrl, path);
    const headers = {
      "Accept": "application/json, text/plain, */*",
      ...(options.headers || {})
    };
    if (this.cookie) headers.Cookie = this.cookie;

    const response = await fetch(url, {
      ...options,
      headers,
      dispatcher: undefined,
      agent: this.agent
    }).catch(err => {
      throw new Error(`XUI connection failed: ${err.message}`);
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!response.ok) {
      throw new Error(`XUI HTTP ${response.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
    }
    return data;
  }

  async login() {
    const body = new URLSearchParams({
      username: this.username,
      password: this.password
    });

    // Common 3x-ui login endpoint.
    const candidates = [
      this.panelPath.replace(/\/+$/, "") + "/api/login",
      "/login"
    ];

    let last;
    for (const path of candidates) {
      try {
        const result = await this.request(path, {
          method: "POST",
          headers: {"Content-Type": "application/x-www-form-urlencoded"},
          body
        });
        if (result?.success === false) throw new Error(result.msg || "XUI login failed");
        return result;
      } catch (e) { last = e; }
    }
    throw last || new Error("XUI login failed");
  }

  async getInbounds() {
    await this.login();
    const candidates = [
      this.panelPath.replace(/\/+$/, "") + "/api/inbounds/list",
      "/panel/api/inbounds/list",
      "/api/inbounds/list"
    ];
    let last;
    for (const path of candidates) {
      try {
        const result = await this.request(path);
        if (result?.success === false) throw new Error(result.msg || "API rejected request");
        return result?.obj ?? result;
      } catch (e) { last = e; }
    }
    throw last || new Error("Unable to fetch inbounds");
  }
}

export function normalizeInbounds(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const users = [];

  for (const inbound of list) {
    let settings = {};
    try { settings = typeof inbound.settings === "string" ? JSON.parse(inbound.settings) : (inbound.settings || {}); }
    catch {}

    const clients = Array.isArray(settings.clients) ? settings.clients : [];

    for (const c of clients) {
      users.push({
        id: c.id || c.email || `${inbound.id}-${users.length}`,
        email: c.email || "unnamed",
        enable: c.enable !== false,
        totalGB: Number(c.totalGB || c.total || 0),
        expiryTime: Number(c.expiryTime || 0),
        up: Number(c.up || 0),
        down: Number(c.down || 0),
        inboundId: inbound.id,
        protocol: inbound.protocol || "",
        port: inbound.port || "",
        remark: inbound.remark || ""
      });
    }
  }
  return users;
}