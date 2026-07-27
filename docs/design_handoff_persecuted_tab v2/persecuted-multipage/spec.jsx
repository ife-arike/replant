// spec.jsx — RN Spec panel that updates with the current nav option + page.
// Each spec section lists component tree, StyleSheet values, layout, navigation type,
// hit areas, safe area, accessibility — using Typography/Colors constants.

function K({ children }) { return <span className="k">{children}</span>; }
function V({ children }) { return <span className="v">{children}</span>; }
function C({ children }) { return <span className="c">{children}</span>; }

// ─────────── shared blocks ───────────
function SharedNavBarSpec() {
  return (
    <div className="rn-block">
      <div className="label">NavBar StyleSheet</div>
      <ul>
        <li><K>fontFamily</K>: <V>Typography.displayRegular</V> <C>// title</C></li>
        <li><K>fontSize</K>: <V>26</V>, <K>letterSpacing</K>: <V>0.4</V>, <K>color</K>: <V>Colors.red</V></li>
        <li><K>fontFamily</K>: <V>Typography.mono</V> <C>// subtitle</C></li>
        <li><K>fontSize</K>: <V>9.5</V>, <K>letterSpacing</K>: <V>1.9</V>, <K>color</K>: <V>Colors.textMuted</V></li>
        <li><K>height</K>: <V>0.5</V>, <K>backgroundColor</K>: <V>'rgba(217,89,79,0.30)'</V> <C>// hairline</C></li>
        <li>On pushed screens (<K>withBack</K>): render a mono eyebrow row ABOVE the title (own line) — <V>{'‹ BACK'}</V>, mono 9px, letter-spacing 0.18em, color muted, marginBottom 10. Do NOT position the back button absolutely.</li>
      </ul>
    </div>
  );
}

function SharedSafeAreaSpec() {
  return (
    <div className="rn-block">
      <div className="label">Safe Area & Constraints</div>
      <ul>
        <li><K>SafeAreaView</K> <K>edges</K>=<V>{'{[\'top\']}'}</V> <C>// tab bar handles bottom</C></li>
        <li><K>backgroundColor</K>: <V>Colors.background</V> <C>// #080808</C></li>
        <li>Left-edge accent: <K>width</K>: <V>1.5</V>, <K>backgroundColor</K>: <V>Colors.red</V>, <K>opacity</K>: <V>0.25</V></li>
        <li><C>// No expo-blur. No expo-linear-gradient. No fontStyle:'italic' — use scriptureItalic font asset.</C></li>
      </ul>
    </div>
  );
}

// ─────────── nav-option specs ───────────
function StackNavSpec() {
  return (
    <>
      <div className="rn-block full">
        <div className="label">Navigation — Option A (Stack)</div>
        <pre>
{`<Stack.Navigator screenOptions={{ headerShown: false }}>
  <Stack.Screen name="`}<span className="s">"PersecutedRoot"</span>{`" component={PersecutedFrontPage} />
  <Stack.Screen name="`}<span className="s">"MyHeartcries"</span>{`" component={MyHeartcriesScreen} />
  <Stack.Screen name="`}<span className="s">"Memorial"</span>{`"      component={MemorialScreen} />
  <Stack.Screen name="`}<span className="s">"Encouragement"</span>{` component={EncouragementScreen} />
  <Stack.Screen name="`}<span className="s">"StandTogether"</span>{` component={StandTogetherScreen} />
</Stack.Navigator>`}
        </pre>
        <ul style={{ marginTop: 10 }}>
          <li><K>animation</K>: <V>'slide_from_right'</V> <C>// native iOS push</C></li>
          <li>Each sub-screen owns its own scroll state — returning preserves position.</li>
          <li>Back affordance: 30×30 <K>Pressable</K>, <K>hitSlop</K>=<V>10</V>, top-left of NavBar.</li>
        </ul>
      </div>
    </>
  );
}

function PillNavSpec() {
  return (
    <div className="rn-block full">
      <div className="label">Navigation — Option B (Pill Tabs / TabView)</div>
      <pre>
{`<TabView
  navigationState={{ index, routes }}
  renderScene={SceneMap({
    feed:    FrontFeed,
    mine:    MyHeartcriesScene,
    memorial:MemorialScene,
    encour:  EncouragementScene,
    stand:   StandTogetherScene,
  })}
  renderTabBar={(p) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={`}<span className="k">{'{'}</span>{`false`}<span className="k">{'}'}</span>{`}>
      {/* pill row — active state uses Colors.red, never sky */}
    </ScrollView>
  )}
  swipeEnabled={`}<span className="k">{'{'}</span>{`true`}<span className="k">{'}'}</span>{`}
/>`}
      </pre>
      <ul style={{ marginTop: 10 }}>
        <li>Pill chip: <K>fontFamily</K>: <V>Typography.mono</V>, <K>fontSize</K>: <V>9</V>, <K>letterSpacing</K>: <V>1.62</V></li>
        <li>Active: <K>color</K>: <V>Colors.red</V>, <K>borderColor</K>: <V>'rgba(217,89,79,0.30)'</V>, <K>backgroundColor</K>: <V>'rgba(217,89,79,0.05)'</V></li>
        <li>Idle: <K>color</K>: <V>Colors.textMuted</V>, transparent border</li>
        <li>Each scene mounts its own <K>FlatList</K> — do not share scroll position across tabs.</li>
      </ul>
    </div>
  );
}

function SwipeNavSpec() {
  return (
    <div className="rn-block full">
      <div className="label">Navigation — Option C (PagerView)</div>
      <pre>
{`<PagerView
  ref={pagerRef}
  initialPage={0}
  onPageSelected={(e) => setIndex(e.nativeEvent.position)}
  style={{ flex: 1 }}
>
  <View key="feed"><FrontFeedPage /></View>
  <View key="mine"><MyHeartcriesPage /></View>
  <View key="memorial"><MemorialPage /></View>
  <View key="encour"><EncouragementPage /></View>
  <View key="stand"><StandTogetherPage /></View>
</PagerView>`}
      </pre>
      <ul style={{ marginTop: 10 }}>
        <li>Dots: 5×5 <K>View</K>, <K>borderRadius</K>: <V>2.5</V>, <K>backgroundColor</K>: <V>Colors.border</V></li>
        <li>Active dot: <K>width</K>: <V>18</V>, <K>borderRadius</K>: <V>100</V>, <K>backgroundColor</K>: <V>Colors.red</V></li>
        <li>Use <K>react-native-pager-view</K> (Expo SDK has prebuilt). No JS-driven swipe.</li>
        <li>Pre-load adjacent pages: <K>offscreenPageLimit</K>=<V>1</V></li>
      </ul>
    </div>
  );
}

// ─────────── per-page specs ───────────
function FrontPageSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — Front Page</div>
        <pre>
{`<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar />
  {hasUnreadStatus && <HeartcryStatusNotifBar onTap={navToMine} onDismiss={...} />}
  <ScrollView showsVerticalScrollIndicator={false}>
    <ThresholdPreamble />
    <PersecutedActionCard onPress={navToShare} />
    <SectionHeader label="Heartcries from the body" />
    <RegionFilterBar selectedId={region} onSelect={setRegion} />
    {feedRows.slice(round*4, round*4+4).map(row => <HeartcryCard key={row.id} row={row} ... />)}
    <RoundNav round={round} setRound={setRound} total={feedRows.length} />
    <EntryPointBlock title="My Heartcries"      onPress={navToMine} />
    <EntryPointBlock title="The Memorial"     onPress={navToMemorial} />
    <EntryPointBlock title="For Those Enduring" onPress={navToEncour} />
    <EntryPointBlock title="Standing With"    onPress={navToStand} />
    <ScriptureFooter />
  </ScrollView>
  <TabBar active="persecuted" />
</SafeAreaView>`}
        </pre>
      </div>
      <div className="rn-block full">
        <div className="label">Heartcry Pagination (neutral, reusable on Prayer Wall)</div>
        <ul>
          <li><K>ROUND_SIZE</K> = <V>4</V> heartcries per page (reverent pacing — not infinite scroll)</li>
          <li>Implementation: <K>useState(0)</K> index, <K>visible.slice(i*4, i*4+4)</K></li>
          <li>RPC stays <K>get_heartcry_feed(p_limit, p_offset, p_region)</K> — prefetch next page when index changes</li>
          <li>Footer row is three-part: <V>previous</V> · <V>{`{start}–{end} of {total}`}</V> · <V>next</V></li>
          <li>All three are <K>Typography.mono</K>, <K>fontSize</K>: <V>10</V>, <K>letterSpacing</K>: <V>1.0</V>, sentence case. NO BUTTON BORDER.</li>
          <li>Active links: <K>color</K>: <V>Colors.accent</V> (sky). Count: <V>Colors.textMuted</V>. Disabled link: <V>Colors.textSubtle</V>, no press.</li>
          <li><K>hitSlop</K>=<V>{`{ top: 8, bottom: 8, left: 8, right: 8 }`}</V> on each Pressable since the visual target is small.</li>
          <li>On index change: <K>FlatList.scrollToIndex({`{ index: 0, animated: true }`})</K> so the user lands at the top of the new page.</li>
          <li><strong>Reuse:</strong> the same <K>&lt;PagedList&gt;</K> primitive should power the Prayer Wall feed — lift to <V>src/components/PagedList.tsx</V>.</li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">NotifBar (status update)</div>
        <ul>
          <li><K>backgroundColor</K>: <V>'rgba(107,181,232,0.05)'</V></li>
          <li><K>borderWidth</K>: <V>0.5</V>, <K>borderColor</K>: <V>'rgba(107,181,232,0.22)'</V></li>
          <li><K>borderLeftWidth</K>: <V>2</V>, <K>borderLeftColor</K>: <V>Colors.accent</V> <C>// sky #6BB5E8</C></li>
          <li><K>borderRadius</K>: <V>4</V>, <K>marginHorizontal</K>: <V>20</V>, <K>marginTop</K>: <V>12</V></li>
          <li>Eyebrow: <K>fontFamily</K>: <V>Typography.mono</V>, <K>fontSize</K>: <V>8</V>, <K>letterSpacing</K>: <V>1.6</V>, <K>color</K>: <V>Colors.accent</V></li>
          <li>Body: <K>fontFamily</K>: <V>Typography.scriptureItalic</V>, <K>fontSize</K>: <V>14</V>, <K>color</K>: <V>CREAM</V></li>
          <li><K>Pressable</K> with <K>hitSlop</K>=<V>8</V>; close button <K>hitSlop</K>=<V>14</V></li>
          <li><K>accessibilityRole</K>=<V>'button'</V>, <K>accessibilityLabel</K>=<V>'Your heartcry has a new status'</V></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">EntryPointBlock</div>
        <ul>
          <li>Marker: <K>width</K>: <V>1</V>, <K>height</K>: <V>38</V>, <K>backgroundColor</K>: <V>'rgba(217,89,79,0.30)'</V></li>
          <li>Title: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>19</V>, <K>color</K>: <V>Colors.text</V></li>
          <li>Sub: <K>Typography.scriptureItalic</K>, <K>fontSize</K>: <V>14.5</V>, <K>color</K>: <V>Colors.textMuted</V></li>
          <li>Meta: <K>Typography.mono</K>, <K>fontSize</K>: <V>8.5</V>, <K>letterSpacing</K>: <V>1.53</V>, <K>color</K>: <V>Colors.textSubtle</V></li>
          <li>Layout: <K>flexDirection</K>: <V>'row'</V>, <K>gap</K>: <V>14</V>, <K>paddingVertical</K>: <V>16</V></li>
          <li>Divider: <K>borderBottomWidth</K>: <V>StyleSheet.hairlineWidth</V>, <K>borderBottomColor</K>: <V>FAINT</V></li>
          <li><K>Pressable</K> with <K>hitSlop</K>=<V>{'{ top: 4, bottom: 4 }'}</V></li>
        </ul>
      </div>
    </>
  );
}

function MyHeartcriesSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — My Heartcries</div>
        <pre>
{`<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="My Heartcries" subtitle="HELD · ENCRYPTED · ONLY YOU" withBack onBack={navBack} />
  <FlatList                                                          /* not ScrollView */
    data={ownHeartcries}
    keyExtractor={(item) => item.id}
    estimatedItemSize={186}
    ListHeaderComponent={<MyHeartcryIntro />}
    ListFooterComponent={<ScriptureFooter ref="Psalm 142:1" />}
    renderItem={({ item }) => <MyHeartcryRow row={item} />}
  />
  <TabBar active="persecuted" />
</SafeAreaView>`}
        </pre>
      </div>
      <div className="rn-block">
        <div className="label">Severity Tag</div>
        <ul>
          <li>Container: <K>paddingVertical</K>: <V>3</V>, <K>paddingHorizontal</K>: <V>7</V>, <K>borderRadius</K>: <V>2</V></li>
          <li><K>borderWidth</K>: <V>0.5</V>, <K>borderColor</K>: <V>currentSev.border</V></li>
          <li>active_persecution: <K>color</K>: <V>'#B83A30'</V>, bg <V>'rgba(184,58,48,0.06)'</V></li>
          <li>urgent: <K>color</K>: <V>Colors.red</V> (#E05555), border <V>'rgba(224,85,85,0.5)'</V></li>
          <li>serious: <K>color</K>: <V>Colors.amber</V> (#D4A855)</li>
          <li>ongoing: <K>color</K>: <V>'rgba(212,168,85,0.7)'</V></li>
          <li>info: <K>color</K>: <V>Colors.textMuted</V></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Status Track (Received → Seen → Responded)</div>
        <ul>
          <li>Three steps connected by 0.5px hairlines</li>
          <li>Dot: 8×8 <K>borderRadius</K>: <V>4</V></li>
          <li>Done.received: <V>Colors.text</V>; Done.seen: <V>Colors.accent</V> <C>// sky #6BB5E8</C>; Done.responded: <V>Colors.green</V></li>
          <li>Idle dot: <K>borderColor</K>: <V>Colors.border</V>, transparent background</li>
          <li>Responded card opens DM: <K>navigation.navigate('Connect', {`{ screen: 'DM', params: { threadId } }`})</K></li>
          <li><K>accessibilityRole</K>=<V>'progressbar'</V>, <K>accessibilityValue</K>=<V>{`{ now: idx+1, min: 1, max: 3 }`}</V></li>
        </ul>
      </div>
    </>
  );
}

function MemorialSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — Bear Witness (formerly “The Memorial”)</div>
        <pre>
{`<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="The Memorial" subtitle="WITNESSES · STORIES · THE LIVING BODY" withBack />
  <ScrollView showsVerticalScrollIndicator={false}>
    <MemorialStatsBlock data={statsRpc.data} />
        <SectionHeader label="Around the world" link="All stories" />
    {stories.map(s => <StoryCard key={s.id} story={s} />)}
    <SectionHeader label="Witness of the day" link="Archive" />
    <WitnessOfDayCard witness={witnessOfDay} />
    <ScriptureFooter ref="Hebrews 12:1" />
  </ScrollView>
</SafeAreaView>`}
        </pre>
      </div>      <div className="rn-block full">
        <div className="label">Witness of the Day — single featured</div>
        <pre>
{`<WitnessOfDayCard witness={witnessOfDay} />

// Supabase RPC: get_witness_of_day()
{
  id, era,
  years_label,         // "c. AD 69 – 156" / "1898–1963" / "Biblical"
  name,                // "Polycarp of Smyrna" / "Daniel"
  region,
  category,            // "Martyr" | "Father of the Faith" | "God's General" | "From Scripture"
  martyr,              // boolean — controls the Martyr badge
  quote,               // single-line or short multi-line
  scripture_ref,       // "Revelation 2:10"
  source_attribution,  // editorial note
  rotation_day,        // day-of-year index for daily rotation
}`}
        </pre>
        <ul style={{ marginTop: 10 }}>
          <li>Rotates daily; selection by <K>day_of_year() % witness_count</K> with shuffle seed per year</li>
          <li>Martyr badge: <K>color</K>: <V>Colors.red</V>, copy <V>“Martyr”</V>, renders only when <K>witness.martyr === true</K></li>
          <li>Era pill: muted mono, neutral border</li>
          <li>Name: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>24</V></li>
          <li>Quote: <K>Typography.scriptureItalic</K>, <K>fontSize</K>: <V>17</V>, cream</li>
          <li>Scripture ref: italic serif, sky</li>
          <li>“Witness archive” link → <K>navigation.navigate('WitnessArchive')</K> — full timeline with martyrs / fathers / generals / scripture filters</li>
        </ul>
      </div>
      <div className="rn-block full">
        <div className="label">Witness Data Source — needs Founder review</div>
        <ul>
          <li>Storage: Supabase <K>witnesses</K> table — schema in spec above.</li>
          <li><strong style={{ color: 'var(--red)' }}>Pre-launch action:</strong> Founder + Editorial to finalize the canonical list in Claude Code plan-mode before any witness goes live.</li>
          <li>Category enum: <V>'Martyr' | 'Father of the Faith' | 'Mother of the Faith' | 'God’s General' | 'From Scripture'</V></li>
          <li>Rule: every name MUST be a bonafide Christian whose confession of Christ alone is undisputed.</li>
          <li>Drafted candidate list lives in <V>data.jsx</V> as a header comment on <K>WITNESS_OF_DAY</K> — includes Polycarp, Perpetua, Tyndale, Bunyan, Müller, Spurgeon, Hudson Taylor, Brother Andrew, Sadhu Sundar Singh, Eric Liddell, C.S. Lewis, A.W. Tozer, John G. Lake, William Seymour, Kathryn Kuhlman, Smith Wigglesworth, Stephen, Daniel, the three Hebrews, John the Baptist, Paul, etc.</li>
          <li>Dates policy: confirmed year if known; “c.” prefix for approximate; biblical figures use era markers (“Biblical” / “First century”). Never publish a witness whose Christian confession is in dispute.</li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Witness Data Source — Editorial (legacy notes)</div>
        <ul>
          <li>MVP: editorial-curated by Replant Team — stored in a Supabase <K>witnesses</K> table</li>
          <li>Columns: <V>id, era, name, region, account, scripture_ref, published_at, source_attribution</V></li>
          <li>Quotes <C>// every account, every quote</C> must pass an editorial review before publish</li>
          <li>Post-MVP: partnership feed (VOM / Open Doors) joined via <K>witness_sources</K></li>
          <li>“All witnesses” link → <K>navigation.navigate('WitnessArchive')</K> — full timeline screen</li>
          <li>Current four placeholders (Polycarp / Perpetua / Latimer & Ridley / Jim Elliot) are historically real — final wording pending editorial pass.</li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Stat Number</div>
        <ul>
          <li><K>fontFamily</K>: <V>Typography.displayRegular</V> (300 weight via fontWeight)</li>
          <li><K>fontSize</K>: <V>34</V>, <K>letterSpacing</K>: <V>0.34</V>, <K>color</K>: <V>Colors.text</V>, <K>lineHeight</K>: <V>34</V></li>
          <li>Description: <K>Typography.scriptureItalic</K>, <K>fontSize</K>: <V>15</V>, <K>color</K>: <V>CREAM</V></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Story Card / Witness Row</div>
        <ul>
          <li>Story: <K>borderLeftWidth</K>: <V>1.5</V>, <K>borderLeftColor</K>: <V>'rgba(217,89,79,0.30)'</V> <C>// muted, not full red</C></li>
          <li>Story title: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>18</V></li>
          <li>Source author tag: <K>color</K>: <V>Colors.accent</V> <C>// sky</C></li>
          <li>Witness era column: <K>width</K>: <V>64</V>, <K>Typography.mono</K>, <K>fontSize</K>: <V>8.5</V></li>
          <li>Witness account: italic, cream, surrounded by curly quotes (use real “ ”, not ascii)</li>
        </ul>
      </div>
    </>
  );
}

function EncouragementSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — Take Heart (formerly “For Those Enduring”)</div>
        <pre>
{`<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="For Those Enduring" withBack />
  <ScrollView>
    <WordForToday                                                    /* tap-to-cycle, or auto-rotate */
      verses={ENCOURAGEMENT_VERSES}
      index={idx}
      onCycle={() => setIdx(i => (i + 1) % verses.length)}
    />
    <SectionHeader label="Practical guidance" />
    {GUIDANCE_CARDS.map(g => <GuidanceCard key={g.id} {...g} />)}
    <SectionHeader label="The body with you" />
    <BodyWithYouBlock count={prayingCount} />
    <ScriptureFooter ref="John 16:33" />
  </ScrollView>
</SafeAreaView>`}
        </pre>
      </div>
      <div className="rn-block">
        <div className="label">Word For Today</div>
        <ul>
          <li><K>paddingVertical</K>: <V>28</V>, <K>paddingHorizontal</K>: <V>30</V>, <K>alignItems</K>: <V>'center'</V></li>
          <li>Verse: <K>Typography.scriptureItalic</K>, <K>fontSize</K>: <V>22</V>, <K>lineHeight</K>: <V>32</V>, <K>color</K>: <V>CREAM</V></li>
          <li>Auto-cycle: <K>useEffect</K> + <K>setInterval</K> 12s; pause on <K>Pressable</K> active</li>
          <li>Dot pager: 5×5, active <K>backgroundColor</K>: <V>Colors.red</V></li>
          <li><K>accessibilityRole</K>=<V>'button'</V>, <K>accessibilityHint</K>=<V>'Tap for the next verse'</V></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Body-With-You Block</div>
        <ul>
          <li><K>borderWidth</K>: <V>0.5</V>, <K>borderColor</K>: <V>'rgba(107,181,232,0.18)'</V></li>
          <li><K>backgroundColor</K>: <V>'rgba(107,181,232,0.04)'</V> <C>// no expo-linear-gradient — solid color</C></li>
          <li>Count: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>38</V>, <K>color</K>: <V>Colors.accent</V></li>
          <li>Numbers come from <K>get_active_intercession_count()</K> RPC, refreshed every 30s</li>
        </ul>
      </div>
    </>
  );
}

function StandSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — Together <span style={{color: 'var(--red)'}}>· post-MVP / deferred</span></div>
        <pre>
{`<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="Standing With" subtitle="AGGREGATE ONLY · NO IDENTITY EXPOSURE" withBack />
  <ScrollView>
    <StandAggregateBlock rows={aggregateRpc.data} />
    <SectionHeader label="By region" />
    <FlatList numColumns={2} columnWrapperStyle={`}<span className="k">{'{{ gap: 10 }}'}</span>{`}
              data={regionCounts} renderItem={({item}) => <RegionCell {...item} />} />
    <StreakCard days={streak} />
    <ScriptureFooter ref="Galatians 6:2" />
  </ScrollView>
</SafeAreaView>`}
        </pre>
      </div>
      <div className="rn-block">
        <div className="label">Region Cell</div>
        <ul>
          <li><K>backgroundColor</K>: <V>Colors.surface</V>, <K>borderRadius</K>: <V>6</V>, <K>padding</K>: <V>14</V></li>
          <li>Name: <K>Typography.mono</K>, <K>fontSize</K>: <V>9</V>, <K>letterSpacing</K>: <V>1.8</V></li>
          <li>Count: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>20</V></li>
          <li>Heat bar at bottom: <K>height</K>: <V>3</V>, <K>backgroundColor</K>: <V>Colors.red</V>, <K>opacity</K>: heat (0.26\u20130.92)</li>
          <li>NO map view. NO country labels. Region string only.</li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Streak Card</div>
        <ul>
          <li>Number: <K>fontSize</K>: <V>56</V>, <K>fontFamily</K>: <V>Typography.displayRegular</V></li>
          <li>Eyebrow: sky; copy: italic cream</li>
          <li>Source: <K>get_intercession_streak_days()</K> — RPC computed server-side, never trust client time</li>
        </ul>
      </div>
      <div className="rn-block full">
        <div className="label">Post-MVP note</div>
        <ul>
          <li>Page is designed and approved, but build is deferred until Replant has the user volume to make the aggregate numbers meaningful and reverent.</li>
          <li>Re-evaluate once 5k+ verified leaders are active across &gt;20 regions.</li>
          <li>Until then, the front-page “Together” entry-point should be hidden behind a feature flag, or replaced with a quiet “coming” placeholder.</li>
        </ul>
      </div>
    </>
  );
}

// ─────────── Archive specs (‘All stories’ + ‘Witness archive’) ───────────
function StoryArchiveSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — All stories archive</div>
        <pre>
{`<Stack.Screen name="StoryArchive" component={StoryArchiveScreen} />

<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="All stories" subtitle="AROUND THE WORLD · HELD IN-APP" withBack />
  <FlatList
    data={stories}
    keyExtractor={(s) => s.id}
    estimatedItemSize={88}
    ListHeaderComponent={(
      <>
        <ArchiveIntro eyebrow="From The Body" body={intro} />
        <FilterChips data={['All','Replant Editorial','Partner feeds']} selectedId={filter} onSelect={setFilter} />
      </>
    )}
    renderItem={({item}) => <StoryRow story={item} onPress={() => navigation.navigate('ArticleReader', { id: item.id })} />}
    ListFooterComponent={<ScriptureFooter ref="Revelation 12:11" />}
  />
</SafeAreaView>`}
        </pre>
      </div>
      <div className="rn-block">
        <div className="label">Story Row</div>
        <ul>
          <li>Meta: <K>Typography.scriptureItalic</K>, <K>fontSize</K>: <V>12.5</V>, source link sky, separator muted</li>
          <li>Title: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>17</V></li>
          <li>Date: <K>Typography.scriptureItalic</K>, <K>fontSize</K>: <V>12</V>, <K>color</K>: <V>Colors.textSubtle</V></li>
          <li>Divider: <K>borderBottomWidth</K>: <V>StyleSheet.hairlineWidth</V></li>
          <li><K>Pressable</K>, <K>hitSlop</K>=<V>{`{ top: 4, bottom: 4 }`}</V></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Filter Chips</div>
        <ul>
          <li>Filters: <V>'All' | 'Replant Editorial' | 'Partner feeds'</V> — not free-text search</li>
          <li>Horizontal <K>ScrollView</K>, mono caps chip pattern (matches region filter on Front Page)</li>
          <li>RPC: <K>get_story_archive(p_filter)</K></li>
        </ul>
      </div>
    </>
  );
}

function WitnessArchiveSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — Witness archive</div>
        <pre>
{`<Stack.Screen name="WitnessArchive" component={WitnessArchiveScreen} />

<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="Witness archive" subtitle="THOSE WHO CAME BEFORE" withBack />
  <FlatList
    data={witnesses.filter(filterFn)}
    keyExtractor={(w) => w.id}
    estimatedItemSize={132}
    ListHeaderComponent={(
      <>
        <ArchiveIntro eyebrow="A Cloud Of Witnesses" body={intro} />
        <FilterChips data={['All','Martyrs','Fathers...','Mothers...','God’s generals','From scripture']} ... />
        {filter === 'all' && <FeaturedWitness witness={witnessOfDay} />}
      </>
    )}
    renderItem={({item}) => <WitnessRow w={item} />}
    ListFooterComponent={<ScriptureFooter ref="Hebrews 12:1" />}
  />
</SafeAreaView>`}
        </pre>
      </div>
      <div className="rn-block">
        <div className="label">Witness Row</div>
        <ul>
          <li>Era column: <K>width</K>: <V>78</V>, serif 13.5, muted-2</li>
          <li>Name-row: name (serif 17) + small badge (Martyr red, or category muted)</li>
          <li>Description: italic serif 13.5, cream</li>
          <li>Verse: mono 8.5, sky uppercase</li>
          <li>Featured (today): subtle red tint background + 2px red left border</li>
          <li>Filter source-of-truth: <V>category</V> column + <V>martyr</V> boolean</li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Featured row</div>
        <ul>
          <li>Only rendered when <V>filter === 'all'</V></li>
          <li>Eyebrow row above: <V>“Witness of the day”</V> red mono caps</li>
          <li>Below the featured row: <V>“Past witnesses”</V> section label (serif 16, off-white) before the rest of the list</li>
        </ul>
      </div>
    </>
  );
}

// ─────────── Reader specs ───────────
function ArticleReaderSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — Article Reader</div>
        <pre>
{`<Stack.Screen name="ArticleReader" component={ArticleReaderScreen} />

<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="Bear Witness" subtitle="AN EDITORIAL · HELD IN-APP" withBack onBack={navBack} />
  <ScrollView showsVerticalScrollIndicator={false}>
    <ReaderMeta source author title read />
    <ReaderBody paragraphs={article.paragraphs} pullQuote={article.pullQuote} />
    <ScriptureFooter ref={article.scripture.ref} />
  </ScrollView>
  <TabBar active="persecuted" />
</SafeAreaView>`}
        </pre>
        <ul style={{ marginTop: 10 }}>
          <li>Push transition: <K>animation</K>=<V>'slide_from_right'</V></li>
          <li>From Bear Witness: <K>navigation.navigate('ArticleReader', {`{ articleId }`})</K></li>
          <li>Body: <K>Typography.displayRegular</K> (NOT italic), <K>fontSize</K>: <V>17</V>, <K>lineHeight</K>: <V>27</V>, <K>color</K>: <V>CREAM</V> — long-form reading wants roman, not italic.</li>
          <li>Pull quote: <K>borderLeftWidth</K>: <V>2</V>, <K>borderLeftColor</K>: <V>Colors.red</V>, <K>Typography.scriptureItalic</K>, <K>fontSize</K>: <V>22</V></li>
          <li>Title: <K>fontSize</K>: <V>30</V>, <K>lineHeight</K>: <V>35</V>, <K>Typography.displayRegular</K></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Article Source / RPC</div>
        <ul>
          <li><K>get_article(p_article_id uuid)</K> → <V>{`{ id, source, author, title, body_md, pull_quote, scripture_ref, scripture_verse }`}</V></li>
          <li><K>body_md</K> rendered with a tiny markdown allowlist (paragraphs, emphasis, blockquote)</li>
          <li>Never opens external URLs. Editorial — Replant Team or attributed partner.</li>
          <li>Cache aggressively: articles are immutable post-publish.</li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Accessibility</div>
        <ul>
          <li><K>accessibilityRole</K>=<V>'header'</V> on title</li>
          <li>Body: rely on default text role; users can adjust system font scaling — lineHeight uses ratio-derived value to scale cleanly</li>
          <li>Pull quote wrapped in <K>{`<View accessible accessibilityHint="Pull quote">`}</K> for screen readers</li>
        </ul>
      </div>
    </>
  );
}

function GuidanceReaderSpec() {
  return (
    <>
      <SharedNavBarSpec />
      <SharedSafeAreaSpec />
      <div className="rn-block full">
        <div className="label">Component Tree — Guidance Reader</div>
        <pre>
{`<Stack.Screen name="GuidanceReader" component={GuidanceReaderScreen} />

<SafeAreaView edges={['top']}>
  <LeftEdgeAccent />
  <NavBar title="Take Heart" subtitle="GUIDANCE · HELD IN-APP · NOTHING LOGGED" withBack />
  <ScrollView>
    <GuidanceIntro eyebrow title sub secureBadge />
    {steps.map(s => <StepRow num label body />)}
    <ScriptureFooter ref={guidance.scripture.ref} />
  </ScrollView>
  <TabBar active="persecuted" />
</SafeAreaView>`}
        </pre>
      </div>
      <div className="rn-block full">
        <div className="label">Step Row — scripture-led</div>
        <ul>
          <li>Each step has shape <V>{`{ n, label, body, scripture: { text, ref } }`}</V> — the scripture is the foundation of the step, not an afterthought.</li>
          <li>Number: <K>Typography.mono</K>, <K>fontSize</K>: <V>11</V>, <K>color</K>: <V>Colors.red</V>, <K>width</K>: <V>28</V></li>
          <li>Label: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>19</V></li>
          <li>Copy: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>15.5</V>, <K>lineHeight</K>: <V>24</V>, <K>color</K>: <V>CREAM</V></li>
          <li>Scripture block: 1px left rule (sky 40% opacity), italic serif quote + mono uppercase ref</li>
          <li>Gap between rows: <K>gap</K>: <V>22</V></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Step Row</div>
        <ul>
          <li>Number: <K>Typography.mono</K>, <K>fontSize</K>: <V>11</V>, <K>color</K>: <V>Colors.red</V>, <K>width</K>: <V>28</V></li>
          <li>Label: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>19</V></li>
          <li>Copy: <K>Typography.displayRegular</K>, <K>fontSize</K>: <V>15.5</V>, <K>lineHeight</K>: <V>24</V>, <K>color</K>: <V>CREAM</V></li>
          <li>Gap between rows: <K>gap</K>: <V>22</V></li>
        </ul>
      </div>
      <div className="rn-block">
        <div className="label">Security invariants</div>
        <ul>
          <li><C>// NEVER open an external URL from this screen.</C></li>
          <li>Content lives entirely in-app, fetched via <K>get_guidance(p_slug)</K> RPC, cached on device.</li>
          <li>No telemetry is fired when this screen is viewed. No <K>screen_view</K> event, no <K>track('opened_guidance')</K>. Treat this surface as silent.</li>
          <li>Secure badge: 4px pill, <K>borderColor</K>: <V>'rgba(107,181,232,0.30)'</V>, copy <V>“Held in-app”</V></li>
          <li>Print prevented; long-press-to-share disabled on body text via <K>selectable</K>=<V>{`{false}`}</V></li>
        </ul>
      </div>
    </>
  );
}

// ─────────── dispatcher ───────────
function RnSpecPanel({ navOption, page }) {
  const navTitle = navOption === 'A' ? 'Option A — Nested Stack'
                 : navOption === 'B' ? 'Option B — Pill Tabs'
                 : 'Option C — Swipe Pages';
  const pageTitle =
    page === 'front'           ? 'Surface 1 — Front Page' :
    page === 'my-heartcries'   ? 'Surface 2 — My Heartcries' :
    page === 'memorial'        ? 'Surface 3 — Bear Witness' :
    page === 'encouragement'   ? 'Surface 4 — Take Heart' :
    page === 'article'         ? 'Reader — Article (push from Bear Witness)' :
    page === 'guidance'        ? 'Reader — Guidance (push from Take Heart)' :
    page === 'story-archive'   ? 'Archive — All stories (push from Bear Witness)' :
    page === 'witness-archive' ? 'Archive — Witness archive (push from Bear Witness)' :
                                 'Surface 5 — Together (post-MVP)';

  const pageSpec =
    page === 'front'           ? <FrontPageSpec /> :
    page === 'my-heartcries'   ? <MyHeartcriesSpec /> :
    page === 'memorial'        ? <MemorialSpec /> :
    page === 'encouragement'   ? <EncouragementSpec /> :
    page === 'article'         ? <ArticleReaderSpec /> :
    page === 'guidance'        ? <GuidanceReaderSpec /> :
    page === 'story-archive'   ? <StoryArchiveSpec /> :
    page === 'witness-archive' ? <WitnessArchiveSpec /> :
                                 <StandSpec />;

  const navSpec =
    navOption === 'A' ? <StackNavSpec /> :
    navOption === 'B' ? <PillNavSpec /> :
                        <SwipeNavSpec />;

  return (
    <>
      <div className="invariants">
        <span className="label">Hard Invariants</span>
        <span className="item">No expo-blur</span>
        <span className="item">No expo-linear-gradient</span>
        <span className="item">No fontStyle:'italic' — use italic font asset</span>
        <span className="item">Region only — never country</span>
        <span className="item">Red = threshold only</span>
        <span className="item">No leader identity in feed</span>
        <span className="item">Dark theme only</span>
      </div>

      <div className="rn-spec">
        <div className="head">
          <div>
            <div className="eyebrow">React Native Spec</div>
            <div className="title">{pageTitle}</div>
          </div>
          <div className="meta">
            {navTitle}<br />
            iPhone 16 Pro Max · 430×932
          </div>
        </div>
        <div className="rn-grid">
          {navSpec}
          {pageSpec}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { RnSpecPanel });
