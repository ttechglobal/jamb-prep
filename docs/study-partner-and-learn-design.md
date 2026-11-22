# Study partner, challenges, needs-work trends, key points

Status: design agreed in conversation, nothing built yet. Decisions marked OPEN need an answer before build.

## 1. Study partner

Goal: keep each other practising. No chat, ever in v1.

### Getting a partner
- Invite link (WhatsApp share). Friend opens link, signs in or up, accepts.
- Request by exact username or code. No browsable directory.
- Phase 2: find a partner by subject combo and exam year (request/accept). Not in v1.

### The agreement
- Each person sets their own commitment independently: once a day, twice a day, or N questions a day.
- Both commitments show on the partner card so the pair can see what each promised.
- No shared streak. You see your own streak and your partner's. A missed day never affects the other person.

### Partner card
- Partner name, their streak, today's status (practised / not yet), their commitment.
- Nudge button when they have not practised today. One nudge per partner per day.
- Challenge button always.

### Notifications (push and in-app)
- "Tolu has practised today" (shown when you open the app and you have not).
- "Tolu has not practised yet" gives you the Nudge and Challenge options.
- Nudge received: push and in-app. Tapping opens practice.
- Cap pushes per partner per day so it never feels like spam.

## 2. Challenges (async only)

No live mode for now (realtime would eat the Supabase free tier).
No realtime presence either. "Is my friend online" is replaced by last-active (from existing events) and a push that acts as the beep.

### Setup (creator)
1. Pick subject.
2. Pick number of questions (creator's choice, capped at 40, a JAMB subject paper).
3. Timer on or off. If on, one timer for the whole set, not per question.
4. Creator plays immediately.
5. Then sends the challenge (push + share link) to the partner.

### Playing
- Friend has 48 hours to play the same questions, same order, same timer.
- Questions are fixed at creation: store the question id list, not copies.
- Result screen compares both: score, time, who won, rematch.
- Score decides the winner, time breaks ties.
- Expired challenges show as expired. Cap open challenges per pair (suggest 5).

### Data (Supabase)
`partnerships`, `partner_commitments`, `nudges`, `challenges` (question_ids, subject, count, timer_seconds, expires_at), `challenge_attempts` (answers, score, time_taken).
Small rows only. Purge old attempts' answer detail after a retention window.

## 3. "Needs work" trends (simple, not a progress metric)

- No strong/weak labels. Wording: "Work on this" and "Improving".
- Based on recent sessions only, favouring the last 7 and 14 days.
- Minimum attempts on a topic before it can show (suggest 5).
- Recommendation: practise more on it.
- If the topic is also high frequency and the student is struggling: recommend key points first, then practise again.
- Frequency weighting: Quick Five and mocks quietly favour high-frequency topics, in a sensible proportion.

## 4. Key points (Learn, paid)

- Authored in a separate learning project, served to JAMBprep by API. JAMBprep only consumes.
- Contract to agree first: shared subject and topic IDs; structured blocks (heading, point, formula, common trap, illustration), not HTML; versioned.
- JAMBprep decides what is free. Decided: the first 5 topics of each of the user's subjects are free.
- Only Learn is paid. Mock exams, practice, games and partners are free, no mock limits.
- Launch pricing: 500 naira for 1 month, 1,000 naira for 3 months.
- Payment at launch is manual: "Pay to subscribe" opens WhatsApp with a prefilled message to 08163037314 (wa.me/2348163037314). The admin then grants Learn access by the student's email, so the admin page needs a "grant access" action (soon).
- Paywall appears at the moment of need: after a "work on this" result.

## 5. Landing page fix (small, separate from the above)

- The Start practising dialog (title, intro, "Ready to practise?", Start practising) is for the landing page cards only. Clicking any card there opens it and leads into the free guest session (guests get 1-2 sessions before sign-up).
- Inside the app, practice modes and games go straight in with no dialog.
- DONE: dialog moved to [components/landing/mode-cards.tsx](../components/landing/mode-cards.tsx) and removed from the in-app practice cards.

## 6. Analytics (first-party events, web app)

Partners: partner_invite_sent, partner_invite_accepted, partner_request_sent, commitment_set, nudge_sent, nudge_opened.
Challenges: challenge_created (subject, count, timed), challenge_sent, challenge_opened, challenge_completed, challenge_expired, rematch.
Trends: needs_work_shown, needs_work_tapped (practise vs key points).
Learn: keypoints_viewed (free or locked), paywall_seen, paywall_converted.
Landing: landing_card_clicked, start_practising_clicked.

## 7. Build order

1. Landing fix (small, independent).
2. Needs-work trends and frequency weighting (uses data already collected).
3. Partners: invite, card, commitments, nudges, notifications.
4. Challenges.
5. Key points consumption and paywall (after the API contract and first content exist).
