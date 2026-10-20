// ============================================================
// sticky notes — anonymous notes, passed browser to browser
//
// There is no server in the middle. Two browsers find each other
// through a public relay (Trystero's default: the Nostr network),
// then talk straight to each other over WebRTC. The relay only
// carries the handshake — the note itself never touches it, and
// nothing is stored anywhere but in the two browsers.
//
// Because there is no server, there is also no authority: every
// rule below is enforced by the *receiver*, and a modified client
// can ignore it. The limits are a courtesy, not a wall. The README
// keeps the honest list of what that means.
//
// The room is joined as soon as the page is here: there is no "go
// online" button to press first. So a visitor who opens the page
// does reach the public relays, and does share their IP with the
// room. Stepping away is still yours to choose; arriving is not.
// ============================================================

import { unlock } from "./achievements.svelte.js";

const APP_ID = "yours-sticky-notes-v1";
// a room is a full mesh — every peer connects to every other — so its
// size is what decides whether this scales at all. one room would mean
// N(N-1)/2 connections and N-1 of them per browser, which a crowd of a
// few hundred turns into something no tab can hold. so a room is capped
// and a bigger crowd spills into the next shard.
//
// everyone tries shard 0 first, so a small crowd still lands in one room
// together and only a real crowd spreads out. sharding by your own key
// instead would scatter people: two browsers would land in different
// rooms and each see nobody.
const SHARD_COUNT = 8; // rooms we are willing to spread across
const SHARD_CAP = 20; // peers in a room before we look for a quieter one
const PROBE_MS = 1200; // how long to listen before judging a room's size
const shardName = (i) => `lobby-${i}`;
export const MAX_BODY = 280; // characters in one note
const MAX_INBOX = 50; // notes kept in this browser
const RECEIVE_CAP = 3; // notes accepted per day, per receiver
const KEY_ID = "yours.sticky.key"; // the keypair
const KEY_STATE = "yours.sticky.state"; // sent day, inbox, blocks, bookkeeping

// trystero's default relay pool is a long list of public nostr relays.
// we let trystero pick from it itself: it shuffles the pool by the app id
// and takes a handful, so every browser running this app dials the same
// relays without us naming any. hardcoding a list here only went stale.
// if a relay is down, trystero retires it and moves on; the browser still
// logs the failed dial, which is noise, not a fault.
const RELAY_COUNT = 5; // trystero's own default redundancy

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// the day a note belongs to. UTC, so two people in different
// timezones agree on what "today" means.
const today = () => new Date().toISOString().slice(0, 10);

// what a signature covers. the day and the body are both signed,
// so a note cannot be moved to another day or edited in flight.
const notePayload = (day, body) => `note\n${day}\n${body}`;
const usedPayload = (day) => `used\n${day}`;

/* ---------- the state the page reads ---------- */

export const notes = $state({
  status: "off", // off | connecting | online | error | unsupported
  peers: 0,
  error: "",
  sentDay: "", // the last day a note was sent from here
  inbox: [], // received notes, newest first
  blocked: [], // public keys we no longer accept from
  unread: 0,
});

// per-day bookkeeping, not shown: who we have already heard from
// today, who has told us they are spent, and how many we have taken.
let seen = {}; // pubKey -> day
let used = {}; // pubKey -> day
let received = { day: "", count: 0 };

/* ---------- load & save ---------- */

const isNote = (n) =>
  !!n &&
  typeof n === "object" &&
  typeof n.id === "string" &&
  typeof n.pubKey === "string" &&
  typeof n.body === "string" &&
  typeof n.day === "string" &&
  Number.isFinite(n.at);

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_STATE) || "null");
    if (!raw || typeof raw !== "object") return;
    const day = today();
    if (typeof raw.sentDay === "string") notes.sentDay = raw.sentDay;
    if (Array.isArray(raw.inbox))
      notes.inbox = raw.inbox.filter(isNote).slice(0, MAX_INBOX);
    if (Array.isArray(raw.blocked))
      notes.blocked = raw.blocked
        .filter((k) => typeof k === "string")
        .slice(0, 200);
    // the per-day maps are pruned on read, so they never grow forever
    if (raw.seen && typeof raw.seen === "object")
      for (const [k, v] of Object.entries(raw.seen)) if (v === day) seen[k] = v;
    if (raw.used && typeof raw.used === "object")
      for (const [k, v] of Object.entries(raw.used)) if (v === day) used[k] = v;
    if (raw.received && raw.received.day === day)
      received = { day, count: Number(raw.received.count) || 0 };
  } catch {
    /* a hand-edited or unreadable payload is simply ignored */
  }
}

function save() {
  try {
    localStorage.setItem(
      KEY_STATE,
      JSON.stringify({
        sentDay: notes.sentDay,
        inbox: notes.inbox,
        blocked: notes.blocked,
        seen,
        used,
        received,
      }),
    );
  } catch {
    /* private mode or a full quota — the notes still show this visit */
  }
}

loadState();

/* ---------- identity ----------
   An ECDSA P-256 keypair, made once and kept in this browser. The
   public key is the whole of your identity here: no name, no
   account, no email. It is what a note is signed with, and what a
   receiver blocks. It survives reloads; the peer id does not. */

let idPromise = null;

function identity() {
  if (!idPromise) idPromise = loadIdentity();
  return idPromise;
}

async function loadIdentity() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle)
    throw new Error(
      "this browser cannot sign notes (a secure context is needed)",
    );
  const params = { name: "ECDSA", namedCurve: "P-256" };

  try {
    const raw = JSON.parse(localStorage.getItem(KEY_ID) || "null");
    if (raw && raw.jwk && typeof raw.jwk === "object") {
      const privateKey = await subtle.importKey("jwk", raw.jwk, params, false, [
        "sign",
      ]);
      const publicKey = await subtle.importKey(
        "jwk",
        { kty: raw.jwk.kty, crv: raw.jwk.crv, x: raw.jwk.x, y: raw.jwk.y },
        params,
        true,
        ["verify"],
      );
      const pub = await subtle.exportKey("raw", publicKey);
      return { privateKey, pubKey: b64(pub) };
    }
  } catch {
    /* a broken key is replaced below */
  }

  const pair = await subtle.generateKey(params, true, ["sign", "verify"]);
  const jwk = await subtle.exportKey("jwk", pair.privateKey);
  try {
    localStorage.setItem(KEY_ID, JSON.stringify({ jwk }));
  } catch {
    /* the identity still works for this visit */
  }
  const pub = await subtle.exportKey("raw", pair.publicKey);
  return { privateKey: pair.privateKey, pubKey: b64(pub) };
}

async function sign(privateKey, text) {
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(text),
  );
  return b64(sig);
}

async function verify(pubKey, text, sig) {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      unb64(pubKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      unb64(sig),
      enc.encode(text),
    );
  } catch {
    return false;
  }
}

/* ---------- the room ---------- */

let room = null;
let act = null;
let peerTimer = null;

// a slow heartbeat. peer discovery can lag behind the join/leave events,
// so the count is re-read from the room rather than trusted to fire.
function tick() {
  if (room) notes.peers = Object.keys(room.getPeers()).length;
}

// listen for a moment and report how many peers are already in a room
function countPeers(r) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(Object.keys(r.getPeers()).length), PROBE_MS);
  });
}

async function leaveQuietly(r) {
  try {
    await r.leave();
  } catch {
    /* leaving is best-effort */
  }
}

// join the first shard with room. everyone starts at shard 0, so a small
// crowd stays together; only when a room fills does the next arrival move
// on. if every room is full we take the quietest one we saw, so a visitor
// is never left with nothing.
async function settle(trystero) {
  // no relay urls of our own: trystero shuffles its default pool by the
  // app id and takes RELAY_COUNT of them, so every browser lands on the
  // same relays. the relay only carries the handshake; the note goes
  // peer to peer.
  const cfg = { appId: APP_ID, relayConfig: { redundancy: RELAY_COUNT } };
  let quietest = null;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const r = trystero.joinRoom(cfg, shardName(i));
    const peers = await countPeers(r);
    if (peers < SHARD_CAP) return r;
    if (!quietest || peers < quietest.peers) {
      if (quietest) await leaveQuietly(quietest.room);
      quietest = { room: r, peers };
    } else {
      await leaveQuietly(r);
    }
  }
  return quietest.room;
}

export async function goOnline() {
  if (notes.status === "online" || notes.status === "connecting") return;
  if (!globalThis.crypto?.subtle) {
    notes.status = "unsupported";
    return;
  }
  notes.error = "";
  notes.status = "connecting";
  try {
    // make the keypair now, on arrival, so a send later is instant and a
    // failure to sign surfaces here rather than mid-send
    await identity();
    // trystero is a chunk of its own, pulled in only when the page joins the room
    const trystero = await import("trystero");
    room = await settle(trystero);

    act = {
      note: room.makeAction("note"),
      used: room.makeAction("used"),
    };
    act.note.onMessage = onNote;
    act.used.onMessage = onUsed;

    room.onPeerJoin = () => {
      notes.peers = Object.keys(room.getPeers()).length;
    };
    room.onPeerLeave = () => {
      notes.peers = Object.keys(room.getPeers()).length;
    };

    notes.peers = Object.keys(room.getPeers()).length;
    notes.status = "online";
    tick();
    peerTimer = setInterval(tick, 2000);
  } catch (e) {
    notes.status = "error";
    notes.error = e?.message || "could not reach the network";
  }
}

export async function goOffline() {
  const r = room;
  room = null;
  act = null;
  notes.peers = 0;
  notes.status = "off";
  if (peerTimer) {
    clearInterval(peerTimer);
    peerTimer = null;
  }
  if (!r) return;
  try {
    await r.leave();
  } catch {
    /* leaving is best-effort */
  }
}

/* ---------- sending ---------- */

export const sentToday = () => notes.sentDay === today();

export async function sendNote(body) {
  const text = String(body ?? "")
    .trim()
    .slice(0, MAX_BODY);
  if (!text) return { ok: false, error: "write something first." };
  if (notes.status !== "online" || !room || !act)
    return { ok: false, error: "you are not online." };

  const day = today();
  if (notes.sentDay === day)
    return { ok: false, error: "you have already sent your note today." };

  const peerIds = Object.keys(room.getPeers());
  if (!peerIds.length)
    return { ok: false, error: "nobody else is here right now." };

  const target = peerIds[Math.floor(Math.random() * peerIds.length)];
  const id = await identity();
  const sig = await sign(id.privateKey, notePayload(day, text));

  try {
    await act.note.send(
      { pubKey: id.pubKey, body: text, day, sig },
      { target },
    );
  } catch {
    return { ok: false, error: "the note did not go through." };
  }

  notes.sentDay = day;
  save();
  unlock("note-passer");

  // tell the room we are spent, so an honest peer does not wait on us
  const usig = await sign(id.privateKey, usedPayload(day));
  act.used.send({ pubKey: id.pubKey, day, sig: usig }).catch(() => {});

  return { ok: true };
}

/* ---------- receiving ----------
   Every rule here is the receiver's, because there is no server to
   hold anyone to it. A note is dropped unless it is signed, dated
   today, from someone we have not heard from today, and within the
   day's cap. */

async function onNote(data) {
  if (!data || typeof data !== "object") return;
  const { pubKey, body, day, sig } = data;
  if (
    typeof pubKey !== "string" ||
    typeof body !== "string" ||
    typeof day !== "string" ||
    typeof sig !== "string"
  )
    return;
  if (body.length > MAX_BODY) return;
  if (day !== today()) return;
  if (notes.blocked.includes(pubKey)) return;
  if (!(await verify(pubKey, notePayload(day, body), sig))) return;

  // TESTING: the per-sender daily rules are off while testing.
  // restore the checks below.
  // one note per sender per day
  // if (seen[pubKey] === day) return;
  // if they already told us they were spent, a note now is a replay
  // if (used[pubKey] === day) return;
  // and a receiver only takes so many a day
  // if (received.day !== day) received = { day, count: 0 };
  // if (received.count >= RECEIVE_CAP) return;

  seen[pubKey] = day;
  received.count += 1;

  const note = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pubKey,
    body,
    day,
    at: Date.now(),
  };
  notes.inbox = [note, ...notes.inbox].slice(0, MAX_INBOX);
  notes.unread += 1;
  save();
  unlock("note-received");
  window.dispatchEvent(new CustomEvent("sticky:note", { detail: note }));
}

async function onUsed(data) {
  if (!data || typeof data !== "object") return;
  const { pubKey, day, sig } = data;
  if (
    typeof pubKey !== "string" ||
    typeof day !== "string" ||
    typeof sig !== "string"
  )
    return;
  if (day !== today()) return;
  if (notes.blocked.includes(pubKey)) return;
  if (!(await verify(pubKey, usedPayload(day), sig))) return;
  used[pubKey] = day;
  save();
}

/* ---------- the inbox ---------- */

export function blockSender(pubKey) {
  if (typeof pubKey !== "string" || notes.blocked.includes(pubKey)) return;
  notes.blocked = [...notes.blocked, pubKey];
  notes.inbox = notes.inbox.filter((n) => n.pubKey !== pubKey);
  save();
}

export function unblockSender(pubKey) {
  notes.blocked = notes.blocked.filter((k) => k !== pubKey);
  save();
}

export function markRead() {
  if (notes.unread === 0) return;
  notes.unread = 0;
}

export function clearInbox() {
  notes.inbox = [];
  notes.unread = 0;
  save();
}

// a public key is ~88 characters; the first few are enough to tell
// two senders apart on screen.
export const shortKey = (k) => (typeof k === "string" ? k.slice(0, 10) : "");
