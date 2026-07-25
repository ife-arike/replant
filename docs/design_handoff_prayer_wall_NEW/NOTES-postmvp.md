# Prayer Wall — parked notes (post-MVP)

Captured from design review, keep for CC handoff.

## Post-MVP
- **Locations view** (Founder 2026-07-24: cut from the new design, parked as a ticket). Clustering prayer requests by area to discern strongholds (Job 5:12). Was a Coming-Soon placeholder (`LocationsView.tsx`); does not return in the 3-tab design.
- **Church-state articles/blogs** (Founder 2026-07-24, replaces the Revelation surface's role): recurring articles or blog pieces that remind the network of the states of the church and what we need to do about it. The Seven Churches surface (`RevelationView.tsx`) is retired from Prayer Wall for now; its Smyrna → Persecuted cross-nav goes with it.
- **Add to my journal** on an expanded prayer request — removed for now, reconsider later. (Interceding still adds the request to the journal automatically.)
- **Text size preference in Settings** — some ministers prefer larger text. Body type on the wall is set at announcement-feed weight; let the leader scale it.
- **Connect with this church** — on an expanded prayer request. Concept approved, deferred.
- **Share this request / Share this testimony** — deferred.
- **Category multi-select** on Post a request (single-select today; BE not yet multi).
- **Home page nudge:** "Need something to do? Pray for _[an old prayer point they marked as intercession on the Prayer Wall]_." Pulls from the leader's intercession journal. Explicitly post-MVP.
- **Edit** on a prayer request in My Prayers — existed in the current build; keep as a post-MVP option, not in this design.

## Behaviour notes for CC
- Once a request is **marked as testimony** or **removed**, it leaves My Prayers.
- Marking as testimony follows the current flow: the leader may add a few words over it, or just mark it.
- Tapping **Intercede** adds the request to the leader's intercession journal — a living reminder, so the tap isn't insincere.
- Praying for a church from the **Church tab** adds it to the intercession journal. Limit: **10 churches** held at one time.
- Open question: should journal intercessions expire after some time? If they vanish, the **intercede count stays the same**.
  - **CC proposal (2026-07-24, awaiting Founder sign-off):** make the journal list a *view* of `prayer_request_prayed_by`, never its own table — then expiry can't touch the intercede count by construction. Window: show intercessions from the **last 30 days** (a season of carrying). Cap: the **25 most recent** within the window — at cap the oldest simply leaves the visible list, so the Intercede tap never fails and there is nothing to clean up. Natural exits: request answered → leaves toward a future "answered while you held them" note; request removed → leaves. Release stays for intentional letting-go.
- Feed stays sorted by time submitted (newest first). No "this hour" cap until the network is larger — endless scroll for now.
