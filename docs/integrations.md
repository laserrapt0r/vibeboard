# Integrations

## Jira and Azure DevOps

Cards can stay in sync with tickets in both directions.

**Set up the connection** under *Administration → Integrations*:

| Service | Address | User | Token |
|---|---|---|---|
| Jira Cloud | `https://company.atlassian.net` | e-mail address | API token |
| Jira Data Center | your instance | empty | personal access token |
| Azure DevOps | `https://dev.azure.com/organization` | empty | personal access token (Work Items: read & write) |

Everyone who can edit a board can read and change tickets through a connection, so limit the token to the projects it needs.
Tokens are stored in the database like the mail server password, so protect your backups.

**Connect a board** with *Export & import → Connect Jira / Azure DevOps*. Enter a JQL or WIQL query. A project is required for
Azure DevOps, and for Jira if you want to create tickets from cards.

**What happens:** The sync runs every five minutes or on demand.

- Query results become cards. Title, description, status, due date, priority and labels sync both ways. Azure DevOps work item
  types without a date field keep their date on the card only, and the sync reports it. A card holds eight labels at most; further
  labels stay on the ticket.
- Assignees sync only from the ticket to the card.
- If both changed, the ticket wins and the sync reports a conflict.
- Jira status changes use allowed transitions. An unreachable status is reported, and the card returns to the ticket's status.
- *Create as ticket* on a card creates a Jira task or an Azure DevOps task.
- A deleted card comes back as long as its ticket matches the query. Tickets are never deleted.

Tested against a replica of the REST calls used, not against real Jira or Azure DevOps instances.

## Office documents

PDF pages can always be placed on a board. For Word, Excel, PowerPoint and OpenDocument files, run the optional
[Gotenberg](https://gotenberg.dev) service, which converts them to PDF inside your installation:

```bash
docker compose --profile office up -d
```

and set `OFFICE_CONVERTER_URL=http://gotenberg:3000` in `.env`. Gotenberg needs about 1 GB of memory.

## draw.io and PowerPoint

Import `.drawio` and `.pptx` files from the board's export menu or as a new board from the home page. Compressed draw.io files
and several pages work. The old `.ppt` format doesn't. PowerPoint charts and SmartArt aren't imported; the count of skipped
items is shown.

The PowerPoint export creates one slide per frame. Exported files open in LibreOffice; PowerPoint itself hasn't been tested.
