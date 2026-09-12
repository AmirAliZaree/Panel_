import express from "express";
import crypto from "node:crypto";
import QRCode from "qrcode";
import { XUIClient, normalizeInbounds } from "./xui.js";
import { makeSubscriptionToken, verifyToken, base64Subscription } from "./subscription.js";

const app = express();
app.use(express.json({limit:"100kb"}));
app.use(express.static("public"));

const PORT = Number(process.env.PORT || 3000);
const baseUrl = process.env.XUI_BASE_URL;
const panelPath = process.env.XUI_PANEL_PATH || "/";
const username = process.env.XUI_USERNAME;
const password = process.env.XUI_PASSWORD;
const publicBase = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const subSecret = process.env.SUB_SECRET || crypto.randomBytes(32).toString("hex");

if (!baseUrl || !username || !password) {
  console.warn("Set XUI_BASE_URL, XUI_USERNAME and XUI_PASSWORD in .env before using the API.");
}

const xui = new XUIClient({
  baseUrl,
  panelPath,
  username,
  password,
  insecureTLS: process.env.ALLOW_INSECURE_TLS === "1"
});

let cache = { at: 0, users: [] };

async function getUsers(force=false) {
  if (!force && Date.now() - cache.at < 15000) return cache.users;
  const raw = await xui.getInbounds();
  cache = { at: Date.now(), users: normalizeInbounds(raw) };
  return cache.users;
}

function safeUser(u) {
  const used = u.up + u.down;
  return {
    id: u.id,
    email: u.email,
    enable: u.enable,
    totalGB: u.totalGB,
    usedBytes: used,
    usedGB: used / 1024 / 1024 / 1024,
    expiryTime: u.expiryTime,
    inboundId: u.inboundId,
    protocol: u.protocol,
    port: u.port,
    remark: u.remark
  };
}

app.get("/api/health", async (req,res) => {
  res.json({ok:true, service:"AMIRALI CONFIG PANEL", time:new Date().toISOString()});
});

app.get("/api/users", async (req,res) => {
  try {
    const users = await getUsers(req.query.refresh === "1");
    res.json({ok:true, users:users.map(safeUser)});
  } catch (e) {
    res.status(502).json({ok:false, error:e.message});
  }
});

app.get("/api/sub/:token", async (req,res) => {
  try {
    const payload = verifyToken(req.params.token, subSecret);
    if (!payload) return res.status(401).send("Invalid subscription token");

    const users = await getUsers(false);
    const user = users.find(u => String(u.id) === String(payload.uid));
    if (!user) return res.status(404).send("Subscription not found");

    // This adapter intentionally returns only identifiers that are already present
    // in the panel data. A production deployment should map each protocol/inbound
    // to its exact URI generator (VLESS/VMess/Trojan/etc.) rather than inventing it.
    const lines = [`# AMIRALI OS - ${user.email}`];
    lines.push(`# inbound=${user.inboundId} protocol=${user.protocol} port=${user.port}`);
    lines.push(`# Configure the protocol-specific URI generator for this inbound.`);

    res.type("text/plain").send(base64Subscription(lines));
  } catch (e) {
    res.status(502).send("Subscription error: " + e.message);
  }
});

app.get("/api/sub-link/:id", (req,res) => {
  const token = makeSubscriptionToken(req.params.id, subSecret);
  const path = `/api/sub/${encodeURIComponent(token)}`;
  res.json({ok:true, url: publicBase ? publicBase + path : path});
});

app.get("/api/qr/:id", async (req,res) => {
  try {
    const token = makeSubscriptionToken(req.params.id, subSecret);
    const path = `/api/sub/${encodeURIComponent(token)}`;
    const url = publicBase ? publicBase + path : path;
    const png = await QRCode.toBuffer(url, {type:"png", width:420, margin:2});
    res.type("png").send(png);
  } catch (e) {
    res.status(500).json({ok:false,error:e.message});
  }
});

app.listen(PORT, () => {
  console.log(`AMIRALI CONFIG PANEL listening on :${PORT}`);
});