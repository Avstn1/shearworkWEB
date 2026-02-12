# Acuity Webhooks Setup

This directory contains scripts and utilities for managing Acuity Scheduling webhooks for Corva.

## Overview

Acuity webhooks notify our server when appointments are scheduled, rescheduled, or canceled. This allows us to keep our database in sync with Acuity appointments in real-time.

## Files

- `setup_webhooks.ts` - Core functions for creating webhooks via Acuity API. You only need to run this if you want a COMPLETE RESET. Delete all exisitng webhooks first.
- `scripts/setup_acuity_webhooks.ts` - Script to create webhooks for all users
- `scripts/manage_acuity_webhooks.ts` - Script to list, create, and delete webhooks

## ⚠️ Important: Working Directory

**All commands below must be run from the `./shearwork-web` directory**, not from the project root.

```bash
# First, navigate to the correct directory
cd shearwork-web

# Then run any of the commands below
```

## Setup Webhooks

### Create webhooks for all users

This will create 3 webhooks per user (scheduled, rescheduled, canceled) and save them to the database:

```bash
# From ./shearwork-web directory
npx tsx lib/acuity_webhooks/scripts/setup_acuity_webhooks.ts
```

The webhooks will point to: `https://www.corva.ca/api/acuity/appointment-webhook`

**What happens:**
- Creates webhooks via Acuity API
- Saves webhook data to `acuity_tokens.webhooks_data` as JSONB
- Updates `updated_at` timestamp

### Webhook Events

Each user will have webhooks created for:
- `appointment.scheduled` - When a new appointment is booked
- `appointment.rescheduled` - When an appointment time is changed
- `appointment.canceled` - When an appointment is canceled

## Database Storage

Webhook data is automatically saved to the `acuity_tokens` table in the `webhooks_data` JSONB column.

**Example webhook data:**
```json
[
  {
    "id": 907003,
    "event": "appointment.scheduled",
    "target": "https://www.corva.ca/api/acuity/appointment-webhook",
    "status": "active",
    "errorCount": 0,
    "errorTime": "0000-00-00 00:00:00",
    "errorMessage": ""
  },
  {
    "id": 907004,
    "event": "appointment.rescheduled",
    "target": "https://www.corva.ca/api/acuity/appointment-webhook",
    "status": "active",
    "errorCount": 0,
    "errorTime": "0000-00-00 00:00:00",
    "errorMessage": ""
  },
  {
    "id": 907005,
    "event": "appointment.canceled",
    "target": "https://www.corva.ca/api/acuity/appointment-webhook",
    "status": "active",
    "errorCount": 0,
    "errorTime": "0000-00-00 00:00:00",
    "errorMessage": ""
  }
]
```

This data is updated whenever:
- New webhooks are created
- Webhooks are listed
- Webhooks are deleted

## Manage Webhooks

**Remember:** Run all commands from `./shearwork-web` directory.

### List all webhooks

See what webhooks are currently registered and save to database:

```bash
# From ./shearwork-web directory
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts list
```

This command also saves the webhook data to `acuity_tokens.webhooks_data`.

### Create webhooks for a specific user

Create webhooks for one user:

```bash
# From ./shearwork-web directory
# Uses default URL from NEXT_PUBLIC_SITE_URL
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts create-user <user_id>

# Or specify a custom webhook URL
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts create-user <user_id> https://custom.com/webhook
```

Example:
```bash
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts create-user 08126d2c-e6d0-418b-823f-692e0ec3e193
```

### Delete a specific webhook

Remove one webhook by ID:

```bash
# From ./shearwork-web directory
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts delete-one <user_id> <webhook_id>
```

Example:
```bash
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts delete-one 08126d2c-e6d0-418b-823f-692e0ec3e193 907003
```

### Delete all webhooks for a user

Remove all webhooks for a specific user:

```bash
# From ./shearwork-web directory
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts delete-user <user_id>
```

Example:
```bash
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts delete-user 08126d2c-e6d0-418b-823f-692e0ec3e193
```

### Delete all webhooks

⚠️ **Warning**: This removes ALL webhooks for ALL users:

```bash
# From ./shearwork-web directory
npx tsx lib/acuity_webhooks/scripts/manage_acuity_webhooks.ts delete-all
```

## Webhook Payload

When Acuity sends a webhook, it will be a `application/x-www-form-urlencoded` POST request with:

```
action=scheduled&id=12345&calendarID=1&appointmentTypeID=5
```

Fields:
- `action` - The event type (scheduled, rescheduled, canceled, changed)
- `id` - The Acuity appointment ID
- `calendarID` - The calendar ID for the appointment
- `appointmentTypeID` - The appointment type ID

## Webhook Handler

The webhook endpoint should be implemented at:
```
/app/api/acuity/appointment-webhook/route.ts
```

The handler should:
1. Verify the webhook signature using HMAC-SHA256
2. Parse the form data
3. Fetch full appointment details using the appointment ID
4. Update the database accordingly

## Security

Webhooks are signed by Acuity using HMAC-SHA256. The signature is in the `x-acuity-signature` header. Always verify this signature to ensure requests are authentic.

## Limits

- Maximum 25 webhooks per Acuity account
- Webhooks retry with exponential backoff for up to 24 hours
- Webhooks are disabled after 5 days of consecutive failures

## Troubleshooting

### Environment variables not loading

Make sure your `.env.local` file is in the project root and contains all required variables.

### Webhooks not being created

1. Check that users have valid `access_token` in `acuity_tokens` table
2. Verify the webhook URL is accessible (port 443 for HTTPS or 80 for HTTP)
3. Check Acuity API rate limits

### Webhook limit reached

Use the `list` command to see existing webhooks, then delete unused ones before creating new ones.

## Support

For Acuity API documentation, see:
- [Webhooks Overview](https://developers.acuityscheduling.com/docs/webhooks.md)
- [Dynamic Webhooks API](https://developers.acuityscheduling.com/page/webhooks-webhooks-webhooks)