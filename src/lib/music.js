// ============================================================
// the music link
//
// The deck plays one thing, and it is the visitor's: a youtube
// link they paste. We never keep the raw url — we parse it down
// to a kind and an id, and rebuild the embed url ourselves. That
// is the whole safety story: a hand-edited config can only ever
// point at a real youtube video, never at an arbitrary iframe.
// ============================================================

// the id shapes. a link whose id does not match is refused, so
// nothing but a real video can reach an iframe.
const YT_VIDEO = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST = /^[A-Za-z0-9_-]{10,}$/;

const KINDS = ["video", "playlist"];

// a link is { platform, kind, id } — the only shape we ever store.
// `platform` stays in the shape so a config that names anything
// else is refused rather than silently played.
export function isValidLink(link) {
  if (!link || typeof link !== "object") return false;
  if (link.platform !== "youtube") return false;
  if (!KINDS.includes(link.kind)) return false;
  if (typeof link.id !== "string") return false;
  return (link.kind === "playlist" ? YT_LIST : YT_VIDEO).test(link.id);
}

export function embedUrl(link) {
  if (!isValidLink(link)) return "";
  // youtube-nocookie is the privacy-enhanced host: it holds off on
  // cookies until playback.
  return link.kind === "playlist"
    ? `https://www.youtube-nocookie.com/embed/videoseries?list=${link.id}`
    : `https://www.youtube-nocookie.com/embed/${link.id}`;
}

export function describeLink(link) {
  if (!isValidLink(link)) return "";
  return `youtube · ${link.kind}`;
}

// the height the embed wants, given the width it has — youtube is 16:9
export function frameHeight(link, width) {
  if (!isValidLink(link)) return 0;
  return Math.round((width * 9) / 16);
}

// parse a pasted link into { platform, kind, id }, or null. it is
// deliberately strict: only the youtube hosts and path shapes we
// know, and only ids that match the shape.
export function parseLink(input) {
  if (typeof input !== "string") return null;
  let raw = input.trim();
  if (!raw) return null;
  // a bare "youtu.be/xyz" is a common paste
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = "https://" + raw;

  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return yt("video", parts[0]);
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    const v = url.searchParams.get("v");
    if (v) return yt("video", v);
    const list = url.searchParams.get("list");
    if (list) return yt("playlist", list);
    if (["embed", "shorts", "live", "v"].includes(parts[0])) {
      return yt("video", parts[1]);
    }
    return null;
  }

  return null;
}

function yt(kind, id) {
  const link = { platform: "youtube", kind, id: id ?? "" };
  return isValidLink(link) ? link : null;
}
