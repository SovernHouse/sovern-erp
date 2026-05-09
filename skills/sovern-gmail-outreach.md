# Sovern House — Gmail Outreach Manager Skill

**Version:** 1.0 | **Last Updated:** April 2026  
**Depends on:** sovern-email-writer.md, sovern-prospect-sourcing.md  
**Use for:** Drafting and sending outreach emails via Alex's connected Gmail account.  
**MCP Available:** Gmail MCP is connected — can read, draft, and send.

---

## What This Skill Does

Manages the operational layer of email outreach:
- Drafts emails using the email writer templates (sovern-email-writer.md)
- Sends via Gmail MCP when Alex confirms
- Tracks which emails have been sent and to whom (in this session)
- Reads replies and flags responses that need follow-up
- Labels threads for pipeline tracking

---

## Send Protocol — Every Time

### Before Drafting
1. Confirm prospect passed ICP check (sovern-icp.md)
2. Confirm OFAC/compliance screen complete
3. Load the right template from sovern-email-writer.md for this segment
4. Personalize the opening line with a specific observation about the prospect

### Before Sending
Read the pre-send checklist aloud (figuratively) — never skip:
- [ ] 50–125 words
- [ ] Personalized first line (NOT generic)
- [ ] Single CTA
- [ ] No attachments
- [ ] Physical address in signature
- [ ] Subject line < 7 words, no spam triggers
- [ ] Send time is Mon–Thu, 9:30–11:30am recipient's timezone

### After Sending
- Record: date sent, prospect name, company, template used, subject line
- Set follow-up reminder: Day 4–5 for follow-up 1

---

## Sending Volume Guidelines

Per 2025–2026 deliverability research:
- **Maximum 30 emails per day** from a single inbox (above this, deliverability degrades)
- **Warm up gradually** if this is a new sending domain — start at 10/day, increase by 5/day over 2 weeks
- **Never send on Fridays** — lowest reply rates; worst day to launch a sequence
- **Monday** = best day to start a new sequence
- **Wednesday** = best day for follow-ups (peak engagement mid-week)

If Alex's Gmail is his primary business email and already has years of send history, it has inherent domain reputation. Use it carefully — avoid spam trigger words, keep bounce rates low, monitor deliverability.

---

## Reply Handling Protocol

When reading Gmail for replies:

**Positive reply ("interested", "tell me more", "let's talk"):**
→ Flag as HOT LEAD
→ Respond within 4 hours (same business day minimum)
→ Offer specific calendar slots for a 15-minute call
→ Draft response using Account Executive persona (professional, move toward qualification)

**Neutral reply ("not right now", "maybe later"):**
→ Flag as WARM — add to 90-day re-engagement queue
→ Respond graciously: "Understood — I'll check back in [timeframe]. Feel free to reach out if priorities change."

**Unsubscribe / "remove me":**
→ Remove from ALL sequences immediately
→ Do not contact again
→ Honor within 24 hours (CAN-SPAM legal requirement)

**Bounce:**
→ Remove email from list
→ Try to find alternate contact or verify email before re-attempting
→ High bounce rates damage domain reputation — treat seriously

**No reply:**
→ Proceed with follow-up sequence per sovern-email-writer.md schedule

---

## Gmail Labels to Use (Create These)

Set up these labels in Alex's Gmail for pipeline tracking:

```
Sovern-Outreach/
  ├── 1-Email-Sent
  ├── 2-Follow-Up-Due
  ├── 3-Replied-Hot
  ├── 4-Replied-Warm
  ├── 5-Not-Interested
  └── 6-Unsubscribed
```

Apply labels after each send/reply action to maintain a clean pipeline view.

---

## Cadence Calendar Reference

```
Day 1  (Monday)   — Email 1 sent
Day 5  (Friday)   — Follow-up 1 drafted; send Monday instead
Day 9  (Monday)   — Follow-up 1 sent
Day 13 (Friday)   — Follow-up 2 drafted; send Monday
Day 16 (Monday)   — Follow-up 2 sent  
Day 21 (Monday)   — Follow-up 3 (break-up) sent if still no reply
```

Adjust for holidays and prospect timezone. Never send on the prospect's public holidays.

---

## CAN-SPAM Compliance Checklist (Legal Requirement)

Every email sent must have:
- [ ] Accurate "From" name and email
- [ ] Subject line that reflects email content (no misleading subjects)
- [ ] Physical mailing address (Sovern House Taiwan address)
- [ ] Clear way to opt out (reply "unsubscribe" is sufficient for 1:1 cold email)
- [ ] Unsubscribe honored within 24 hours

GDPR note: If sending to EU-based recipients, be aware that B2B cold email to professional contacts is generally permissible under "legitimate interests" — but keep records of why each contact is relevant to Sovern House's business, and honor opt-outs immediately. Never email personal (consumer) email addresses of EU residents.

---

## What to Track Per Session

At the end of any outreach session, record:

```
Date: 
Emails sent: [N]
Contacts: [list company/names]
Templates used: [A/B/C/D/E]
Follow-ups due: [list with dates]
Replies received: [list with status]
Action items: [any hot leads to action]
```

This log feeds the campaign tracker (sovern-campaign-tracker.md).
