# EVAN-BOT — Command Documentation

## Setup & Installation

### Requirements
- Deno 1.40+
- MongoDB Atlas (or any MongoDB instance)

### Environment Variables
Create a `.env` file in `EVAN-BOT/bot/`:
```env
DISCORD_TOKEN=your_bot_token
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

Optional (for logging and verification):
```env
LOG_WEBHOOK_URL=your_discord_webhook_url
DISCORD_CLIENT_ID=your_application_client_id
DISCORD_CLIENT_SECRET=your_application_client_secret
GUILD_ID=your_guild_id
PORT=3113
```

### Starting the Bot
```bash
cd EVAN-BOT/bot
deno run --allow-net --allow-env --allow-read --allow-write src/main.ts
```

---

## Permissions

All commands marked **[Admin]** require one of:
- The `Manage Server` Discord permission
- The configured admin role (set via `/set-admin`)
- Discord User ID: `1380933421416714410`

---

## Command Reference

### `/set-admin`
Set the admin role that controls access to all bot commands.

**Permission:** Manage Server or Super Admin ID only

**Usage:**
```
/set-admin
```
A dropdown will appear listing server roles. Select the role to assign as the bot admin role.

**Notes:**
- The configured role applies to all [Admin] commands automatically
- Users with Manage Server will always bypass this restriction

---

### `/send-panel [type] [channel?]`
Send a styled panel embed with buttons to a channel.

**Permission:** [Admin]

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | choice | Yes | `verification`, `tickets`, `rules`, or `information` |
| `channel` | channel | No | Target channel (defaults to current) |

**Usage:**
```
/send-panel type:verification channel:#verify
/send-panel type:tickets channel:#support
/send-panel type:rules
/send-panel type:information channel:#welcome
```

**What each panel sends:**
- **verification** — Embed + "Verify Now" button pointing to OAuth2 flow
- **tickets** — Embed + "Open Ticket" button
- **rules** — Static rules embed (no button)
- **information** — Static info embed (no button)

---

### `/autorole set [role]`
Set the role automatically given to new members when they join.

**Permission:** [Admin]

**Usage:**
```
/autorole set role:@Member
```

---

### `/autorole remove`
Remove the configured auto-role.

**Permission:** [Admin]

**Usage:**
```
/autorole remove
```

---

### `/autorole status`
Show the current auto-role configuration.

**Permission:** [Admin]

**Usage:**
```
/autorole status
```

---

### `/welcome set [channel]`
Set the channel where welcome messages are sent when new members join.

**Permission:** [Admin]

**Usage:**
```
/welcome set channel:#general
```

---

### `/welcome disable`
Disable welcome messages.

**Permission:** [Admin]

**Usage:**
```
/welcome disable
```

---

### `/welcome status`
Show the current welcome channel.

**Permission:** [Admin]

**Usage:**
```
/welcome status
```

---

### `/embed [title] [description] [channel?] [thumbnail?]`
Post a custom branded embed to a channel.

**Permission:** [Admin]

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `title` | string | Yes | Embed title |
| `description` | string | Yes | Embed body text |
| `channel` | channel | No | Target channel |
| `thumbnail` | boolean | No | Attach logo thumbnail (default: true) |

**Usage:**
```
/embed title:"Announcement" description:"Server maintenance tonight at 10pm." channel:#announcements
```

---

### `/manverify [user] [ip]`
Manually verify a user by associating their Discord account with an IP address.

**Permission:** [Admin]

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `user` | user | Yes | The Discord user to verify |
| `ip` | string | Yes | The IP address to record (stored as SHA-256 hash) |

**Usage:**
```
/manverify user:@Username ip:192.168.1.1
```

**Notes:**
- If the IP is already registered to a different user, the command will refuse
- Grants all configured `memberRoleIds` to the verified user

---

### `/deletepending`
Process all queued data deletion requests.

**Permission:** [Admin]

**Usage:**
```
/deletepending
```

**Notes:**
- Deletes all MongoDB verification records for queued users
- Removes member roles from affected users
- Users can request deletion via the `/callback` HTTP endpoint with `?userId=`

---

### `/automod setup [preset] [log-channel] [exempt-roles?] [exempt-channels?]`
Apply a Discord native AutoMod rule to this server.

**Permission:** [Admin]

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `preset` | choice | Yes | `Low`, `Medium`, or `High` |
| `log-channel` | channel | Yes | Channel to receive AutoMod alerts |
| `exempt-roles` | string | No | Comma-separated role IDs to exclude from AutoMod |
| `exempt-channels` | string | No | Comma-separated channel IDs to exclude from AutoMod |

**Usage:**
```
/automod setup preset:Medium log-channel:#mod-logs
/automod setup preset:High log-channel:#automod-alerts exempt-roles:1234567890,9876543210
```

**Presets:**
| Level | Description |
|-------|-------------|
| Low | Blocks slurs and basic spam patterns |
| Medium | Low + phishing, invite links, free nitro |
| High | Medium + all external links, email patterns, threats |

---

### `/automod config`
Show the current AutoMod preset applied to this server.

**Permission:** [Admin]

**Usage:**
```
/automod config
```

---

### `/automod clear`
Remove all bot-managed AutoMod rules.

**Permission:** [Admin]

**Usage:**
```
/automod clear
```

---

### `/ticket open [topic?]`
Open a private support ticket channel.

**Permission:** Everyone (rate: 1 open ticket per user)

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `topic` | string | No | Brief description of your issue |

**Usage:**
```
/ticket open
/ticket open topic:"I need help with my purchase"
```

---

### `/ticket close`
Close the current ticket channel. Generates a transcript and deletes the channel after 5 seconds.

**Permission:** Ticket creator or [Admin]

**Usage:**
```
/ticket close
```

---

### `/ticket add [user]`
Add a user to the current ticket channel.

**Permission:** [Admin]

**Usage:**
```
/ticket add user:@Username
```

---

### `/ticket remove [user]`
Remove a user from the current ticket channel.

**Permission:** [Admin]

**Notes:** Cannot remove the original ticket creator.

**Usage:**
```
/ticket remove user:@Username
```

---

### `/ticket transcript`
Generate a live transcript of the current ticket.

**Permission:** [Admin]

**Usage:**
```
/ticket transcript
```

---

### `/ticket setup [category?] [staff-role?]`
Configure ticket system settings.

**Permission:** [Admin]

**Options:**
| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | channel | No | Discord category to create ticket channels in |
| `staff-role` | role | No | Role that can see and manage all tickets |

**Usage:**
```
/ticket setup category:#Tickets staff-role:@Support
```

---

## Button Interactions

| Button | Description | Permission |
|--------|-------------|------------|
| **Verify Now** | Opens Discord OAuth2 at verification.rawth.net | Everyone |
| **Open Ticket** | Creates a private ticket channel | Everyone |
| **Close Ticket** | Closes the ticket (transcript + 5s delete) | Ticket creator or Admin |
| **Claim Ticket** | Assigns a staff member to the ticket | Staff Role or Admin |
| **Get Transcript** | Downloads message history as .txt | Admin |

---

## Verification Flow (`verification.rawth.net`)

1. User clicks **Verify Now** button
2. Discord OAuth2 redirects to `verification.rawth.net/callback`
3. Bot fetches user ID + IP address
4. Checks for: muted role → alt role → duplicate IP (alt detection) → VPN/proxy → mobile data
5. If all checks pass: stores SHA-256 hashed IP → grants member roles → logs event
6. User is redirected to `passed.html`

**Block reasons:**
| Reason | Redirect |
|--------|----------|
| Muted or alt-flagged | `/flagged.html?reason=muted` |
| IP matches another user | `/altflagged.html` |
| VPN or hosting IP | `/flagged.html?reason=vpn` |
| Mobile data | `/mobile.html` |

---

## Logging

All significant events are logged as embeds to the `LOG_WEBHOOK_URL`:
- Bot startup
- Member joined (auto-role granted)
- User verified / blocked / flagged
- Manual verification
- Ticket opened / closed / claimed
- AutoMod rule applied

---

## Initial Server Setup Checklist

1. Invite the bot with `applications.commands` + standard permissions
2. Create a `.env` with `DISCORD_TOKEN` and `MONGO_URI`
3. Start the bot: `deno run --allow-all src/main.ts`
4. Run `/set-admin` and pick your staff role
5. Run `/ticket setup category:YourCategory staff-role:@Support`
6. Run `/autorole set role:@Member` (if desired)
7. Run `/welcome set channel:#welcome` (if desired)
8. Run `/send-panel type:verification channel:#verify`
9. Run `/send-panel type:tickets channel:#support`
10. Run `/automod setup preset:Medium log-channel:#mod-logs`
