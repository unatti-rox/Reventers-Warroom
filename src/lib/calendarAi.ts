/**
 * Reads a calendar screenshot and drafts the planned posts it shows. Never
 * writes to the database itself - the caller shows these as an editable
 * review before anything becomes a real CalendarEntry.
 */

const MODEL = "claude-sonnet-5-5";

export type ParsedEntry = {
  title: string;
  kind: "REGULAR" | "FESTIVAL" | "NON_IP";
  /** Set only when the read bucket matched one of the IPs passed in. */
  ipId: string | null;
  /** The raw bucket text read, shown when it didn't match an IP - the reviewer picks one. */
  ipNameGuess: string | null;
  /** Set only when the read bucket matched one of the festivals passed in. */
  festivalId: string | null;
  festivalNameGuess: string | null;
  /** "YYYY-MM-DD", or null if the date couldn't be confidently read. */
  postDate: string | null;
};

type RawItem = { title?: unknown; bucket?: unknown; date?: unknown };

export async function parseCalendarImage(params: {
  imageBase64: string;
  mediaType: string;
  monthKey: string;
  ipOptions: { id: string; name: string }[];
  festivalOptions: { id: string; name: string }[];
}): Promise<ParsedEntry[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Reading calendar screenshots isn't set up yet - ask an admin to add an Anthropic API key.");

  const ipList = params.ipOptions.map((ip) => ip.name).join(", ") || "(none)";
  const festivalList = params.festivalOptions.map((f) => f.name).join(", ") || "(none)";

  const prompt = `This image is a screenshot of a content calendar for one brand. Extract every planned post you can see and reply with ONLY a JSON array - no markdown fences, no commentary.

Each item: { "title": string, "bucket": string, "date": string }

- "title": a short description of the post (e.g. "Teaser reel", "Site walkthrough").
- "bucket": exactly one of these IP names if it's ordinary IP work: [${ipList}] - or exactly one of these festival names if it's tied to a festival/holiday: [${festivalList}] - or the word "Non-IP" for anything else. Use the exact spelling given.
- "date": the date the post is meant to go live, as YYYY-MM-DD. This calendar is for ${params.monthKey} unless the image clearly shows a different month or year - use that to resolve ambiguous or year-less dates. If you can't confidently read a date, use an empty string rather than guessing.

Reply with only the JSON array.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: params.mediaType, data: params.imageBase64 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Couldn't read that image (the AI service said: ${res.status}). ${body.slice(0, 160)}`);
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  let raw: RawItem[];
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    raw = parsed as RawItem[];
  } catch {
    throw new Error("Couldn't make sense of what was in that image - try a clearer screenshot.");
  }

  const ipByName = new Map(params.ipOptions.map((ip) => [ip.name.trim().toLowerCase(), ip] as const));
  const festivalByName = new Map(params.festivalOptions.map((f) => [f.name.trim().toLowerCase(), f] as const));
  const DAY = /^\d{4}-\d{2}-\d{2}$/;

  return raw
    .filter((r) => typeof r.title === "string" && r.title.trim() && typeof r.bucket === "string" && r.bucket.trim())
    .slice(0, 100)
    .map((r) => {
      const bucketRaw = String(r.bucket).trim();
      const bucketLower = bucketRaw.toLowerCase();
      const matchedIp = ipByName.get(bucketLower);
      const matchedFestival = festivalByName.get(bucketLower);
      const date = typeof r.date === "string" && DAY.test(r.date) ? r.date : null;

      if (matchedIp) {
        return { title: String(r.title).trim().slice(0, 120), kind: "REGULAR" as const, ipId: matchedIp.id, ipNameGuess: null, festivalId: null, festivalNameGuess: null, postDate: date };
      }
      if (matchedFestival) {
        return { title: String(r.title).trim().slice(0, 120), kind: "FESTIVAL" as const, ipId: null, ipNameGuess: null, festivalId: matchedFestival.id, festivalNameGuess: null, postDate: date };
      }
      if (bucketLower === "non-ip" || bucketLower === "non ip") {
        return { title: String(r.title).trim().slice(0, 120), kind: "NON_IP" as const, ipId: null, ipNameGuess: null, festivalId: null, festivalNameGuess: null, postDate: date };
      }
      // Read something that didn't match - guess IP vs festival by whichever word shows up, default to IP since that's the common case.
      const looksLikeFestival = bucketLower.includes("festival") || bucketLower.includes("holiday");
      return {
        title: String(r.title).trim().slice(0, 120),
        kind: looksLikeFestival ? ("FESTIVAL" as const) : ("REGULAR" as const),
        ipId: null,
        ipNameGuess: looksLikeFestival ? null : bucketRaw,
        festivalId: null,
        festivalNameGuess: looksLikeFestival ? bucketRaw : null,
        postDate: date,
      };
    });
}
