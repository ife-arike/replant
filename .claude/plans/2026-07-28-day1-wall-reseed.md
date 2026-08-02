# Day 1 — Wall reseed draft (10 posts + comments)

**Status: EXECUTED 2026-07-28 (Founder GO).** Live script + deltas: `.qa/2026-07-28-day1-wall-reseed.sql`. Snapshot of wiped rows: `.qa/2026-07-28-day1-wall-wipe-snapshot.json`. KAN-338 identity pins green post-run. Founder comment-voice examples included verbatim (posts 1 and 5). Verse anchors added at execution: P1 Isaiah 43:2 pull-quote, P6 Zechariah 4:10 anchor, P8 Philippians 1:6.
Voice register: the June batch (plain, concrete, warm, no filler, all-ages). Every card type, both badges, links, masked + named bylines, varied lengths (some fold behind "read on", some sit flush). Timestamps spread across the 7-day window so relative times vary on camera.

**Wipe scope (proposed):** snapshot to `.qa/2026-07-28-day1-wall-wipe-snapshot.sql`, then remove the current in-window posts, the 2 future-scheduled rows, the draft, and all their comments. The June-and-earlier archive rows stay (invisible to app + admin wall; they are provenance).

**Links:** all seeded links point at `https://projectreplant.org` / `/blog` so a tap on camera never 404s on a stranger's site. Swap any of them if you have better targets.

---

## The 10 posts

**1 · standard · badge URGENT · no link · ~4h ago · topic prayer**
**Six leaders detained after a raid in Sudan**
Believers in Omdurman are asking the network to pray by name for six leaders taken during Friday's raid on a house fellowship. Their families are safe and in hiding with relatives. Local brothers tell us the men were moved twice in the first two days, which usually means a decision has not been made about charges. Pray for steadiness under questioning, for favor with at least one officer, and for their congregations meeting in smaller rooms this week.
*(body folds → "read on"; red dot pulses)*
Comments: 5

**2 · standard · badge NONE · no link · ~9h ago · topic update**
**Twelve churches joined the network this week**
From four continents, including two that registered as branches of mother churches already here. Take a moment in the Church tab to see who is near you.
*(short body, no fold — proves the cue gating)*
Comments: 2

**3 · standard + link → renders as LinkCard · ~1d ago · topic update**
**Where the Church stands: a mid-2026 reading**
A short field briefing drawn from what leaders across the network reported between January and June. Ten minutes, worth every one of them.
Resource label (`source_label`): *Mid-2026 field briefing*
Link: https://projectreplant.org/blog
Comments: none (LinkCard is a resource card)

**4 · article + link · badge NEW · ~1d ago · topic update**
**Shepherding when the money runs out**
What do you tell a congregation the week the factory closes? Leaders in three countries sent us the same question this spring, in almost the same words. This piece gathers what six of them have learned about naming the fear out loud, about the difference between faith and pretending, and about the strange arithmetic of a church that has less and gives more. None of them call it easy. All of them call it holy ground. There is a section near the end written directly to the leader whose own household is the one running short.
*(first sentence becomes the italic standfirst; drop cap on "W"; folds; "Read the full article →"; sky dot breathes)*
Link: https://projectreplant.org/blog
Comments: 3

**5 · long_read (legacy enum, renders "Article") + link · ~2d ago · topic testimony**
**The quiet growth of the house church**
Nobody planted a movement. Somebody opened a living room. Across the network's hardest regions, the pattern repeats: a family, a meal, a psalm sung quietly, and five years later a web of rooms no map has ever held. We traced one thread of it, with names and places changed, from a single kitchen table to eleven fellowships. What struck us was not the courage, though it is everywhere. It was the patience.
*(proves retired long_read rows render identically to Article)*
Link: https://projectreplant.org/blog
Comments: 2

**6 · leader_word · named byline · ~2d ago · topic word_for_today**
**Do not despise the small room**
Zechariah asked who dares despise the day of small things. I have pastored a congregation of thousands and I have pastored nine people in a borrowed room, and I tell you the nine were not the lesser assignment. The Lord counts differently than we do. Whatever size room He has given you this season, fill it faithfully.
Byline (`source_label`): *Bishop Yerlan Daniel Abdrakhmanov* · (`source_sublabel`): *Astana Evangelical Christian Mission*
Verse anchor (if the verse column lands today): Zechariah 4:10
Comments: 9 → demos "show 4 earlier comments" ⇄ "hide earlier comments"

**7 · leader_word · masked byline · ~3d ago · topic word_for_today**
**The Lord knows the way through the desert**
We have no building this year. We have no sign on a road. And still every week the bread and the cup are on the table and the Lord meets us. If you lead where you cannot be seen, you are not unseen.
Byline: *From a pastor · North Africa* · sublabel empty
Comments: 2 (one from an underground leader — round lock avatar, region only)

**8 · encouragement · ~4d ago · topic word_for_today**
**You have not been forgotten in the waiting. The One who began the work knows exactly where you stand, and He is not late.**
Byline: *From a shepherd · Central Asia*
*(the reworked voice: warmer mid-size serif, breathing white dot; no comment thread by pastoral decision)*

**9 · together · badge NEW · ~5d ago · topic prayer**
**Three fellowships, one table**
This week a congregation in Busan, a house church in the Sahel, and a fellowship meeting online across four time zones each set one chair empty at their gathering, for the leader somewhere who cannot gather at all. They asked us to pass the practice on. If your church keeps the empty chair this Sunday, tell us, and we will tell the next church.
*(white dot now; Team-seal footer = intended MVP state)*
Comments: 4

**10 · call_to_action + link · badge NONE · ~6d ago · topic event**
**August week of prayer: the 1st to the 7th**
Seven days, one chapter of Acts each morning, the whole network on the same page. The reading plan is short on purpose; the praying is the point. It begins Friday.
CTA label (`source_label`): *Get the reading plan*
Link: https://projectreplant.org
Comments: 1

---

## Comment plan (~28 total, server-composed identity throughout)

Spread across posts 1, 2, 4, 5, 6, 7, 9, 10 with these deliberate inclusions:
- **Long name + long church stress:** Pieter Johannes van der Berg (Amsterdam Reformed Believers Church), Yerlan Daniel Abdrakhmanov commenting elsewhere than his own word.
- **Anonymous leaders:** at least 2 ("A fellow evangelist", "A fellow psalmist" — square avatar + A).
- **Underground:** at least 3 (round lock avatar, region only), incl. one on the Sudan post.
- **No-church leader:** 1 ("A leader in the network").
- **Global spread:** Accra, Aleppo, Amsterdam, Astana, Baghdad, Beirut, Busan, Cape Town, Casablanca, Niamey.
- **Register:** short intercessions ("Standing with you from Accra."), scripture echoes ("Isaiah 43 over them."), one longer testimony reply on post 5, a practical reply on post 10. No melodrama, nothing a child could not read.
- The 9-comment thread on post 6 stays paced across ~36h of timestamps so the thread reads lived-in, not batch-stamped.

## Mechanics at execution (after your go)
1. Snapshot current announcements + comments → `.qa` register (restorable).
2. Delete in-window rows + scheduled + drafts + their comments (June archive untouched).
3. Insert 10 posts with staggered `published_at`, correct `topic`/`badge`/`card_type`/`author_type`, frozen bylines in `source_label`/`source_sublabel`.
4. Insert comments as the personas above (`author_id` → public.users.id; display composed by `get_comments` v3 at read time — no client-side identity anywhere).
5. Verify comment_count trigger totals + run `.qa/kan338-identity-pins.sql` regression.
6. Leave 1 scheduled + 1 draft row seeded so the admin queue looks alive too (titles in the file at execution).
