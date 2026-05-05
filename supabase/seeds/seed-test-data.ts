// supabase/seeds/seed-test-data.ts
// Version: 2.2
//
// PURPOSE: Populates the admin dashboard with realistic test data for UI testing.
//          Covers all admin screens except Team Management (real data only).
//
// RULES:
//   - All test churches prefixed '[TEST]' in name field
//   - All test users prefixed '[TEST]' in full_name field
//   - Heartcries encrypted via encrypt_heartcry_content() — real decrypt path exercised
//   - Daily scripture tagged translation = 'TEST' for wipe targeting
//   - Audit log seed entries: triggered_by = 'system', meta.seed = true
//   - Announcements included in wipe order (FK to users via author_id)
//   - Script is idempotent — dry-run wipe fires before every seed
//   - Matching wipe() clears all test data in FK-safe order
//   - Team Management screen excluded — no test super_admin records
//
// DEPENDENCIES:
//   - Service role key required — runs outside RLS
//   - Vault key 'heartcry_encryption_key' must be live
//   - All enum values must match live schema (v1.15.0)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)


// ── WIPE ──────────────────────────────────────────────────────────────────────
// FK-safe delete order:
//   audit_log → messages → heartcries → prayer_requests →
//   network_updates → daily_scripture → announcements →
//   users → churches

export async function wipe() {
  console.log('Running wipe...')

  // 1. Audit log — FKs to users (accessed_by) and churches (church_id)
  //    Seed entries identified by triggered_by = 'system' AND meta.seed = true
  //    Does not wipe real system entries — seed tag is required
  const { error: auditWipeError } = await supabaseAdmin
    .from('audit_log')
    .delete()
    .eq('triggered_by', 'system')
    .filter('meta->seed', 'eq', 'true')    // ✅ reliable JSONB boolean filter across SDK versions

  if (auditWipeError) {
    console.error('Audit log wipe failed:', auditWipeError)
    return false
  }

  // 2. Messages
  await supabaseAdmin
    .from('messages')
    .delete()
    .like('content', '[TEST]%')

  // 3. Heartcries — content is encrypted, cannot filter by [TEST] prefix
  //    Filter by church_id — churches still exist at this point in wipe order
  const { data: testChurches } = await supabaseAdmin
    .from('churches')
    .select('id')
    .like('name', '[TEST]%')

  const testChurchIds = (testChurches ?? []).map((c: any) => c.id)

  if (testChurchIds.length > 0) {
    await supabaseAdmin
      .from('heartcries')
      .delete()
      .in('church_id', testChurchIds)
  }

  // 4. Prayer requests
  await supabaseAdmin
    .from('prayer_requests')
    .delete()
    .like('content', '[TEST]%')

  // 5. Network updates
  await supabaseAdmin
    .from('network_updates')
    .delete()
    .like('content', '[TEST]%')

  // 6. Daily scripture — tagged by translation = 'TEST'
  await supabaseAdmin
    .from('daily_scripture')
    .delete()
    .eq('translation', 'TEST')

  // 7. Announcements — FK to users via author_id
  //    No seed rows at MVP but wipe order must be FK-safe for future runs
  await supabaseAdmin
    .from('announcements')
    .delete()
    .like('title', '[TEST]%')

  // 8. Users — before churches (church_id FK)
  await supabaseAdmin
    .from('users')
    .delete()
    .like('full_name', '[TEST]%')

  // 9. Churches — parent table, last
  await supabaseAdmin
    .from('churches')
    .delete()
    .like('name', '[TEST]%')

  console.log('✅ Wipe complete.')
  return true
}


// ── SEED ──────────────────────────────────────────────────────────────────────
export async function seed() {
  console.log('Starting seed v2.2...')

  // Step 0: dry-run wipe before any inserts
  console.log('Step 0: dry-run wipe...')
  const wiped = await wipe()
  if (!wiped) {
    console.error('Dry-run wipe failed — seed aborted.')
    return
  }
  console.log('Dry-run wipe clean. Proceeding.')


  // ── 1. TEST CHURCHES ───────────────────────────────────────────────────────
  const { data: churches, error: churchError } = await supabaseAdmin
    .from('churches')
    .insert([
      {
        name:                '[TEST] Risen Hope Fellowship',
        type:                'main_campus',
        country:             'Kenya',
        city:                'Nairobi',
        lat:                 -1.286389,
        lng:                 36.817223,
        state_declaration:   'We gather freely and without restriction.',
        rag_status:          'green',
        contact_email:       'test-risen-hope@replant-test.invalid',
        contact_phone:       '+254700000001',
        verified:            false,
        verification_status: 'pending',
        is_active:           true
      },
      {
        name:                '[TEST] Iglesia Camino Nuevo',
        type:                'branch',
        country:             'Colombia',
        city:                'Bogotá',
        lat:                 4.710989,
        lng:                 -74.072092,
        state_declaration:   'We operate with some local limitations.',
        rag_status:          'amber',
        contact_email:       'test-camino@replant-test.invalid',
        contact_phone:       '+573001000001',
        verified:            false,
        verification_status: 'pending',
        is_active:           true
      },
      {
        name:                '[TEST] Grace Harbor Assembly',
        type:                'house_church',
        country:             'Philippines',
        city:                'Manila',
        lat:                 14.599512,
        lng:                 120.984222,
        state_declaration:   'We gather freely.',
        rag_status:          'green',
        contact_email:       'test-grace-harbor@replant-test.invalid',
        contact_phone:       '+639171000001',
        verified:            false,
        verification_status: 'pending',
        is_active:           true
      },
      {
        name:                '[TEST] Trinity West End',
        type:                'main_campus',
        country:             'Canada',
        city:                'Vancouver',
        lat:                 49.282729,
        lng:                 -123.120738,
        state_declaration:   'Freely operating.',
        rag_status:          'green',
        contact_email:       'test-trinity@replant-test.invalid',
        contact_phone:       '+16041000001',
        verified:            true,
        verification_status: 'verified',
        is_active:           true
      },
      {
        name:                '[TEST] Neue Wege Gemeinde',
        type:                'ministry',
        country:             'Germany',
        city:                'Berlin',
        lat:                 52.520008,
        lng:                 13.404954,
        state_declaration:   'Operating with some limitations.',
        rag_status:          'amber',
        contact_email:       'test-neue-wege@replant-test.invalid',
        contact_phone:       '+493001000001',
        verified:            true,
        verification_status: 'verified',
        is_active:           true
      },
      {
        name:                '[TEST] Olive Branch Mission',
        type:                'without_walls',
        country:             'Lebanon',
        city:                'Beirut',
        lat:                 33.888630,
        lng:                 35.495480,
        state_declaration:   'We are not free to gather openly.',
        rag_status:          'red',
        contact_email:       'test-olive-branch@replant-test.invalid',
        contact_phone:       '+9611000001',
        verified:            true,
        verification_status: 'verified',
        is_active:           true
      },
      {
        name:                '[TEST] Bayside Believers',
        type:                'main_campus',
        country:             'Australia',
        city:                'Sydney',
        lat:                 -33.868820,
        lng:                 151.209290,
        state_declaration:   'Freely operating.',
        rag_status:          'green',
        contact_email:       'test-bayside@replant-test.invalid',
        contact_phone:       '+61291000001',
        verified:            false,
        verification_status: 'deactivated',
        is_active:           false,
        deactivated_at:      new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        name:                '[TEST] Living Stone Church',
        type:                'underground',
        country:             null,
        city:                null,
        lat:                 null,
        lng:                 null,
        region_admin_only:   'middle_east_north_africa',
        state_declaration:   'We cannot operate openly.',
        rag_status:          'red',
        contact_email:       'test-living-stone@replant-test.invalid',
        contact_phone:       null,
        verified:            true,
        verification_status: 'verified',
        is_active:           true
      },
      {
        name:                '[TEST] Hidden Vine Fellowship',
        type:                'underground',
        country:             null,
        city:                null,
        lat:                 null,
        lng:                 null,
        region_admin_only:   'east_southeast_asia',
        state_declaration:   'Underground — restricted.',
        rag_status:          'red',
        contact_email:       'test-hidden-vine@replant-test.invalid',
        contact_phone:       null,
        verified:            true,
        verification_status: 'verified',
        is_active:           true
      }
    ])
    .select('id, name')

  if (churchError) {
    console.error('Church seed failed:', churchError)
    return
  }

  console.log(`Seeded ${churches?.length} test churches`)

  const churchMap = Object.fromEntries(
    (churches ?? []).map((c: any) => [c.name, c.id])
  )


  // ── 2. TEST USERS ──────────────────────────────────────────────────────────
  const { error: userError } = await supabaseAdmin
    .from('users')
    .insert([
      {
        auth_id:                 '00000000-0000-0000-0000-000000000001',
        full_name:               '[TEST] Mark Hollander',
        email:                   'test-mark@replant-test.invalid',
        role:                    'pastor',
        church_id:               churchMap['[TEST] Trinity West End'],
        anonymous:               false,
        declaration_affirmed:    true,
        declaration_date:        new Date().toISOString(),
        verification_status:     'verified',
        is_active:               true,
        display_name_preference: 'first_name_only'
      },
      {
        auth_id:                 '00000000-0000-0000-0000-000000000002',
        full_name:               '[TEST] Sarah Patel',
        email:                   'test-sarah@replant-test.invalid',
        role:                    'elder',
        church_id:               churchMap['[TEST] Bayside Believers'],
        anonymous:               false,
        declaration_affirmed:    false,
        declaration_date:        null,
        verification_status:     'pending',
        is_active:               true,
        display_name_preference: 'first_name_only'
      }
    ])

  if (userError) {
    console.error('User seed failed:', userError)
    return
  }

  console.log('Seeded 2 test users — 1 verified, 1 pending')

  const { data: testUsers } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .in('email', [
      'test-mark@replant-test.invalid',
      'test-sarah@replant-test.invalid'
    ])

  const user1 = testUsers?.find((u: any) => u.email === 'test-mark@replant-test.invalid')
  const user2 = testUsers?.find((u: any) => u.email === 'test-sarah@replant-test.invalid')

  if (!user1 || !user2) {
    console.error('Could not retrieve test user IDs — aborting seed')
    return
  }


  // ── 3. TEST PRAYER REQUESTS ────────────────────────────────────────────────
  const { error: prayerError } = await supabaseAdmin
    .from('prayer_requests')
    .insert([
      {
        church_id: churchMap['[TEST] Trinity West End'],
        user_id:   user1.id,
        content:   '[TEST] Please pray for our outreach team heading into the northern regions next week.',
        category:  'Outreach',
        urgent:    false,
        anonymous: false,
        is_active: true
      },
      {
        church_id: churchMap['[TEST] Trinity West End'],
        user_id:   user1.id,
        content:   '[TEST] URGENT — one of our elders has been hospitalised. Please cover him in prayer.',
        category:  'Health',
        urgent:    true,
        anonymous: false,
        is_active: true
      },
      {
        church_id: churchMap['[TEST] Olive Branch Mission'],
        user_id:   user1.id,
        content:   '[TEST] We ask for prayer for safety and provision as we serve in a difficult region.',
        category:  'Safety',
        urgent:    false,
        anonymous: false,
        is_active: true
      }
    ])

  if (prayerError) {
    console.error('Prayer request seed failed:', prayerError)
    return
  }

  console.log('Seeded 3 test prayer requests')


  // ── 4. TEST HEARTCRIES — encrypted ────────────────────────────────────────
  const { data: encryptionKey, error: vaultError } = await supabaseAdmin
  .rpc('get_heartcry_encryption_key')


  if (vaultError || !encryptionKey) {
    console.error('Failed to retrieve heartcry encryption key — aborting heartcry seed:', vaultError)
    return
  }

  const heartcryPlaintexts = [
    {
      plaintext: '[TEST] Three of our brothers were detained at the morning gathering. Urgent prayer needed.',
      severity:  'active_persecution' as const,
      responded: false,
      church:    '[TEST] Living Stone Church'
    },
    {
      plaintext: '[TEST] Our pastor has been in custody. Families are under pressure from local authorities.',
      severity:  'urgent' as const,
      responded: false,
      church:    '[TEST] Hidden Vine Fellowship'
    },
    {
      plaintext: '[TEST] Continued surveillance in our city. Gathering rhythm adapted to smaller cells.',
      severity:  'ongoing' as const,
      responded: true,
      church:    '[TEST] Living Stone Church'
    }
  ]

  const heartcryInserts: any[] = []

  for (const record of heartcryPlaintexts) {
    const { data: encrypted, error: encryptError } = await supabaseAdmin
      .rpc('encrypt_heartcry_content', {
        plaintext: record.plaintext,
        key:       encryptionKey
      })

    if (encryptError || !encrypted) {
      console.error('Encryption failed — aborting heartcry seed:', encryptError)
      return
    }

    heartcryInserts.push({
      church_id: churchMap[record.church],
      content:   encrypted,
      severity:  record.severity,
      responded: record.responded
    })
  }

  const { error: heartcryError } = await supabaseAdmin
    .from('heartcries')
    .insert(heartcryInserts)

  if (heartcryError) {
    console.error('Heartcry seed failed:', heartcryError)
    return
  }

  console.log('Seeded 3 encrypted test heartcries')


  // ── 5. TEST FLAGGED MESSAGES ───────────────────────────────────────────────
  const { error: messageError } = await supabaseAdmin
    .from('messages')
    .insert([
      {
        sender_id:   user1.id,
        receiver_id: user2.id,
        content:     '[TEST] We are doing a small fundraiser and wondered if partner churches would contribute toward our new sound system. Account details available on request.',
        flagged:     true,
        is_active:   true
      },
      {
        sender_id:   user2.id,
        receiver_id: user1.id,
        content:     '[TEST] I noticed an external link in the last broadcast — http://external-test.invalid — wanted to flag it for review.',
        flagged:     true,
        is_active:   true
      }
    ])

  if (messageError) {
    console.error('Message seed failed:', messageError)
    return
  }

  console.log('Seeded 2 test flagged messages')


  // ── 6. TEST NETWORK UPDATES ────────────────────────────────────────────────
  const { error: feedError } = await supabaseAdmin
    .from('network_updates')
    .insert([
      {
        type:      'church_verified',
        church_id: churchMap['[TEST] Trinity West End'],
        content:   '[TEST] Trinity West End has been verified and joined the network.'
      },
      {
        type:      'prayer_submitted',
        church_id: churchMap['[TEST] Olive Branch Mission'],
        content:   '[TEST] A new prayer request has been submitted.'
      }
    ])

  if (feedError) {
    console.error('Network updates seed failed:', feedError)
    return
  }

  console.log('Seeded 2 test network updates')


  // ── 7. DAILY SCRIPTURE ─────────────────────────────────────────────────────
  const { error: scriptureError } = await supabaseAdmin
    .from('daily_scripture')
    .insert([
      {
        scripture_date: '2099-01-01',
        reference:      'John 3:16',
        content:        '[TEST] For God so loved the world that he gave his one and only Son.',
        translation:    'TEST'
      },
      {
        scripture_date: '2099-01-02',
        reference:      'Romans 8:28',
        content:        '[TEST] And we know that in all things God works for the good of those who love him.',
        translation:    'TEST'
      },
      {
        scripture_date: '2099-01-03',
        reference:      'Philippians 4:13',
        content:        '[TEST] I can do all this through him who gives me strength.',
        translation:    'TEST'
      }
    ])

  if (scriptureError) {
    console.error('Daily scripture seed failed:', scriptureError)
    return
  }

  console.log('Seeded 3 test daily scripture entries')


  // ── 8. AUDIT LOG ───────────────────────────────────────────────────────────
  const { error: auditError } = await supabaseAdmin
    .from('audit_log')
    .insert([
      {
        accessed_by:  null,
        action:       'verify_church',
        triggered_by: 'system',
        church_id:    churchMap['[TEST] Trinity West End'],
        accessed_at:  new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        meta:         { note: '[TEST] seed entry — safe to ignore', seed: true }
      },
      {
        accessed_by:  null,
        action:       'pii_scrubbed',
        triggered_by: 'system',
        church_id:    churchMap['[TEST] Bayside Believers'],
        accessed_at:  new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        meta:         { note: '[TEST] seed entry — safe to ignore', seed: true }
      }
    ])

  if (auditError) {
    console.error('Audit log seed failed:', auditError)
    return
  }

  console.log('Seeded 2 test audit log entries')


  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('✅ Seed v2.2 complete.')
  console.log('  Churches:        9 (3 pending, 3 verified, 1 deactivated, 2 underground)')
  console.log('  Users:           2 (1 verified, 1 pending)')
  console.log('  Prayer requests: 3 (1 urgent, 2 standard, all non-anonymous)')
  console.log('  Heartcries:      3 (encrypted, mixed severity)')
  console.log('  Messages:        2 (flagged, distinct sender/receiver)')
  console.log('  Network updates: 2')
  console.log('  Daily scripture: 3 (translation = TEST)')
  console.log('  Audit log:       2 (triggered_by = system, meta.seed = true)')
}

// Call seed on run
seed()

// ── KNOWN GAPS ─────────────────────────────────────────────────────────────
// TC-06.5 — logged as known gap, non-blocking for seed run.
// To be filed on Jira board by QA.