// Serverless function: returns the latest videos from the church YouTube channel.
// Reads the public channel RSS feed (no API key needed) and returns clean JSON.
// Runs on Netlify. On previews without functions (e.g. GitHub Pages) the client
// falls back gracefully to the static tiles already in the page.

const https = require("https");

const CHANNEL_ID = "UC3M7SFFVwGsXFLTnh-LzKDQ";
const FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=" + CHANNEL_ID;

function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0 (MFM Youth site)" } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("Upstream status " + res.statusCode));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function decode(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function parse(xml) {
  const videos = [];
  const entries = xml.split("<entry>").slice(1);
  for (const e of entries) {
    const id = (e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
    if (!id) continue;
    videos.push({
      id,
      title: decode(title).trim(),
      published: published || "",
      url: "https://www.youtube.com/watch?v=" + id,
      thumb: "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
    });
    if (videos.length >= 12) break;
  }
  return videos;
}

exports.handler = async function () {
  try {
    const xml = await fetchFeed(FEED_URL);
    const videos = parse(xml);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=1800, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ videos }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ videos: [], error: String(err.message || err) }),
    };
  }
};
